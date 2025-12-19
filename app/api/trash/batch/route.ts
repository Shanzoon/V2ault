import { NextRequest, NextResponse } from 'next/server';
import {
  withDatabase,
  errorResponse,
  parseJsonBody,
  getErrorMessage,
  clearImageCache,
  deleteSourceFile,
  findActualFilePath,
} from '@/app/lib';
import { isAdmin } from '@/app/lib/auth';

interface BatchBody {
  ids: number[];
}

/**
 * PATCH - 批量恢复图片
 */
export async function PATCH(request: NextRequest) {
  // 权限检查
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  const body = await parseJsonBody<BatchBody>(request);
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return errorResponse('IDs must be a non-empty array', 400);
  }

  try {
    const restoredCount = await withDatabase((db) => {
      const stmt = db.prepare(
        'UPDATE images SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL'
      );
      const restoreMany = db.transaction((ids: number[]) => {
        let changes = 0;
        for (const id of ids) {
          const result = stmt.run(id);
          changes += result.changes;
        }
        return changes;
      });
      return restoreMany(body.ids);
    });

    return NextResponse.json({ success: true, restoredCount });
  } catch (error: unknown) {
    console.error('Error batch restoring images:', error);
    return errorResponse('Failed to batch restore images', 500, getErrorMessage(error));
  }
}

/**
 * DELETE - 批量永久删除图片
 */
export async function DELETE(request: NextRequest) {
  // 权限检查
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  const body = await parseJsonBody<BatchBody>(request);
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return errorResponse('IDs must be a non-empty array', 400);
  }

  try {
    const result = await withDatabase((db) => {
      // 1. 获取文件路径
      const placeholders = body.ids.map(() => '?').join(',');
      const rows = db.prepare(
        `SELECT id, filepath FROM images WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`
      ).all(...body.ids) as { id: number; filepath: string }[];

      // 2. 删除数据库记录
      const deleteMany = db.transaction((ids: number[]) => {
        const stmt = db.prepare(
          'DELETE FROM images WHERE id = ? AND deleted_at IS NOT NULL'
        );
        let changes = 0;
        for (const id of ids) {
          const result = stmt.run(id);
          changes += result.changes;
        }
        return changes;
      });

      return { deletedCount: deleteMany(body.ids), files: rows };
    });

    // 3. 删除物理文件和缓存
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
    console.error('Error batch permanently deleting images:', error);
    return errorResponse('Failed to batch permanently delete images', 500, getErrorMessage(error));
  }
}
