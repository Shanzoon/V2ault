/**
 * 阿里云 OSS 客户端模块
 * 提供图片上传、获取、删除等功能
 */
import OSS from 'ali-oss';

// ============================================
// OSS 配置
// ============================================

const OSS_CONFIG = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  bucket: process.env.OSS_BUCKET || '',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  endpoint: process.env.OSS_ENDPOINT || '',
};

// 验证必要的配置
function validateConfig(): void {
  const required = ['bucket', 'accessKeyId', 'accessKeySecret'] as const;
  const missing = required.filter((key) => !OSS_CONFIG[key]);
  if (missing.length > 0) {
    throw new Error(`Missing OSS configuration: ${missing.join(', ')}`);
  }
}

// ============================================
// OSS 客户端单例
// ============================================

let ossClient: OSS | null = null;

/**
 * 获取 OSS 客户端实例
 */
export function getOssClient(): OSS {
  if (!ossClient) {
    validateConfig();
    ossClient = new OSS({
      region: OSS_CONFIG.region,
      bucket: OSS_CONFIG.bucket,
      accessKeyId: OSS_CONFIG.accessKeyId,
      accessKeySecret: OSS_CONFIG.accessKeySecret,
      // 如果配置了自定义 endpoint，使用它
      ...(OSS_CONFIG.endpoint && { endpoint: OSS_CONFIG.endpoint }),
    });
  }
  return ossClient;
}

// ============================================
// OSS 操作函数
// ============================================

/**
 * 上传文件到 OSS
 * @param ossKey 对象键名 (路径)
 * @param buffer 文件内容
 * @param contentType 内容类型
 * @returns 上传结果，包含 URL
 */
export async function uploadToOss(
  ossKey: string,
  buffer: Buffer,
  contentType: string = 'image/webp'
): Promise<{ url: string; ossKey: string }> {
  const client = getOssClient();

  const result = await client.put(ossKey, buffer, {
    headers: {
      'Content-Type': contentType,
      // 设置缓存控制，图片可以缓存较长时间
      'Cache-Control': 'public, max-age=31536000',
    },
  });

  return {
    url: result.url,
    ossKey: ossKey,
  };
}

/**
 * 生成签名 URL（用于私有 bucket 访问）
 * @param ossKey 对象键名
 * @param expires 过期时间（秒），默认 1 小时
 * @returns 签名后的 URL
 */
export function getSignedUrl(ossKey: string, expires: number = 3600): string {
  const client = getOssClient();
  return client.signatureUrl(ossKey, { expires });
}

/**
 * 获取公开访问 URL
 * @param ossKey 对象键名
 * @returns 公开 URL
 */
export function getPublicUrl(ossKey: string): string {
  const bucket = OSS_CONFIG.bucket;
  const region = OSS_CONFIG.region;
  // 标准格式: https://{bucket}.{region}.aliyuncs.com/{ossKey}
  return `https://${bucket}.${region}.aliyuncs.com/${ossKey}`;
}

/**
 * 生成带图片处理参数的 URL
 * 使用阿里云 OSS 图片处理服务
 * @param ossKey 对象键名
 * @param width 目标宽度
 * @param quality 图片质量 (1-100)
 * @returns 处理后的图片 URL（签名 URL，支持私有 bucket）
 */
export function getProcessedImageUrl(
  ossKey: string,
  width?: number,
  quality: number = 80
): string {
  const client = getOssClient();

  // 如果不需要处理，返回签名 URL
  if (!width) {
    // 签名 URL 有效期 1 小时
    return client.signatureUrl(ossKey, { expires: 3600 });
  }

  // 使用 OSS 图片处理服务 + 签名 URL
  // 文档: https://help.aliyun.com/document_detail/44688.html
  const processParams = [
    'image',
    `resize,w_${width}`,
    `quality,q_${quality}`,
    'format,webp', // 自动转换为 WebP 格式
  ].join('/');

  // 签名 URL 带图片处理参数
  return client.signatureUrl(ossKey, {
    expires: 3600, // 1 小时
    process: processParams,
  });
}

/**
 * 删除 OSS 对象
 * @param ossKey 对象键名
 */
export async function deleteFromOss(ossKey: string): Promise<void> {
  const client = getOssClient();
  await client.delete(ossKey);
}

/**
 * 批量删除 OSS 对象
 * @param ossKeys 对象键名数组
 */
export async function batchDeleteFromOss(ossKeys: string[]): Promise<void> {
  if (ossKeys.length === 0) return;

  const client = getOssClient();
  // OSS 批量删除 API，每次最多删除 1000 个
  const batchSize = 1000;
  for (let i = 0; i < ossKeys.length; i += batchSize) {
    const batch = ossKeys.slice(i, i + batchSize);
    await client.deleteMulti(batch, { quiet: true });
  }
}

/**
 * 检查 OSS 对象是否存在
 * @param ossKey 对象键名
 * @returns 是否存在
 */
export async function ossObjectExists(ossKey: string): Promise<boolean> {
  try {
    const client = getOssClient();
    await client.head(ossKey);
    return true;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'NoSuchKey') {
      return false;
    }
    throw error;
  }
}

/**
 * 生成唯一的 OSS 对象键名
 * 格式: images/{年}/{月}/{清理后的文件名}_{时间戳}_{随机串}.webp
 * @param originalName 原始文件名
 * @returns OSS 对象键名
 */
export function generateOssKey(originalName: string): string {
  const ext = '.webp';
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  // 清理文件名中的特殊字符
  const cleanName = baseName.replace(/[^\w\u4e00-\u9fa5-]/g, '_').slice(0, 50);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `images/${year}/${month}/${cleanName}_${timestamp}_${randomStr}${ext}`;
}
