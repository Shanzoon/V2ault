import { NextResponse } from 'next/server';
import {
  queryAll,
  errorResponse,
  getErrorMessage,
  getProcessedImageUrl,
  RESOLUTION_THRESHOLDS,
  DEFAULT_PAGE_SIZE,
  DatabaseError,
} from '@/app/lib';

// 强制禁用 Next.js 的 API 缓存
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE));
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'newest';
    const resolutions = searchParams.get('resolutions') || '';
    const likedOnly = searchParams.get('liked') === 'true';
    const modelBases = searchParams.get('modelBases') || '';
    const styles = searchParams.get('styles') || '';

    const offset = (page - 1) * limit;

    console.log(`[API List] Search="${search}" Page=${page} Liked=${likedOnly}`);

    // 构建查询
    let baseQuery = 'FROM images';
    const params: (string | number)[] = [];
    const whereConditions: string[] = [];
    let paramIndex = 1;

    // 排除已删除的图片
    whereConditions.push('deleted_at IS NULL');

    // 搜索：同时搜 Prompt、文件名、路径
    if (search) {
      whereConditions.push(`(
        COALESCE(prompt, '') ILIKE $${paramIndex} OR
        COALESCE(filename, '') ILIKE $${paramIndex} OR
        COALESCE(filepath, '') ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // 分辨率筛选
    if (resolutions) {
      const resList = resolutions.split(',').map(r => r.trim());
      const resConditions: string[] = [];
      const { MEDIUM, HIGH } = RESOLUTION_THRESHOLDS;

      if (resList.includes('medium')) {
        resConditions.push(`(COALESCE(width, 0) * COALESCE(height, 0) < ${MEDIUM})`);
      }
      if (resList.includes('high')) {
        resConditions.push(`(
          COALESCE(width, 0) * COALESCE(height, 0) >= ${MEDIUM} AND
          COALESCE(width, 0) * COALESCE(height, 0) < ${HIGH}
        )`);
      }
      if (resList.includes('ultra')) {
        resConditions.push(`(COALESCE(width, 0) * COALESCE(height, 0) >= ${HIGH})`);
      }

      if (resConditions.length > 0) {
        whereConditions.push(`(${resConditions.join(' OR ')})`);
      }
    }

    // Liked 筛选
    if (likedOnly) {
      whereConditions.push('like_count > 0');
    }

    // Model Base 筛选
    if (modelBases) {
      const baseList = modelBases.split(',').map(b => b.trim()).filter(Boolean);
      if (baseList.length > 0) {
        const placeholders = baseList.map(() => `$${paramIndex++}`).join(',');
        whereConditions.push(`model_base IN (${placeholders})`);
        params.push(...baseList);
      }
    }

    // Style 筛选
    if (styles) {
      const styleList = styles.split(',').map(s => s.trim()).filter(Boolean);
      if (styleList.length > 0) {
        const placeholders = styleList.map(() => `$${paramIndex++}`).join(',');
        whereConditions.push(`style IN (${placeholders})`);
        params.push(...styleList);
      }
    }

    // 组合 WHERE 子句
    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ');
    }

    // 排序（使用预计算的 random_order 字段，支持索引）
    let orderBy = 'ORDER BY created_at DESC';
    if (sort === 'random' || sort === 'random_shuffle' || sort === 'random_block') {
      orderBy = 'ORDER BY random_order';
    }

    // 合并查询：使用窗口函数一次获取数据和总数
    const selectQuery = `SELECT *, COUNT(*) OVER() as total_count ${baseQuery} ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const images = await queryAll(selectQuery, params);
    const total = images.length > 0 ? parseInt(images[0].total_count || '0') : 0;
    console.log(`[API List] Found Total: ${total}`);

    // 为每张图片生成预签名 URL
    const imagesWithUrls = images.map((img: { oss_key?: string; filepath?: string }) => {
      const ossKey = img.oss_key || img.filepath;
      if (!ossKey) return img;
      return {
        ...img,
        urls: {
          small: getProcessedImageUrl(ossKey, 600, 80),
          large: getProcessedImageUrl(ossKey, 1600, 85),
        },
      };
    });

    return NextResponse.json({
      images: imagesWithUrls,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: unknown) {
    console.error('API Error:', error);

    if (error instanceof DatabaseError) {
      return errorResponse(error.message, 503, undefined, error.code);
    }

    return errorResponse('Failed to fetch images', 500, getErrorMessage(error));
  }
}
