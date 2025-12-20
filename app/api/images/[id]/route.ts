import { NextRequest, NextResponse } from 'next/server';
import {
  query,
  errorResponse,
  parseJsonBody,
  getErrorMessage,
} from '@/app/lib';
import { isAdmin } from '@/app/lib/auth';

interface UpdateImageBody {
  prompt?: string;
  model_base?: string;
  source?: string;
  style?: string;
  style_ref?: string;
}

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
    // 软删除：设置 deleted_at 时间戳
    const now = Math.floor(Date.now() / 1000);
    const result = await query(
      'UPDATE images SET deleted_at = $1 WHERE id = $2 AND deleted_at IS NULL',
      [now, id]
    );

    if (result.rowCount === 0) {
      return errorResponse('Image not found', 404);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error processing delete:', error);
    return errorResponse('Failed to delete image', 500, getErrorMessage(error));
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await parseJsonBody<UpdateImageBody>(request);
  if (!body) {
    return errorResponse('Invalid JSON', 400);
  }

  const { prompt, model_base, source, style, style_ref } = body;

  // 构建更新语句
  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  let paramIndex = 1;

  if (prompt !== undefined) {
    if (typeof prompt !== 'string') {
      return errorResponse('Prompt must be a string', 400);
    }
    updates.push(`prompt = $${paramIndex++}`);
    values.push(prompt);
  }

  // 以下字段需要管理员权限
  const adminFields = { model_base, source, style, style_ref };
  const hasAdminFields = Object.values(adminFields).some(v => v !== undefined);

  if (hasAdminFields) {
    if (!(await isAdmin())) {
      return errorResponse('Unauthorized', 403);
    }

    if (model_base !== undefined) {
      updates.push(`model_base = $${paramIndex++}`);
      values.push(model_base || null);
    }
    if (source !== undefined) {
      updates.push(`source = $${paramIndex++}`);
      values.push(source || null);
    }
    if (style !== undefined) {
      updates.push(`style = $${paramIndex++}`);
      values.push(style || null);
    }
    if (style_ref !== undefined) {
      updates.push(`style_ref = $${paramIndex++}`);
      values.push(style_ref || null);
    }
  }

  if (updates.length === 0) {
    return errorResponse('No fields to update', 400);
  }

  try {
    const sql = `UPDATE images SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
    values.push(parseInt(id));

    const result = await query(sql, values);

    if (result.rowCount === 0) {
      return errorResponse('Image not found', 404);
    }

    return NextResponse.json({
      success: true,
      updated: { prompt, model_base, source, style, style_ref }
    });
  } catch (error: unknown) {
    console.error('Error updating image:', error);
    return errorResponse('Failed to update image', 500, getErrorMessage(error));
  }
}
