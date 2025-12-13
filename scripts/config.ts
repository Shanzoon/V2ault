/**
 * 脚本专用配置加载器
 *
 * 由于 ES Module 的 import 会被静态提升，我们需要：
 * 1. 先同步加载 .env.local
 * 2. 然后重新计算配置值（不能依赖 app/lib/config.ts 中的静态导出）
 */
import path from 'node:path';
import { config } from 'dotenv';

// 加载 .env.local
config({ path: path.join(process.cwd(), '.env.local') });

// ============================================
// 路径转换工具（从 app/lib/config.ts 复制）
// ============================================

export function windowsToWslPath(winPath: string): string {
  const match = winPath.match(/^([A-Za-z]):[\\\/](.*)$/);
  if (match) {
    const driveLetter = match[1].toLowerCase();
    const restPath = match[2].replace(/\\/g, '/');
    return `/mnt/${driveLetter}/${restPath}`;
  }
  return winPath;
}

export function wslToWindowsPath(wslPath: string): string {
  const match = wslPath.match(/^\/mnt\/([a-z])\/(.*)$/);
  if (match) {
    const driveLetter = match[1].toUpperCase();
    const restPath = match[2].replace(/\//g, '\\');
    return `${driveLetter}:\\${restPath}`;
  }
  return wslPath;
}

export function normalizePath(p: string): string {
  if (/^[A-Za-z]:[\\\/]/.test(p)) {
    return windowsToWslPath(p);
  }
  return p;
}

// ============================================
// 配置值（在 dotenv 加载后计算）
// ============================================

export const IMAGE_DB_PATH: string = normalizePath(
  process.env.IMAGE_DB_PATH ?? path.join(process.cwd(), 'images.db')
);

export const CACHE_DIR: string = normalizePath(
  process.env.CACHE_DIR ?? path.join(process.cwd(), '..', 'V2ault_cache')
);

export const IMAGE_ROOTS: string[] = (process.env.IMAGE_ROOTS ?? '')
  .split(';')
  .map((p) => p.trim())
  .filter(Boolean)
  .map(normalizePath);

// ============================================
// 调试工具
// ============================================

export function printConfig(): void {
  console.log('=== V2ault Configuration ===');
  console.log(`IMAGE_DB_PATH: ${IMAGE_DB_PATH}`);
  console.log(`CACHE_DIR: ${CACHE_DIR}`);
  console.log(`IMAGE_ROOTS: ${IMAGE_ROOTS.length > 0 ? IMAGE_ROOTS.join(', ') : '(empty)'}`);
  console.log('============================');
}
