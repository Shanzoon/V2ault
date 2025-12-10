import { NextRequest, NextResponse } from 'next/server';
import {
  withDatabase,
  errorResponse,
  parseJsonBody,
  getErrorMessage,
  clearImageCache,
  deleteSourceFile,
} from '@/app/lib';

interface UpdatePromptBody {
  prompt: string;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await withDatabase((db) => {
      // 1. 先查出文件路径
      const row = db.prepare('SELECT filepath FROM images WHERE id = ?').get(id) as
        | { filepath: string }
        | undefined;

      if (!row) {
        return { success: false, notFound: true };
      }

      const filepath = row.filepath;

      // 2. 事务删除数据库记录
      const deleteTransaction = db.transaction(() => {
        const result = db.prepare('DELETE FROM images WHERE id = ?').run(id);
        return result.changes > 0;
      });

      const deleted = deleteTransaction();

      if (deleted) {
        // 3. 清理磁盘文件
        deleteSourceFile(filepath);
        clearImageCache(filepath);
        return { success: true };
      }

      return { success: false };
    });

    if (result.notFound) {
      return errorResponse('Image not found', 404);
    }

    if (!result.success) {
      return errorResponse('Failed to delete record', 500);
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
  const body = await parseJsonBody<UpdatePromptBody>(request);
  if (!body) {
    return errorResponse('Invalid JSON', 400);
  }

  const { prompt } = body;

  // 验证参数
  if (typeof prompt !== 'string') {
    return errorResponse('Prompt must be a string', 400);
  }

  try {
    const result = await withDatabase((db) => {
      const updateStmt = db.prepare('UPDATE images SET prompt = ? WHERE id = ?');
      const updateResult = updateStmt.run(prompt, id);
      return updateResult.changes > 0;
    });

    if (!result) {
      return errorResponse('Image not found', 404);
    }

    return NextResponse.json({ success: true, prompt });
  } catch (error: unknown) {
    console.error('Error updating image:', error);
    return errorResponse('Failed to update image', 500, getErrorMessage(error));
  }
}
