// 常量和配置
export {
  IMAGE_DB_PATH,
  DB_PATH,
  CACHE_DIR,
  IMAGE_ROOTS,
  windowsToWslPath,
  wslToWindowsPath,
  normalizePath,
  RESOLUTION_THRESHOLDS,
  DEFAULT_PAGE_SIZE,
  THUMBNAIL_QUALITY,
  CACHE_MAX_AGE,
} from './constants';

// 数据库
export { getDatabase, withDatabase, withDatabaseSync } from './db';

// 错误处理
export { errorResponse, parseJsonBody, getErrorMessage } from './errors';

// 缓存
export {
  getFileHash,
  getCachePath,
  ensureCacheDir,
  cacheExists,
  readCache,
  writeCache,
  clearImageCache,
  deleteSourceFile,
} from './cache';
