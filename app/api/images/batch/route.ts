import { NextRequest, NextResponse } from 'next/server';
import {
  withDatabase,
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

  // 解析请求体
  const body = await parseJsonBody<BatchDeleteBody>(request);
  if (!body) {
    return errorResponse('Invalid JSON', 400);
  }

  const { ids } = body;

  // 验证参数
  if (!Array.isArray(ids) || ids.length === 0) {
    return errorResponse('IDs must be a non-empty array', 400);
  }

  try {
    const deletedCount = await withDatabase((db) => {
      // 使用事务批量删除
      const deleteMany = db.transaction((idsToDelete: number[]) => {
        const stmt = db.prepare('DELETE FROM images WHERE id = ?');
        let changes = 0;
        for (const id of idsToDelete) {
          const result = stmt.run(id);
          changes += result.changes;
        }
        return changes;
      });

      return deleteMany(ids);
    });

    return NextResponse.json({ success: true, deletedCount });
  } catch (error: unknown) {
    console.error('Error deleting images:', error);
    return errorResponse('Failed to delete images', 500, getErrorMessage(error));
  }
}

// 批量更新
export async function PATCH(request: NextRequest) {
  // 解析请求体
  const body = await parseJsonBody<BatchUpdateBody>(request);
  if (!body) {
    return errorResponse('Invalid JSON', 400);
  }

  const { ids, action, data } = body;

  // 验证参数
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
    const result = await withDatabase((db) => {
      if (action === 'like') {
        // 批量点赞：将 like_count 设为 1
        const stmt = db.prepare('UPDATE images SET like_count = 1 WHERE id = ?');
        const updateMany = db.transaction((idsToUpdate: number[]) => {
          let changes = 0;
          for (const id of idsToUpdate) {
            const result = stmt.run(id);
            changes += result.changes;
          }
          return changes;
        });
        return updateMany(ids);
      }

      if (action === 'update' && data) {
        // 构建动态 UPDATE 语句
        const updates: string[] = [];
        const values: (string | null)[] = [];

        if (data.model_base !== undefined) {
          updates.push('model_base = ?');
          values.push(data.model_base || null);
        }
        if (data.source !== undefined) {
          updates.push('source = ?');
          values.push(data.source || null);
        }
        if (data.style !== undefined) {
          updates.push('style = ?');
          values.push(data.style || null);
        }

        if (updates.length === 0) {
          return 0;
        }

        const sql = `UPDATE images SET ${updates.join(', ')} WHERE id = ?`;
        const stmt = db.prepare(sql);

        const updateMany = db.transaction((idsToUpdate: number[]) => {
          let changes = 0;
          for (const id of idsToUpdate) {
            const result = stmt.run(...values, id);
            changes += result.changes;
          }
          return changes;
        });

        return updateMany(ids);
      }

      return 0;
    });

    return NextResponse.json({ success: true, updatedCount: result });
  } catch (error: unknown) {
    console.error('Error batch updating images:', error);
    return errorResponse('Failed to batch update images', 500, getErrorMessage(error));
  }
}
