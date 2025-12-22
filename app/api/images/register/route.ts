import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { encode } from 'blurhash';
import { query, errorResponse, getErrorMessage, getOssClient } from '@/app/lib';
import { isAdmin } from '@/app/lib/auth';

export const dynamic = 'force-dynamic';

const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;

interface ImageToRegister {
  ossKey: string;
  filename: string;
  width: number;
  height: number;
  filesize: number;
  metadata: {
    prompt?: string;
    model_base?: string;
    source?: string;
    style?: string;
    imported_at?: string;
  };
}

interface RegisteredImage {
  id: number;
  ossKey: string;
}

interface FailedImage {
  ossKey: string;
  error: string;
}

/**
 * 从 OSS 获取图片并计算 BlurHash
 */
async function calculateBlurhashFromOss(ossKey: string): Promise<string | null> {
  try {
    const client = getOssClient();
    const result = await client.get(ossKey);
    const buffer = result.content as Buffer;

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
    console.warn('[Register] Failed to calculate blurhash:', getErrorMessage(error));
    return null;
  }
}

/**
 * 从 OSS 获取图片并计算主色调
 */
async function getDominantColorFromOss(ossKey: string): Promise<string | null> {
  try {
    const client = getOssClient();
    const result = await client.get(ossKey);
    const buffer = result.content as Buffer;

    const { dominant } = await sharp(buffer).stats();
    const r = dominant.r.toString(16).padStart(2, '0');
    const g = dominant.g.toString(16).padStart(2, '0');
    const b = dominant.b.toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  } catch (error) {
    console.warn('[Register] Failed to calculate dominant color:', getErrorMessage(error));
    return null;
  }
}

/**
 * POST /api/images/register - 注册已上传到 OSS 的图片
 */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  try {
    const body = await request.json();
    const images: ImageToRegister[] = body.images;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return errorResponse('No images provided', 400);
    }

    console.log(`[Register] Processing ${images.length} images`);

    const registered: RegisteredImage[] = [];
    const failed: FailedImage[] = [];

    for (const image of images) {
      try {
        const { ossKey, filename, width, height, filesize, metadata } = image;

        if (!ossKey) {
          failed.push({ ossKey: ossKey || 'unknown', error: 'Missing ossKey' });
          continue;
        }

        // 并行计算 blurhash 和 dominant_color
        const [blurhash, dominant_color] = await Promise.all([
          calculateBlurhashFromOss(ossKey),
          getDominantColorFromOss(ossKey),
        ]);

        const now = Math.floor(Date.now() / 1000);
        const createdAt = new Date().toISOString().replace('T', ' ').split('.')[0];

        const insertResult = await query<{ id: number }>(
          `INSERT INTO images (
            filename, filepath, oss_key, prompt, width, height,
            filesize, imported_at, source, model_base,
            style, style_ref, blurhash, dominant_color, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id`,
          [
            filename,
            ossKey,
            ossKey,
            metadata.prompt || null,
            width,
            height,
            filesize,
            now,
            metadata.source || 'upload',
            metadata.model_base || null,
            metadata.style || null,
            metadata.imported_at || null,
            blurhash,
            dominant_color,
            createdAt,
          ]
        );

        const insertedId = insertResult.rows[0]?.id;
        registered.push({ id: insertedId, ossKey });
        console.log(`[Register] Registered: id=${insertedId}, ossKey=${ossKey}`);
      } catch (err) {
        console.error(`[Register] Failed to register ${image.ossKey}:`, err);
        failed.push({ ossKey: image.ossKey, error: getErrorMessage(err) });
      }
    }

    console.log(`[Register] Complete: ${registered.length} success, ${failed.length} failed`);

    return NextResponse.json({
      success: true,
      registered,
      failed,
    });
  } catch (error) {
    console.error('[Register] Error:', error);
    return errorResponse('Registration failed', 500, getErrorMessage(error));
  }
}
