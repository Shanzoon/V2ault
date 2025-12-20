import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { encode } from 'blurhash';
import {
  query,
  errorResponse,
  getErrorMessage,
  UPLOAD_MAX_SIZE,
  uploadToOss,
  generateOssKey,
} from '@/app/lib';
import { isAdmin } from '@/app/lib/auth';

// 禁用 Next.js 的静态缓存
export const dynamic = 'force-dynamic';

// BlurHash 分量参数
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;

interface UploadMetadata {
  originalFilename: string;
  title?: string;
  prompt?: string;
  style?: string;
  source?: string;
  model_base?: string;
  imported_at?: string;  // 风格参照/LoRA名称
  modelBaseId?: number;
}

interface UploadedImage {
  id: number;
  filename: string;
  oss_key: string;
  url: string;
  width: number;
  height: number;
  filesize: number;
  blurhash: string | null;
  dominant_color: string | null;
}

interface FailedUpload {
  filename: string;
  error: string;
}

/**
 * 计算图片主色调
 */
async function getDominantColor(buffer: Buffer): Promise<string | null> {
  try {
    const { dominant } = await sharp(buffer).stats();
    const r = dominant.r.toString(16).padStart(2, '0');
    const g = dominant.g.toString(16).padStart(2, '0');
    const b = dominant.b.toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  } catch (error) {
    console.warn('[Upload] Failed to calculate dominant color:', getErrorMessage(error));
    return null;
  }
}

/**
 * 计算 BlurHash
 */
async function calculateBlurhash(buffer: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(buffer)
      .raw()
      .ensureAlpha()
      .resize(32, 32, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });

    return encode(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      BLURHASH_COMPONENT_X,
      BLURHASH_COMPONENT_Y
    );
  } catch (error) {
    console.warn('[Upload] Failed to calculate blurhash:', getErrorMessage(error));
    return null;
  }
}

/**
 * 处理图片上传
 */
export async function POST(request: NextRequest) {
  // 权限检查
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const metadataStr = formData.get('metadata') as string;

    if (!files || files.length === 0) {
      return errorResponse('No files provided', 400);
    }

    let metadata: UploadMetadata[] = [];
    try {
      metadata = JSON.parse(metadataStr || '[]');
    } catch {
      return errorResponse('Invalid metadata JSON', 400);
    }

    console.log(`[Upload] Processing ${files.length} files`);

    const uploaded: UploadedImage[] = [];
    const failed: FailedUpload[] = [];

    for (const file of files) {
      const originalFilename = file.name;

      // 查找对应的元数据
      const fileMeta = metadata.find((m) => m.originalFilename === originalFilename) || {
        originalFilename,
      };

      try {
        // 检查文件大小
        if (file.size > UPLOAD_MAX_SIZE) {
          failed.push({
            filename: originalFilename,
            error: `文件大小超过 ${Math.round(UPLOAD_MAX_SIZE / 1024 / 1024)}MB 限制`,
          });
          continue;
        }

        // 验证文件类型
        if (!file.type.startsWith('image/')) {
          failed.push({
            filename: originalFilename,
            error: '不支持的文件类型',
          });
          continue;
        }

        // 读取文件
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 使用 sharp 处理图片并转换为 WebP 无损格式
        const processedImage = await sharp(buffer)
          .webp({ lossless: true })
          .toBuffer();

        // 获取图片尺寸
        const sharpMeta = await sharp(processedImage).metadata();
        const width = sharpMeta.width || 0;
        const height = sharpMeta.height || 0;

        // 生成 OSS 对象键名
        const ossKey = generateOssKey(originalFilename);

        // 上传到阿里云 OSS
        const ossResult = await uploadToOss(ossKey, processedImage, 'image/webp');
        console.log(`[Upload] Uploaded to OSS: ${ossKey} (${width}x${height})`);

        // 计算 blurhash 和 dominant_color
        const blurhash = await calculateBlurhash(processedImage);
        const dominant_color = await getDominantColor(processedImage);

        // 写入数据库
        const displayName = fileMeta.title || originalFilename;
        const now = Math.floor(Date.now() / 1000);
        const createdAt = new Date().toISOString().replace('T', ' ').split('.')[0];

        const insertResult = await query<{ id: number }>(
          `INSERT INTO images (
            filename, filepath, oss_key, prompt, width, height,
            filesize, imported_at, source, model_base_id, model_base,
            style, style_ref, blurhash, dominant_color, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING id`,
          [
            displayName,
            ossKey,  // filepath 保存 oss_key 以兼容旧代码
            ossKey,
            fileMeta.prompt || null,
            width,
            height,
            processedImage.length,
            now,
            fileMeta.source || 'upload',
            fileMeta.modelBaseId || null,
            fileMeta.model_base || null,
            fileMeta.style || null,
            fileMeta.imported_at || null,  // style_ref
            blurhash,
            dominant_color,
            createdAt
          ]
        );

        const insertedId = insertResult.rows[0]?.id;

        uploaded.push({
          id: insertedId,
          filename: fileMeta.title || originalFilename,
          oss_key: ossKey,
          url: ossResult.url,
          width,
          height,
          filesize: processedImage.length,
          blurhash,
          dominant_color,
        });

        console.log(`[Upload] Inserted to DB: id=${insertedId}`);
      } catch (err) {
        console.error(`[Upload] Failed to process ${originalFilename}:`, err);
        failed.push({
          filename: originalFilename,
          error: getErrorMessage(err),
        });
      }
    }

    console.log(`[Upload] Complete: ${uploaded.length} success, ${failed.length} failed`);

    return NextResponse.json({
      success: true,
      uploaded,
      failed,
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    return errorResponse('Upload failed', 500, getErrorMessage(error));
  }
}
