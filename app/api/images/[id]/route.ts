import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs'; // 【新增】用于检测文件是否存在
import path from 'node:path'; // 【新增】用于拼接路径
import {
  withDatabase,
  errorResponse,
  parseJsonBody,
  getErrorMessage,
  clearImageCache,
  deleteSourceFile,
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
      // 1. 先查出文件路径
      const row = db.prepare('SELECT filepath FROM images WHERE id = ?').get(id) as
        | { filepath: string }
        | undefined;

      if (!row) {
        return { success: false, notFound: true };
      }

      // 这是数据库里存的原始路径 (例如 H:\Development\...)
      const originalFilepath = row.filepath;
      console.log("数据库原始路径:", originalFilepath);

      // ==================================================
      // 【新增逻辑】自动寻找真实文件路径 (和你 GET 方法里的一样)
      // ==================================================
      let finalPath = '';
      const filename = originalFilepath.split(/[/\\]/).pop(); // 提取文件名

      // 定义搜索目录 (对应你建立的软连接)
      const searchDirs = [
        'public/images',   // H 盘
        'public/comfy',    // F 盘
        'public/desktop',  // D 盘
      ];

      // 遍历寻找
      for (const dirName of searchDirs) {
        const potentialPath = path.join(process.cwd(), dirName, filename || '');
        if (fs.existsSync(potentialPath)) {
          finalPath = potentialPath;
          break; // 找到了就停止
        }
      }

      if (finalPath) {
        console.log("找到真实文件路径:", finalPath);
      } else {
        console.warn("警告: 硬盘上未找到该文件，将只删除数据库记录");
      }
      // ==================================================


      // 2. 事务删除数据库记录
      const deleteTransaction = db.transaction(() => {
        const result = db.prepare('DELETE FROM images WHERE id = ?').run(id);
        return result.changes > 0;
      });

      const deleted = deleteTransaction();

      if (deleted) {
        // 3. 清理磁盘文件
        // 只有当 finalPath 存在 (真的找到了文件) 时才去删文件
        if (finalPath) {
            try {
                // 这里的 deleteSourceFile 可能会报错，如果它内部也是用的 fs.unlink
                // 我们直接传入找到的 Linux 路径
                deleteSourceFile(finalPath);
            } catch (e) {
                console.error("删除物理文件失败 (可能文件已被占用或不存在):", e);
            }
        }
        
        // 清理缓存 (传入最终路径，确保能找到对应的缓存文件)
        // 如果没找到文件，就尝试用原始路径清理，尽人事听天命
        clearImageCache(finalPath || originalFilepath);
        
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