import { NextResponse } from 'next/server';
import {
  withDatabase,
  errorResponse,
  getErrorMessage,
  RESOLUTION_THRESHOLDS,
  DEFAULT_PAGE_SIZE,
} from '@/app/lib';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE));
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'newest';
    const seed = searchParams.get('seed');
    const resolutions = searchParams.get('resolutions') || '';

    const offset = (page - 1) * limit;

    // 使用 withDatabase 自动管理连接
    const result = await withDatabase((db) => {
      // Register deterministic random function
      if (sort === 'random' && seed) {
        db.function('deterministic_random', (rowId: number) => {
          const idVal = BigInt(rowId);
          const seedVal = BigInt(seed);
          return Number(((idVal * seedVal + 12345n) ^ (idVal << 13n)) % 2147483647n);
        });
      }

      // 构建查询
      let query = 'SELECT * FROM images';
      let countQuery = 'SELECT count(*) as total FROM images';
      const params: (string | number)[] = [];
      const whereConditions: string[] = [];

      // 搜索条件
      if (search) {
        whereConditions.push('(prompt LIKE ? OR filename LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      // 分辨率筛选
      if (resolutions) {
        const resList = resolutions.split(',').map(r => r.trim());
        const resConditions: string[] = [];
        const { LOW, MEDIUM, HIGH } = RESOLUTION_THRESHOLDS;

        if (resList.includes('low')) {
          resConditions.push(`(width * height < ${LOW})`);
        }
        if (resList.includes('medium')) {
          resConditions.push(`(width * height >= ${LOW} AND width * height < ${MEDIUM})`);
        }
        if (resList.includes('high')) {
          resConditions.push(`(width * height >= ${MEDIUM} AND width * height < ${HIGH})`);
        }
        if (resList.includes('ultra')) {
          resConditions.push(`(width * height >= ${HIGH})`);
        }

        if (resConditions.length > 0) {
          whereConditions.push(`(${resConditions.join(' OR ')})`);
        }
      }

      // 组装 WHERE 子句
      if (whereConditions.length > 0) {
        const whereClause = ' WHERE ' + whereConditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }

      // 获取总数
      const totalResult = db.prepare(countQuery).get(...params) as { total: number };
      const total = totalResult.total;

      // 排序
      const normalizedSort = sort === 'random' ? 'random_block' : sort;

      if (normalizedSort === 'random_shuffle') {
        query += ' ORDER BY RANDOM()';
        params.push(limit, offset);
      } else if (normalizedSort === 'random_block') {
        query += ' ORDER BY id DESC';
        const seedVal = seed ? parseInt(seed) : 0;
        const randomStart = total > 0 ? seedVal % total : 0;
        const blockOffset = randomStart + offset;
        params.push(limit, blockOffset);
      } else {
        query += ' ORDER BY created_at DESC';
        params.push(limit, offset);
      }

      // 分页
      query += ' LIMIT ? OFFSET ?';

      // 执行查询
      const images = db.prepare(query).all(...params);

      return { images, total };
    }, true); // readonly

    return NextResponse.json({
      images: result.images,
      total: result.total,
      page,
      totalPages: Math.ceil(result.total / limit),
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return errorResponse('Failed to fetch images', 500, getErrorMessage(error));
  }
}
