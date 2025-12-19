// 常量和配置
export {
  IMAGE_DB_PATH,
  DB_PATH,
  CACHE_DIR,
  IMAGE_ROOTS,
  UPLOAD_DIR,
  UPLOAD_MAX_SIZE,
  UPLOAD_MAX_FILES,
  windowsToWslPath,
  wslToWindowsPath,
  normalizePath,
  RESOLUTION_THRESHOLDS,
  DEFAULT_PAGE_SIZE,
  THUMBNAIL_QUALITY,
  CACHE_MAX_AGE,
} from './constants';

// 数据库
export { getDatabase, withDatabase, withDatabaseSync, DatabaseError, checkDatabaseStatus } from './db';

// 错误处理
export { errorResponse, parseJsonBody, getErrorMessage, ERROR_CODES, type ErrorCode } from './errors';

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

// 文件工具
export { findActualFilePath } from './file-utils';
