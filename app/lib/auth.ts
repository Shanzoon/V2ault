import { cookies } from 'next/headers';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

// Cookie 名称
const AUTH_COOKIE_NAME = 'v2ault_auth';
// Cookie 有效期（7天）
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * 获取管理员密码（从环境变量）
 */
export function getAdminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}

/**
 * 计算 token 签名
 * @param timestamp 时间戳
 * @param nonce 随机数
 * @param secret 密钥
 */
function computeTokenSignature(timestamp: string, nonce: string, secret: string): string {
  return createHash('sha256')
    .update(`${timestamp}:${nonce}:${secret}`)
    .digest('hex');
}

/**
 * 生成认证 token
 * 格式: timestamp:nonce:signature
 */
export function generateAuthToken(): string {
  const timestamp = Date.now().toString();
  const nonce = randomBytes(16).toString('hex');
  const secret = getAdminPassword() || 'default_secret';
  const signature = computeTokenSignature(timestamp, nonce, secret);
  return `${timestamp}:${nonce}:${signature}`;
}

/**
 * 验证认证 token
 * 使用时间常量比较防止定时攻击
 */
export function verifyAuthToken(token: string): boolean {
  if (!token) return false;

  const parts = token.split(':');
  if (parts.length !== 3) return false;

  const [timestamp, nonce, receivedSignature] = parts;

  // 验证格式
  if (!timestamp || !nonce || !receivedSignature) return false;
  if (receivedSignature.length !== 64) return false;

  // Token 过期检查（7天）
  const tokenAge = Date.now() - parseInt(timestamp, 10);
  if (isNaN(tokenAge) || tokenAge > AUTH_COOKIE_MAX_AGE * 1000 || tokenAge < 0) {
    return false;
  }

  // 重新计算签名并进行时间常量比较
  const secret = getAdminPassword() || 'default_secret';
  const expectedSignature = computeTokenSignature(timestamp, nonce, secret);

  try {
    return timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    // Buffer 转换失败（非法 hex 字符串）
    return false;
  }
}

/**
 * 验证密码是否正确
 * 使用时间常量比较防止定时攻击
 */
export function verifyPassword(password: string): boolean {
  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    // 如果没有设置密码，任何密码都不正确
    return false;
  }

  // 长度不同时也要执行比较，防止泄露长度信息
  // 但最终结果要考虑长度是否相同
  const passwordBuf = Buffer.from(password);
  const adminBuf = Buffer.from(adminPassword);

  // 使用较长的长度来分配 buffer，确保两者长度相同
  const maxLen = Math.max(passwordBuf.length, adminBuf.length);
  const paddedPassword = Buffer.alloc(maxLen, 0);
  const paddedAdmin = Buffer.alloc(maxLen, 0);

  passwordBuf.copy(paddedPassword);
  adminBuf.copy(paddedAdmin);

  // 时间常量比较 + 长度检查
  const contentsEqual = timingSafeEqual(paddedPassword, paddedAdmin);
  const lengthsEqual = passwordBuf.length === adminBuf.length;

  return contentsEqual && lengthsEqual;
}

/**
 * 检查请求是否为管理员（服务端）
 */
export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) return false;
  return verifyAuthToken(token);
}

/**
 * 设置认证 cookie
 */
export async function setAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  const token = generateAuthToken();

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  });
}

/**
 * 清除认证 cookie
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

// 导出 cookie 名称供前端使用
export { AUTH_COOKIE_NAME };
