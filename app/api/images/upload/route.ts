import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { encode } from 'blurhash';
import {
  withDatabase,
  errorResponse,
  getErrorMessage,
  UPLOAD_DIR,
  UPLOAD_MAX_SIZE,
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
  modelBaseId?: number;
}

interface UploadedImage {
  id: number;
  filename: string;
  filepath: string;
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
 * 确保上传目录存在
 */
function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log('[Upload] Created upload directory:', UPLOAD_DIR);
  }
}

/**
 * 生成唯一文件名
 * 格式: {原名}_{时间戳}_{随机串}.webp
 */
function generateFilename(originalName: string): string {
  const ext = '.webp';
  const baseName = path.basename(originalName, path.extname(originalName));
  // 清理文件名中的特殊字符
  const cleanName = baseName.replace(/[^\w\u4e00-\u9fa5-]/g, '_').slice(0, 50);
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${cleanName}_${timestamp}_${randomStr}${ext}`;
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
    ensureUploadDir();

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

        // 生成唯一文件名并保存
        const newFilename = generateFilename(originalFilename);
        const filepath = path.join(UPLOAD_DIR, newFilename);

        fs.writeFileSync(filepath, processedImage);
        console.log(`[Upload] Saved: ${newFilename} (${width}x${height})`);

        // 计算 blurhash 和 dominant_color
        const blurhash = await calculateBlurhash(processedImage);
        const dominant_color = await getDominantColor(processedImage);

        // 写入数据库
        const result = await withDatabase((db) => {
          const stmt = db.prepare(`
            INSERT INTO images (
              filename, filepath, prompt, width, height,
              filesize, imported_at, source, model_base_id,
              style, blurhash, dominant_color, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const displayName = fileMeta.title || originalFilename;
          const now = Math.floor(Date.now() / 1000);
          const createdAt = new Date().toISOString().replace('T', ' ').split('.')[0];

          const insertResult = stmt.run(
            displayName,
            filepath,
            fileMeta.prompt || null,
            width,
            height,
            processedImage.length,
            now,
            'upload',
            fileMeta.modelBaseId || null,
            fileMeta.style || null,
            blurhash,
            dominant_color,
            createdAt
          );

          return insertResult.lastInsertRowid;
        });

        uploaded.push({
          id: Number(result),
          filename: fileMeta.title || originalFilename,
          filepath,
          width,
          height,
          filesize: processedImage.length,
          blurhash,
          dominant_color,
        });

        console.log(`[Upload] Inserted to DB: id=${result}`);
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
