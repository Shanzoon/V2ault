import { NextRequest, NextResponse } from 'next/server';
import {
  queryOne,
  errorResponse,
  getProcessedImageUrl,
  getSignedUrl,
  CACHE_MAX_AGE,
} from '@/app/lib';

/**
 * 图片获取 API
 * 通过重定向到 OSS URL 实现图片访问
 * 支持通过 ?w= 参数获取指定宽度的缩略图（使用 OSS 图片处理服务）
 */
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

  // 查询数据库获取图片信息
  try {
    const imageRow = await queryOne<{ oss_key: string | null; filepath: string }>(
      'SELECT oss_key, filepath FROM images WHERE id = $1',
      [id]
    );

    if (!imageRow) {
      return errorResponse('Image not found in DB', 404);
    }

    // 获取 OSS key（优先使用 oss_key，如果没有则使用 filepath）
    const ossKey = imageRow.oss_key || imageRow.filepath;

    if (!ossKey) {
      return errorResponse('Image has no OSS key', 404);
    }

    // 生成 OSS URL
    let imageUrl: string;

    if (widthParam) {
      const width = parseInt(widthParam, 10);
      if (!isNaN(width) && width > 0) {
        // 使用 OSS 图片处理服务生成缩略图
        imageUrl = getProcessedImageUrl(ossKey, width, 80);
      } else {
        // 无效的宽度参数，返回原图（使用签名 URL）
        imageUrl = getSignedUrl(ossKey);
      }
    } else {
      // 没有宽度参数，返回原图（使用签名 URL）
      imageUrl = getSignedUrl(ossKey);
    }

    // 返回 302 重定向到 OSS URL
    return NextResponse.redirect(imageUrl, {
      status: 302,
      headers: {
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
      },
    });
  } catch (e) {
    console.error('DB Error:', e);
    return errorResponse('Database Error', 500);
  }
}
