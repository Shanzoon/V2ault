import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CACHE_DIR } from './constants';

/**
 * 计算文件路径的 MD5 哈希值
 */
export function getFileHash(filepath: string): string {
  return crypto.createHash('md5').update(filepath).digest('hex');
}

/**
 * 获取缩略图缓存路径
 */
export function getCachePath(filepath: string, width: number): string {
  const hash = getFileHash(filepath);
  return path.join(CACHE_DIR, `${hash}_w${width}.jpg`);
}

/**
 * 确保缓存目录存在
 */
export function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * 检查缓存是否存在
 */
export function cacheExists(cachePath: string): boolean {
  return fs.existsSync(cachePath);
}

/**
 * 读取缓存文件
 */
export function readCache(cachePath: string): Buffer {
  return fs.readFileSync(cachePath);
}

/**
 * 写入缓存文件
 */
export function writeCache(cachePath: string, data: Buffer): void {
  fs.writeFileSync(cachePath, data);
}

/**
 * 清理指定图片的所有缓存
 * @param filepath 原始图片路径
 */
export function clearImageCache(filepath: string): void {
  if (!fs.existsSync(CACHE_DIR)) return;

  const hash = getFileHash(filepath);

  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const file of files) {
      if (file.startsWith(hash)) {
        try {
          fs.unlinkSync(path.join(CACHE_DIR, file));
          console.log(`Deleted cache: ${file}`);
        } catch (e) {
          console.error(`Failed to delete cache ${file}:`, e);
        }
      }
    }
  } catch (e) {
    console.error('Failed to read cache directory:', e);
  }
}

/**
 * 删除源文件（如果存在）
 */
export function deleteSourceFile(filepath: string): boolean {
  if (!fs.existsSync(filepath)) {
    return false;
  }

  try {
    fs.unlinkSync(filepath);
    console.log(`Deleted file: ${filepath}`);
    return true;
  } catch (err) {
    console.error(`Failed to delete file ${filepath}:`, err);
    return false;
  }
}
