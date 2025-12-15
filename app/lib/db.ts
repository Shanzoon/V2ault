import Database from 'better-sqlite3';
import fs from 'node:fs';
import { DB_PATH } from './constants';
import { ERROR_CODES, type ErrorCode } from './errors';

// 自定义数据库错误类
export class DatabaseError extends Error {
  code: ErrorCode;

  constructor(message: string, code: ErrorCode) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
  }
}

/**
 * 检查数据库状态
 */
export function checkDatabaseStatus(): { exists: boolean; initialized: boolean } {
  const exists = fs.existsSync(DB_PATH);
  if (!exists) {
    return { exists: false, initialized: false };
  }

  // 检查表是否存在
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='images'"
    ).get();
    db.close();
    return { exists: true, initialized: !!tableCheck };
  } catch {
    return { exists: true, initialized: false };
  }
}

/**
 * 获取数据库连接（带状态检查）
 * @param readonly 是否只读模式
 * @throws DatabaseError 如果数据库不存在或未初始化
 */
export function getDatabase(readonly = false): Database.Database {
  const status = checkDatabaseStatus();

  if (!status.exists) {
    throw new DatabaseError(
      '数据库文件不存在，请先运行 npm run db:init 初始化数据库',
      ERROR_CODES.DB_NOT_FOUND
    );
  }

  if (!status.initialized) {
    throw new DatabaseError(
      '数据库未初始化，请先运行 npm run db:init 创建表结构',
      ERROR_CODES.DB_NOT_INITIALIZED
    );
  }

  return new Database(DB_PATH, readonly ? { readonly: true } : undefined);
}

/**
 * 自动管理数据库连接的高阶函数
 * 确保数据库连接在操作完成后自动关闭
 *
 * @param fn 数据库操作函数
 * @param readonly 是否只读模式
 * @returns 操作结果
 *
 * @example
 * const images = await withDatabase((db) => {
 *   return db.prepare('SELECT * FROM images').all();
 * }, true);
 */
export async function withDatabase<T>(
  fn: (db: Database.Database) => T | Promise<T>,
  readonly = false
): Promise<T> {
  const db = getDatabase(readonly);
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

/**
 * 同步版本的数据库操作包装器
 * 用于不需要异步的简单查询
 */
export function withDatabaseSync<T>(
  fn: (db: Database.Database) => T,
  readonly = false
): T {
  const db = getDatabase(readonly);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
