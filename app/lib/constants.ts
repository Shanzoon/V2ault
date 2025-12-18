// 从 config.ts 导入路径配置
export { IMAGE_DB_PATH, CACHE_DIR, IMAGE_ROOTS, UPLOAD_DIR, UPLOAD_MAX_SIZE, UPLOAD_MAX_FILES } from './config';
export { windowsToWslPath, wslToWindowsPath, normalizePath } from './config';

// 兼容旧代码：DB_PATH 作为 IMAGE_DB_PATH 的别名
export { IMAGE_DB_PATH as DB_PATH } from './config';

// ============================================
// 非路径相关的常量（保持不变）
// ============================================

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

// ============================================
// 分类系统常量
// ============================================

// 模型基底选项
export const MODEL_BASES = [
  'SD系列',
  'Flux.1',
  'Midjourney',
  'Nano-banana',
  'Qwen-image',
  'Z-image',
  'GPT-image 1.5',
  'other',
] as const;

// 风格大类选项
export const STYLE_SOURCES = ['2D', '3D', 'Real'] as const;

// 类型导出
export type ModelBase = typeof MODEL_BASES[number];
export type StyleSource = typeof STYLE_SOURCES[number];

// ============================================
// 多选功能常量
// ============================================

// 框选配置
export const BOX_SELECTION = {
  /** 边缘自动滚动阈值（像素） */
  EDGE_THRESHOLD: 50,
  /** 自动滚动速度（像素/帧） */
  SCROLL_SPEED: 15,
  /** 帧间隔（毫秒，约60fps） */
  FRAME_INTERVAL: 16,
  /** 点击 vs 拖拽判定距离（像素） */
  CLICK_THRESHOLD: 5,
} as const;

// 选中限制
export const SELECTION_LIMITS = {
  /** 最大选中图片数量 */
  MAX_SELECTION: 200,
} as const;
