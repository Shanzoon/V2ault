import { NextRequest, NextResponse } from 'next/server';
import {
  query,
  errorResponse,
  parseJsonBody,
  getErrorMessage,
} from '@/app/lib';
import { isAdmin } from '@/app/lib/auth';

interface BatchDeleteBody {
  ids: number[];
}

interface BatchUpdateBody {
  ids: number[];
  action: 'like' | 'update';
  data?: {
    model_base?: string;
    source?: string;
    style?: string;
  };
}

export async function DELETE(request: NextRequest) {
  // 权限检查
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  const body = await parseJsonBody<BatchDeleteBody>(request);
  if (!body) {
    return errorResponse('Invalid JSON', 400);
  }

  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return errorResponse('IDs must be a non-empty array', 400);
  }

  try {
    // 软删除：批量设置 deleted_at 时间戳
    const now = Math.floor(Date.now() / 1000);
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    const result = await query(
      `UPDATE images SET deleted_at = $1 WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      [now, ...ids]
    );

    return NextResponse.json({ success: true, deletedCount: result.rowCount });
  } catch (error: unknown) {
    console.error('Error deleting images:', error);
    return errorResponse('Failed to delete images', 500, getErrorMessage(error));
  }
}

export async function PATCH(request: NextRequest) {
  const body = await parseJsonBody<BatchUpdateBody>(request);
  if (!body) {
    return errorResponse('Invalid JSON', 400);
  }

  const { ids, action, data } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return errorResponse('IDs must be a non-empty array', 400);
  }

  if (!action) {
    return errorResponse('Action is required', 400);
  }

  // 除了 like 操作，其他操作需要管理员权限
  if (action !== 'like' && !(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  try {
    let updatedCount = 0;

    if (action === 'like') {
      // 批量点赞：将 like_count 设为 1
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const result = await query(
        `UPDATE images SET like_count = 1 WHERE id IN (${placeholders})`,
        ids
      );
      updatedCount = result.rowCount ?? 0;
    }

    if (action === 'update' && data) {
      // 构建动态 UPDATE 语句
      const updates: string[] = [];
      const values: (string | number | null)[] = [];
      let paramIndex = 1;

      if (data.model_base !== undefined) {
        updates.push(`model_base = $${paramIndex++}`);
        values.push(data.model_base || null);
      }
      if (data.source !== undefined) {
        updates.push(`source = $${paramIndex++}`);
        values.push(data.source || null);
      }
      if (data.style !== undefined) {
        updates.push(`style = $${paramIndex++}`);
        values.push(data.style || null);
      }

      if (updates.length > 0) {
        const placeholders = ids.map((_, i) => `$${paramIndex + i}`).join(',');
        const sql = `UPDATE images SET ${updates.join(', ')} WHERE id IN (${placeholders})`;
        const result = await query(sql, [...values, ...ids]);
        updatedCount = result.rowCount ?? 0;
      }
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error: unknown) {
    console.error('Error batch updating images:', error);
    return errorResponse('Failed to batch update images', 500, getErrorMessage(error));
  }
}
