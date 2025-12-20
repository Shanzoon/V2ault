/**
 * 统一配置模块
 * 云服务版本 - 阿里云 RDS PostgreSQL + 阿里云 OSS
 */

// ============================================
// 数据库配置
// ============================================

/**
 * PostgreSQL 数据库连接字符串
 * 环境变量: DATABASE_URL
 * 格式: postgresql://user:password@host:port/database
 */
export const DATABASE_URL = process.env.DATABASE_URL || '';

// ============================================
// 上传限制配置
// ============================================

/**
 * 上传文件大小限制（字节）
 * 环境变量: UPLOAD_MAX_SIZE
 * 默认值: 20971520 (20MB)
 */
export const UPLOAD_MAX_SIZE: number = parseInt(
  process.env.UPLOAD_MAX_SIZE ?? '20971520',
  10
);

/**
 * 单次上传最大文件数量
 * 环境变量: UPLOAD_MAX_FILES
 * 默认值: 500
 */
export const UPLOAD_MAX_FILES: number = parseInt(
  process.env.UPLOAD_MAX_FILES ?? '500',
  10
);
