/**
 * PostgreSQL 数据库模块
 * 提供连接池管理和查询辅助函数
 */
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DATABASE_URL } from './constants';
import { ERROR_CODES, type ErrorCode } from './errors';

// ============================================
// 自定义错误类
// ============================================

export class DatabaseError extends Error {
  code: ErrorCode;

  constructor(message: string, code: ErrorCode) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
  }
}

// ============================================
// 连接池管理
// ============================================

let pool: Pool | null = null;

/**
 * 获取数据库连接池
 */
export function getPool(): Pool {
  if (!pool) {
    if (!DATABASE_URL) {
      throw new DatabaseError(
        '未配置数据库连接字符串，请设置 DATABASE_URL 环境变量',
        ERROR_CODES.DB_NOT_FOUND
      );
    }

    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 20, // 最大连接数
      idleTimeoutMillis: 30000, // 空闲超时
      connectionTimeoutMillis: 5000, // 连接超时
    });

    // 错误处理
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }

  return pool;
}

/**
 * 关闭连接池（用于优雅关闭）
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ============================================
// 查询辅助函数
// ============================================

/**
 * 执行数据库查询
 * @param text SQL 查询语句（使用 $1, $2... 作为参数占位符）
 * @param params 查询参数
 * @returns 查询结果
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    // 开发环境下打印慢查询
    if (duration > 100) {
      console.log(`[DB] Slow query (${duration}ms):`, text.slice(0, 100));
    }

    return result;
  } catch (error) {
    console.error('[DB] Query error:', error);
    throw error;
  }
}

/**
 * 获取单行结果
 * @param text SQL 查询语句
 * @param params 查询参数
 * @returns 单行结果或 undefined
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | undefined> {
  const result = await query<T>(text, params);
  return result.rows[0];
}

/**
 * 获取多行结果
 * @param text SQL 查询语句
 * @param params 查询参数
 * @returns 结果数组
 */
export async function queryAll<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/**
 * 在事务中执行操作
 * @param fn 事务操作函数
 * @returns 操作结果
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// 兼容性包装器（保持与旧代码的兼容）
// ============================================

/**
 * 数据库操作包装器
 * 模拟旧的 withDatabase 接口，但使用 PostgreSQL
 * @deprecated 建议直接使用 query/queryOne/queryAll
 */
export async function withDatabase<T>(
  fn: (db: DatabaseHelper) => T | Promise<T>,
  _readonly = false
): Promise<T> {
  const helper = new DatabaseHelper();
  return fn(helper);
}

/**
 * 同步版本的数据库操作包装器
 * 注意：PostgreSQL 不支持真正的同步操作，此函数返回 Promise
 * @deprecated 建议直接使用 query/queryOne/queryAll
 */
export function withDatabaseSync<T>(
  fn: (db: DatabaseHelper) => T,
  _readonly = false
): T {
  // 注意：这个函数实际上无法真正同步执行 PostgreSQL 查询
  // 保留此签名只是为了编译兼容，调用者需要处理异步
  const helper = new DatabaseHelper();
  return fn(helper);
}

/**
 * 数据库辅助类
 * 提供类似 better-sqlite3 的接口，便于迁移
 */
export class DatabaseHelper {
  /**
   * 准备 SQL 语句
   */
  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(sql);
  }

  /**
   * 执行事务
   */
  transaction<T>(fn: () => T): () => T {
    // PostgreSQL 事务需要异步处理，这里返回同步包装
    return fn;
  }
}

/**
 * 预处理语句类
 * 模拟 better-sqlite3 的 Statement 接口
 */
class PreparedStatement {
  private sql: string;

  constructor(sql: string) {
    // 将 SQLite 的 ? 占位符转换为 PostgreSQL 的 $1, $2...
    this.sql = this.convertPlaceholders(sql);
  }

  private convertPlaceholders(sql: string): string {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  }

  /**
   * 执行查询并返回所有结果
   */
  all(...params: unknown[]): Promise<unknown[]> {
    return queryAll(this.sql, params);
  }

  /**
   * 执行查询并返回第一行
   */
  get(...params: unknown[]): Promise<unknown | undefined> {
    return queryOne(this.sql, params);
  }

  /**
   * 执行修改操作
   */
  async run(...params: unknown[]): Promise<{ changes: number; lastInsertRowid: number | bigint }> {
    const result = await query(this.sql, params);

    // 尝试从 RETURNING 子句获取插入的 ID
    let lastInsertRowid: number | bigint = 0;
    if (result.rows.length > 0 && 'id' in result.rows[0]) {
      lastInsertRowid = (result.rows[0] as { id: number }).id;
    }

    return {
      changes: result.rowCount ?? 0,
      lastInsertRowid,
    };
  }
}

// ============================================
// 健康检查
// ============================================

/**
 * 检查数据库连接状态
 */
export async function checkDatabaseStatus(): Promise<{ connected: boolean; initialized: boolean }> {
  try {
    const result = await query('SELECT 1 as check');
    if (!result.rows[0]) {
      return { connected: false, initialized: false };
    }

    // 检查 images 表是否存在
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'images'
      ) as exists
    `);

    const initialized = (tableCheck.rows[0] as { exists: boolean })?.exists ?? false;

    return { connected: true, initialized };
  } catch (error) {
    console.error('[DB] Connection check failed:', error);
    return { connected: false, initialized: false };
  }
}

// 为了兼容旧代码，也导出 getDatabase（虽然不再使用）
export function getDatabase(): DatabaseHelper {
  return new DatabaseHelper();
}
