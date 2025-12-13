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
  windowsToWslPath,
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

  // 1. 查库
  let dbFilepath: string | undefined;
  try {
    const row = withDatabaseSync((db) => {
      return db.prepare('SELECT filepath FROM images WHERE id = ?').get(id) as
        | { filepath: string }
        | undefined;
    }, true);
    dbFilepath = row?.filepath;
  } catch (e) {
    console.error('DB Error:', e);
    return errorResponse('Database Error', 500);
  }

  if (!dbFilepath) {
    return errorResponse('Image not found in DB', 404);
  }

  // 将 Windows 路径转换为 WSL 路径
  const finalPath = windowsToWslPath(dbFilepath);

  // 检查文件是否存在
  if (!fs.existsSync(finalPath)) {
    console.error(`文件不存在: ${finalPath}`);
    return errorResponse('File missing on disk', 404);
  }

  // 缩略图处理
  if (widthParam) {
    const width = parseInt(widthParam, 10);
    if (!isNaN(width) && width > 0) {
      try {
        ensureCacheDir();
        const cachePath = getCachePath(finalPath, width); // 用找到的 finalPath

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

        const fileBuffer = fs.readFileSync(finalPath);
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

  try {
    const stats = fs.statSync(finalPath);
    const stream = fs.createReadStream(finalPath);
    const ext = path.extname(finalPath).toLowerCase();
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