import { NextRequest, NextResponse } from 'next/server';
import {
  withDatabase,
  errorResponse,
  getErrorMessage,
  clearImageCache,
  deleteSourceFile,
  findActualFilePath,
  DEFAULT_PAGE_SIZE,
} from '@/app/lib';
import { isAdmin } from '@/app/lib/auth';

// 强制禁用 Next.js 的 API 缓存
export const dynamic = 'force-dynamic';

/**
 * GET - 获取回收站列表
 */
export async function GET(request: NextRequest) {
  // 权限检查
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;

  try {
    const result = await withDatabase((db) => {
      // 获取总数
      const countResult = db.prepare(
        'SELECT count(*) as total FROM images WHERE deleted_at IS NOT NULL'
      ).get() as { total: number };

      // 获取列表，按删除时间倒序
      const images = db.prepare(`
        SELECT * FROM images
        WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);

      return { images, total: countResult.total };
    }, true); // readonly

    return NextResponse.json({
      images: result.images,
      total: result.total,
      page,
      totalPages: Math.ceil(result.total / limit),
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
  // 权限检查
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  try {
    const result = await withDatabase((db) => {
      // 1. 获取所有待删除的文件路径
      const rows = db.prepare(
        'SELECT id, filepath FROM images WHERE deleted_at IS NOT NULL'
      ).all() as { id: number; filepath: string }[];

      // 2. 删除数据库记录
      const deleteResult = db.prepare(
        'DELETE FROM images WHERE deleted_at IS NOT NULL'
      ).run();

      return { deletedCount: deleteResult.changes, files: rows };
    });

    // 3. 删除物理文件和缓存（在事务外执行）
    for (const row of result.files) {
      try {
        const finalPath = findActualFilePath(row.filepath);
        if (finalPath) {
          deleteSourceFile(finalPath);
        }
        clearImageCache(row.filepath);
      } catch (e) {
        console.error(`Failed to delete file for id ${row.id}:`, e);
      }
    }

    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error: unknown) {
    console.error('Error emptying trash:', error);
    return errorResponse('Failed to empty trash', 500, getErrorMessage(error));
  }
}
