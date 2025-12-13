import { NextResponse } from 'next/server';
import {
  withDatabase,
  errorResponse,
  getErrorMessage,
  RESOLUTION_THRESHOLDS,
  DEFAULT_PAGE_SIZE,
} from '@/app/lib';

// 【修复】强制禁用 Next.js 的 API 缓存！
// 这能解决改了代码没反应的问题
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE));
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'newest';
    const seed = searchParams.get('seed');
    const resolutions = searchParams.get('resolutions') || '';
    const likedOnly = searchParams.get('liked') === 'true'; // [NEW]

    const offset = (page - 1) * limit;

    // 打印参数，方便你在 Trae 终端看日志
    console.log(`[API List] Search="${search}" Page=${page} ResCount=${resolutions?.length} Liked=${likedOnly}`);


    const result = await withDatabase((db) => {
      // 注册随机函数
      if (sort === 'random' && seed) {
        try {
          db.function('deterministic_random', (rowId: number) => {
            const idVal = BigInt(rowId);
            const seedVal = BigInt(seed);
            return Number(((idVal * seedVal + 12345n) ^ (idVal << 13n)) % 2147483647n);
          });
        } catch (e) {}
      }

      let query = 'SELECT * FROM images';
      let countQuery = 'SELECT count(*) as total FROM images';
      const params: (string | number)[] = [];
      const whereConditions: string[] = [];

      // 【修复】超级搜索：同时搜 Prompt、文件名、路径
      if (search) {
        // COALESCE 确保即使字段是 NULL 也不会报错
        whereConditions.push(`(
          COALESCE(prompt, '') LIKE ? OR
          COALESCE(filename, '') LIKE ? OR
          COALESCE(filepath, '') LIKE ?
        )`);
        const likeSearch = `%${search}%`;
        params.push(likeSearch, likeSearch, likeSearch);
      }

      // 【修复】防断流的分辨率筛选
      if (resolutions) {
        const resList = resolutions.split(',').map(r => r.trim());
        const resConditions: string[] = [];
        const { LOW, MEDIUM, HIGH } = RESOLUTION_THRESHOLDS;

        // 使用 COALESCE(width, 0) 防止因为数据库里 width 是 NULL 而导致图片消失
        // Merge low into medium logic
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
      
      // [NEW] Liked Filter
      if (likedOnly) {
        whereConditions.push('like_count > 0');
      }

      if (whereConditions.length > 0) {
        const whereClause = ' WHERE ' + whereConditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }

      // 查总数
      const totalResult = db.prepare(countQuery).get(...params) as { total: number };
      const total = totalResult.total;
      console.log(`[API List] Found Total: ${total}`);

      // 排序与分页
      const normalizedSort = sort === 'random' ? 'random_block' : sort;

      if (normalizedSort === 'random_shuffle' || (normalizedSort === 'random_block' && whereConditions.length > 0)) {
         // 有筛选时，强制用真随机，防止断流
        query += ' ORDER BY RANDOM()';
        params.push(limit, offset);
      } else if (normalizedSort === 'random_block') {
         // 全库查看时，用 ID 排序 (为了让 seed 生效，这里简单处理)
        query += ' ORDER BY id DESC';
        // 暂时回退到普通分页，避免 block 算法出错
        params.push(limit, offset);
      } else {
        query += ' ORDER BY created_at DESC';
        params.push(limit, offset);
      }

      query += ' LIMIT ? OFFSET ?';

      const images = db.prepare(query).all(...params);
      return { images, total };
    }, true);

    return NextResponse.json({
      images: result.images,
      total: result.total,
      page,
      totalPages: Math.ceil(result.total / limit),
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0', // 再次确保 HTTP 头也禁用缓存
      },
    });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return errorResponse('Failed to fetch images', 500, getErrorMessage(error));
  }
}
