/**
 * db.ts 单元测试
 * 测试数据库模块的核心功能
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock constants 模块，在 db 导入之前
vi.mock('../constants', () => ({
  DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
}));

// Mock pg 模块
const mockQuery = vi.fn();
const mockConnect = vi.fn();
const mockEnd = vi.fn();
const mockOn = vi.fn();
const mockRelease = vi.fn();

vi.mock('pg', () => {
  const MockPool = vi.fn(() => ({
    query: mockQuery,
    connect: mockConnect,
    end: mockEnd,
    on: mockOn,
  }));

  return { Pool: MockPool };
});

// 在 mock 之后导入
import {
  getPool,
  closePool,
  query,
  queryOne,
  queryAll,
  withTransaction,
  checkDatabaseStatus,
  DatabaseError,
} from '../db';
import { Pool } from 'pg';

describe('db', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // 清理连接池状态
    await closePool();
  });

  describe('DatabaseError', () => {
    it('应该正确创建错误对象', () => {
      const error = new DatabaseError('Test error', 'DB_NOT_FOUND');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('DB_NOT_FOUND');
      expect(error.name).toBe('DatabaseError');
    });

    it('应该支持不同的错误代码', () => {
      const error1 = new DatabaseError('Error 1', 'DB_NOT_FOUND');
      const error2 = new DatabaseError('Error 2', 'DB_NOT_INITIALIZED');
      const error3 = new DatabaseError('Error 3', 'INTERNAL_ERROR');

      expect(error1.code).toBe('DB_NOT_FOUND');
      expect(error2.code).toBe('DB_NOT_INITIALIZED');
      expect(error3.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('getPool', () => {
    it('配置正确时应该创建连接池', () => {
      const pool = getPool();
      expect(pool).toBeDefined();
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgresql://test:test@localhost:5432/testdb',
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        })
      );
    });

    it('应该返回单例连接池', () => {
      const pool1 = getPool();
      const pool2 = getPool();

      expect(pool1).toBe(pool2);
    });
  });

  describe('query', () => {
    it('应该执行查询并返回结果', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await query('SELECT * FROM test');

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM test', undefined);
      expect(result).toEqual(mockResult);
    });

    it('应该支持参数化查询', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValueOnce(mockResult);

      await query('SELECT * FROM test WHERE id = $1', [1]);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
    });

    it('查询错误时应该抛出异常', async () => {
      const error = new Error('Query failed');
      mockQuery.mockRejectedValueOnce(error);

      await expect(query('INVALID SQL')).rejects.toThrow('Query failed');
    });
  });

  describe('queryOne', () => {
    it('有结果时应该返回第一行', async () => {
      const mockResult = {
        rows: [{ id: 1 }, { id: 2 }],
        rowCount: 2,
      };

      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await queryOne('SELECT * FROM test');

      expect(result).toEqual({ id: 1 });
    });

    it('无结果时应该返回 undefined', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await queryOne('SELECT * FROM test WHERE id = 999');

      expect(result).toBeUndefined();
    });
  });

  describe('queryAll', () => {
    it('应该返回所有结果行', async () => {
      const mockResult = {
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
        rowCount: 3,
      };

      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await queryAll('SELECT * FROM test');

      expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('无结果时应该返回空数组', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await queryAll('SELECT * FROM test WHERE 1=0');

      expect(result).toEqual([]);
    });
  });

  describe('withTransaction', () => {
    it('成功时应该提交事务', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({}),
        release: vi.fn(),
      };

      mockConnect.mockResolvedValueOnce(mockClient);

      const result = await withTransaction(async (client) => {
        await client.query('INSERT INTO test VALUES (1)');
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('INSERT INTO test VALUES (1)');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('失败时应该回滚事务', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({}),
        release: vi.fn(),
      };

      mockConnect.mockResolvedValueOnce(mockClient);

      const error = new Error('Transaction failed');

      await expect(
        withTransaction(async () => {
          throw error;
        })
      ).rejects.toThrow('Transaction failed');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('应该始终释放连接', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({}),
        release: vi.fn(),
      };

      mockConnect.mockResolvedValueOnce(mockClient);

      try {
        await withTransaction(async () => {
          throw new Error('Test error');
        });
      } catch {
        // 忽略错误
      }

      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkDatabaseStatus', () => {
    it('连接成功且表存在时应该返回正确状态', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ check: 1 }] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] });

      const status = await checkDatabaseStatus();

      expect(status).toEqual({ connected: true, initialized: true });
    });

    it('连接成功但表不存在时应该返回 initialized: false', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ check: 1 }] })
        .mockResolvedValueOnce({ rows: [{ exists: false }] });

      const status = await checkDatabaseStatus();

      expect(status).toEqual({ connected: true, initialized: false });
    });

    it('连接失败时应该返回 connected: false', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'));

      const status = await checkDatabaseStatus();

      expect(status).toEqual({ connected: false, initialized: false });
    });

    it('第一个查询返回空结果时应该返回 connected: false', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const status = await checkDatabaseStatus();

      expect(status).toEqual({ connected: false, initialized: false });
    });
  });

  describe('closePool', () => {
    it('应该关闭连接池', async () => {
      // 先创建连接池
      getPool();

      await closePool();

      expect(mockEnd).toHaveBeenCalled();
    });

    it('连接池未创建时不应该报错', async () => {
      // 确保 pool 为 null
      await closePool();

      // 再次关闭不应该报错
      await expect(closePool()).resolves.not.toThrow();
    });
  });
});
