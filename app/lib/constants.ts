import path from 'path';

// 数据库路径
export const DB_PATH = path.join(process.cwd(), 'images.db');

// 缓存目录
export const CACHE_DIR = path.join(process.cwd(), 'cache');

// 分辨率阈值（像素面积）
export const RESOLUTION_THRESHOLDS = {
  LOW: 393216,      // 512×768
  MEDIUM: 1605632,  // 1024×1568
  HIGH: 2073600,    // 1080×1920
} as const;

// 分页默认值
export const DEFAULT_PAGE_SIZE = 50;

// 缩略图质量
export const THUMBNAIL_QUALITY = 80;

// 缓存时间（1年）
export const CACHE_MAX_AGE = 31536000;
