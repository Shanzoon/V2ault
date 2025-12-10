import Database from 'better-sqlite3';
import { DB_PATH } from './constants';

/**
 * 获取数据库连接
 * @param readonly 是否只读模式
 */
export function getDatabase(readonly = false): Database.Database {
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
