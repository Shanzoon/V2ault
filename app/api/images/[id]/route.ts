import { NextRequest, NextResponse } from 'next/server';
import {
  withDatabase,
  errorResponse,
  parseJsonBody,
  getErrorMessage,
} from '@/app/lib';
import { isAdmin } from '@/app/lib/auth';

interface UpdatePromptBody {
  prompt: string;
}

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
    const result = await withDatabase((db) => {
      // 软删除：设置 deleted_at 时间戳
      const softDelete = db.transaction(() => {
        const updateResult = db.prepare(
          'UPDATE images SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
        ).run(Math.floor(Date.now() / 1000), id);
        return updateResult.changes > 0;
      });

      return softDelete();
    });

    if (!result) {
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

  // 解析请求体
  const body = await parseJsonBody<UpdateImageBody>(request);
  if (!body) {
    return errorResponse('Invalid JSON', 400);
  }

  const { prompt, model_base, source, style, style_ref } = body;

  // 检查是否有需要更新的字段
  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (prompt !== undefined) {
    if (typeof prompt !== 'string') {
      return errorResponse('Prompt must be a string', 400);
    }
    updates.push('prompt = ?');
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
      updates.push('model_base = ?');
      values.push(model_base || null);
    }
    if (source !== undefined) {
      updates.push('source = ?');
      values.push(source || null);
    }
    if (style !== undefined) {
      updates.push('style = ?');
      values.push(style || null);
    }
    if (style_ref !== undefined) {
      updates.push('style_ref = ?');
      values.push(style_ref || null);
    }
  }

  if (updates.length === 0) {
    return errorResponse('No fields to update', 400);
  }

  try {
    const result = await withDatabase((db) => {
      const sql = `UPDATE images SET ${updates.join(', ')} WHERE id = ?`;
      const updateStmt = db.prepare(sql);
      const updateResult = updateStmt.run(...values, id);
      return updateResult.changes > 0;
    });

    if (!result) {
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