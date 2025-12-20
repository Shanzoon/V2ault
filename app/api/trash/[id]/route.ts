import { NextRequest, NextResponse } from 'next/server';
import {
  query,
  queryOne,
  errorResponse,
  getErrorMessage,
  deleteFromOss,
} from '@/app/lib';
import { isAdmin } from '@/app/lib/auth';

/**
 * PATCH - 恢复单张图片
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  const { id } = await params;

  try {
    const result = await query(
      'UPDATE images SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL',
      [id]
    );

    if (result.rowCount === 0) {
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
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  const { id } = await params;

  try {
    // 1. 先查出 OSS key
    const row = await queryOne<{ oss_key: string | null; filepath: string }>(
      'SELECT oss_key, filepath FROM images WHERE id = $1 AND deleted_at IS NOT NULL',
      [id]
    );

    if (!row) {
      return errorResponse('Image not found in trash', 404);
    }

    // 2. 删除数据库记录
    const deleteResult = await query('DELETE FROM images WHERE id = $1', [id]);

    // 3. 删除 OSS 文件
    const ossKey = row.oss_key || row.filepath;
    if (deleteResult.rowCount && deleteResult.rowCount > 0 && ossKey) {
      try {
        await deleteFromOss(ossKey);
        console.log(`[Trash] Deleted from OSS: ${ossKey}`);
      } catch (e) {
        console.error(`[Trash] Failed to delete from OSS: ${ossKey}`, e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error permanently deleting image:', error);
    return errorResponse('Failed to permanently delete image', 500, getErrorMessage(error));
  }
}
