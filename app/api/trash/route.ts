import { NextRequest, NextResponse } from 'next/server';
import {
  query,
  queryOne,
  queryAll,
  errorResponse,
  getErrorMessage,
  batchDeleteFromOss,
  DEFAULT_PAGE_SIZE,
} from '@/app/lib';
import { isAdmin } from '@/app/lib/auth';

// 强制禁用 Next.js 的 API 缓存
export const dynamic = 'force-dynamic';

/**
 * GET - 获取回收站列表
 */
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;

  try {
    // 获取总数
    const countResult = await queryOne<{ total: string }>(
      'SELECT count(*) as total FROM images WHERE deleted_at IS NOT NULL'
    );
    const total = parseInt(countResult?.total || '0');

    // 获取列表，按删除时间倒序
    const images = await queryAll(
      `SELECT * FROM images WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return NextResponse.json({
      images,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    console.error('Error fetching trash:', error);
    return errorResponse('Failed to fetch trash', 500, getErrorMessage(error));
  }
}

/**
 * DELETE - 清空回收站（永久删除所有已软删除的图片）
 */
export async function DELETE() {
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  try {
    // 1. 获取所有待删除的 OSS keys
    const rows = await queryAll<{ id: number; oss_key: string | null; filepath: string }>(
      'SELECT id, oss_key, filepath FROM images WHERE deleted_at IS NOT NULL'
    );

    // 2. 删除数据库记录
    const deleteResult = await query('DELETE FROM images WHERE deleted_at IS NOT NULL');

    // 3. 批量删除 OSS 文件
    const ossKeys = rows
      .map((r) => r.oss_key || r.filepath)
      .filter((key): key is string => !!key);

    if (ossKeys.length > 0) {
      try {
        await batchDeleteFromOss(ossKeys);
        console.log(`[Trash] Emptied trash: deleted ${ossKeys.length} files from OSS`);
      } catch (e) {
        console.error('[Trash] Failed to delete files from OSS:', e);
      }
    }

    return NextResponse.json({ success: true, deletedCount: deleteResult.rowCount });
  } catch (error: unknown) {
    console.error('Error emptying trash:', error);
    return errorResponse('Failed to empty trash', 500, getErrorMessage(error));
  }
}
