import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  withDatabaseSync,
  errorResponse,
  ensureCacheDir,
  getCachePath,
  cacheExists,
  readCache,
  writeCache,
  CACHE_MAX_AGE,
  THUMBNAIL_QUALITY,
} from '@/app/lib';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const widthParam = searchParams.get('w');

  if (!id) {
    return errorResponse('Missing id', 400);
  }

  // 1. 快速查库（同步操作）
  let filepath: string | undefined;

  try {
    const row = withDatabaseSync((db) => {
      return db.prepare('SELECT filepath FROM images WHERE id = ?').get(id) as
        | { filepath: string }
        | undefined;
    }, true);

    filepath = row?.filepath;
  } catch (e) {
    console.error('DB Error:', e);
    return errorResponse('Database Error', 500);
  }

  if (!filepath) {
    return errorResponse('Image not found in DB', 404);
  }

  if (!fs.existsSync(filepath)) {
    return errorResponse('File missing on disk', 404);
  }

  // 2. 处理缩略图（带缓存）
  if (widthParam) {
    const width = parseInt(widthParam, 10);
    if (!isNaN(width) && width > 0) {
      try {
        ensureCacheDir();
        const cachePath = getCachePath(filepath, width);

        // 命中缓存
        if (cacheExists(cachePath)) {
          const cacheBuffer = readCache(cachePath);
          return new NextResponse(new Uint8Array(cacheBuffer), {
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
              'X-Cache': 'HIT',
            },
          });
        }

        // 未命中：生成并写入缓存
        const fileBuffer = fs.readFileSync(filepath);
        const resizedBuffer = await sharp(fileBuffer)
          .resize(width)
          .jpeg({ quality: THUMBNAIL_QUALITY })
          .toBuffer();

        writeCache(cachePath, resizedBuffer);

        return new NextResponse(new Uint8Array(resizedBuffer), {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
            'X-Cache': 'MISS',
          },
        });
      } catch (err) {
        console.error('Thumbnail generation error:', err);
        return errorResponse('Error generating thumbnail', 500);
      }
    }
  }

  // 3. 返回原图（流式传输）
  try {
    const stats = fs.statSync(filepath);
    const stream = fs.createReadStream(filepath);

    // MIME 类型推断
    const ext = path.extname(filepath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.gif') contentType = 'image/gif';

    // @ts-expect-error Next.js Response 支持 Node Stream
    return new NextResponse(stream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
      },
    });
  } catch (error) {
    console.error('Stream error:', error);
    return errorResponse('Error serving file', 500);
  }
}
