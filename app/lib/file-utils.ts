/**
 * 文件路径工具函数
 * 用于查找文件的实际路径（支持多个搜索目录）
 */
import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from './config';

/**
 * 定义搜索目录列表
 * 这些目录对应建立的软链接或实际存储位置
 */
const SEARCH_DIRS = [
  UPLOAD_DIR,         // 上传目录（绝对路径）
  'public/images',    // H 盘
  'public/comfy',     // F 盘
  'public/desktop',   // D 盘
];

/**
 * 查找文件的实际路径
 * @param originalFilepath 数据库中存储的原始路径
 * @returns 实际可访问的文件路径，找不到返回 null
 */
export function findActualFilePath(originalFilepath: string): string | null {
  const filename = originalFilepath.split(/[/\\]/).pop();
  if (!filename) return null;

  for (const dirName of SEARCH_DIRS) {
    const potentialPath = path.isAbsolute(dirName)
      ? path.join(dirName, filename)
      : path.join(process.cwd(), dirName, filename);

    if (fs.existsSync(potentialPath)) {
      return potentialPath;
    }
  }

  return null;
}
