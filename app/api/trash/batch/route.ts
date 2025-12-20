import { NextRequest, NextResponse } from 'next/server';
import {
  query,
  queryAll,
  errorResponse,
  parseJsonBody,
  getErrorMessage,
  batchDeleteFromOss,
} from '@/app/lib';
import { isAdmin } from '@/app/lib/auth';

interface BatchBody {
  ids: number[];
}

/**
 * PATCH - 批量恢复图片
 */
export async function PATCH(request: NextRequest) {
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  const body = await parseJsonBody<BatchBody>(request);
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return errorResponse('IDs must be a non-empty array', 400);
  }

  try {
    const placeholders = body.ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(
      `UPDATE images SET deleted_at = NULL WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`,
      body.ids
    );

    return NextResponse.json({ success: true, restoredCount: result.rowCount });
  } catch (error: unknown) {
    console.error('Error batch restoring images:', error);
    return errorResponse('Failed to batch restore images', 500, getErrorMessage(error));
  }
}

/**
 * DELETE - 批量永久删除图片
 */
export async function DELETE(request: NextRequest) {
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  const body = await parseJsonBody<BatchBody>(request);
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return errorResponse('IDs must be a non-empty array', 400);
  }

  try {
    // 1. 获取 OSS keys
    const placeholders = body.ids.map((_, i) => `$${i + 1}`).join(',');
    const rows = await queryAll<{ id: number; oss_key: string | null; filepath: string }>(
      `SELECT id, oss_key, filepath FROM images WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`,
      body.ids
    );

    // 2. 删除数据库记录
    const deleteResult = await query(
      `DELETE FROM images WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`,
      body.ids
    );

    // 3. 批量删除 OSS 文件
    const ossKeys = rows
      .map((r) => r.oss_key || r.filepath)
      .filter((key): key is string => !!key);

    if (ossKeys.length > 0) {
      try {
        await batchDeleteFromOss(ossKeys);
        console.log(`[Trash] Batch deleted ${ossKeys.length} files from OSS`);
      } catch (e) {
        console.error('[Trash] Failed to batch delete from OSS:', e);
      }
    }

    return NextResponse.json({ success: true, deletedCount: deleteResult.rowCount });
  } catch (error: unknown) {
    console.error('Error batch permanently deleting images:', error);
    return errorResponse('Failed to batch permanently delete images', 500, getErrorMessage(error));
  }
}
