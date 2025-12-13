/**
 * 统一配置模块
 * 所有路径配置都从环境变量读取，提供合理的默认值
 */
import path from 'node:path';

// ============================================
// 路径转换工具
// ============================================

/**
 * 将 Windows 路径 (D:\xxx) 转换为 WSL 路径 (/mnt/d/xxx)
 */
export function windowsToWslPath(winPath: string): string {
  const match = winPath.match(/^([A-Za-z]):[\\\/](.*)$/);
  if (match) {
    const driveLetter = match[1].toLowerCase();
    const restPath = match[2].replace(/\\/g, '/');
    return `/mnt/${driveLetter}/${restPath}`;
  }
  return winPath;
}

/**
 * 将 WSL 路径 (/mnt/d/xxx) 转换为 Windows 路径 (D:\xxx)
 */
export function wslToWindowsPath(wslPath: string): string {
  const match = wslPath.match(/^\/mnt\/([a-z])\/(.*)$/);
  if (match) {
    const driveLetter = match[1].toUpperCase();
    const restPath = match[2].replace(/\//g, '\\');
    return `${driveLetter}:\\${restPath}`;
  }
  return wslPath;
}

/**
 * 规范化路径为 WSL 格式（统一使用 /mnt/x/ 格式）
 */
export function normalizePath(p: string): string {
  // 如果是 Windows 路径，转换为 WSL
  if (/^[A-Za-z]:[\\\/]/.test(p)) {
    return windowsToWslPath(p);
  }
  return p;
}

// ============================================
// 环境变量读取
// ============================================

/**
 * 数据库文件路径
 * 环境变量: IMAGE_DB_PATH
 * 默认值: ./images.db (项目根目录)
 */
export const IMAGE_DB_PATH: string = normalizePath(
  process.env.IMAGE_DB_PATH ?? path.join(process.cwd(), 'images.db')
);

/**
 * 缩略图缓存目录
 * 环境变量: CACHE_DIR
 * 默认值: ../V2ault_cache (项目上一层)
 */
export const CACHE_DIR: string = normalizePath(
  process.env.CACHE_DIR ?? path.join(process.cwd(), '..', 'V2ault_cache')
);

/**
 * 图片根目录列表（分号分隔）
 * 环境变量: IMAGE_ROOTS
 * 默认值: 空数组
 *
 * 示例: IMAGE_ROOTS="/mnt/d/images;/mnt/h/photos"
 */
export const IMAGE_ROOTS: string[] = (process.env.IMAGE_ROOTS ?? '')
  .split(';')
  .map((p) => p.trim())
  .filter(Boolean)
  .map(normalizePath);

// ============================================
// 配置验证（可选，开发时使用）
// ============================================

/**
 * 打印当前配置（调试用）
 */
export function printConfig(): void {
  console.log('=== V2ault Configuration ===');
  console.log(`IMAGE_DB_PATH: ${IMAGE_DB_PATH}`);
  console.log(`CACHE_DIR: ${CACHE_DIR}`);
  console.log(`IMAGE_ROOTS: ${IMAGE_ROOTS.length > 0 ? IMAGE_ROOTS.join(', ') : '(empty)'}`);
  console.log('============================');
}
