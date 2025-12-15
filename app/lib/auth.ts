import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'crypto';

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
 * 生成认证 token
 */
export function generateAuthToken(): string {
  const timestamp = Date.now().toString();
  const random = randomBytes(16).toString('hex');
  const secret = getAdminPassword() || 'default_secret';
  const hash = createHash('sha256')
    .update(`${timestamp}:${random}:${secret}`)
    .digest('hex');
  return `${timestamp}:${hash}`;
}

/**
 * 验证认证 token
 */
export function verifyAuthToken(token: string): boolean {
  if (!token) return false;

  const parts = token.split(':');
  if (parts.length !== 2) return false;

  const [timestamp, hash] = parts;
  const tokenAge = Date.now() - parseInt(timestamp, 10);

  // Token 过期检查（7天）
  if (tokenAge > AUTH_COOKIE_MAX_AGE * 1000) {
    return false;
  }

  // 简单验证：检查 hash 长度是否正确
  return hash.length === 64;
}

/**
 * 验证密码是否正确
 */
export function verifyPassword(password: string): boolean {
  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    // 如果没有设置密码，任何密码都不正确
    return false;
  }
  return password === adminPassword;
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
