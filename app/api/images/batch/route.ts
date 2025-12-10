import { NextRequest, NextResponse } from 'next/server';
import {
  withDatabase,
  errorResponse,
  parseJsonBody,
  getErrorMessage,
} from '@/app/lib';

interface BatchDeleteBody {
  ids: number[];
}

export async function DELETE(request: NextRequest) {
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
