import { NextRequest, NextResponse } from 'next/server';
import {
  withDatabase,
  errorResponse,
  getErrorMessage,
  clearImageCache,
  deleteSourceFile,
  findActualFilePath,
} from '@/app/lib';
import { isAdmin } from '@/app/lib/auth';

/**
 * PATCH - 恢复单张图片
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 权限检查
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  const { id } = await params;

  try {
    const result = await withDatabase((db) => {
      const updateResult = db.prepare(
        'UPDATE images SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL'
      ).run(id);
      return updateResult.changes > 0;
    });

    if (!result) {
      return errorResponse('Image not found in trash', 404);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error restoring image:', error);
    return errorResponse('Failed to restore image', 500, getErrorMessage(error));
  }
}

/**
 * DELETE - 永久删除单张图片
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 权限检查
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  const { id } = await params;

  try {
    const result = await withDatabase((db) => {
      // 1. 先查出文件路径
      const row = db.prepare(
        'SELECT filepath FROM images WHERE id = ? AND deleted_at IS NOT NULL'
      ).get(id) as { filepath: string } | undefined;

      if (!row) {
        return { success: false, notFound: true };
      }

      // 2. 删除数据库记录
      const deleteResult = db.prepare('DELETE FROM images WHERE id = ?').run(id);

      return { success: deleteResult.changes > 0, filepath: row.filepath };
    });

    if (result.notFound) {
      return errorResponse('Image not found in trash', 404);
    }

    // 3. 删除物理文件和缓存
    if (result.success && result.filepath) {
      try {
        const finalPath = findActualFilePath(result.filepath);
        if (finalPath) {
          deleteSourceFile(finalPath);
        }
        clearImageCache(result.filepath);
      } catch (e) {
        console.error('Failed to delete physical file:', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error permanently deleting image:', error);
    return errorResponse('Failed to permanently delete image', 500, getErrorMessage(error));
  }
}
