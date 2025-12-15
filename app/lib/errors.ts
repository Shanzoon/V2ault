import { NextResponse } from 'next/server';

// 错误代码常量
export const ERROR_CODES = {
  DB_NOT_FOUND: 'DB_NOT_FOUND',
  DB_NOT_INITIALIZED: 'DB_NOT_INITIALIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * 统一的错误响应格式
 */
export function errorResponse(message: string, status: number, details?: string, code?: ErrorCode) {
  return NextResponse.json(
    { error: message, ...(details && { details }), ...(code && { code }) },
    { status }
  );
}

/**
 * 安全解析 JSON 请求体
 * @returns 解析后的对象，失败返回 null
 */
export async function parseJsonBody<T = unknown>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}

/**
 * 从 Error 对象获取消息
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}
