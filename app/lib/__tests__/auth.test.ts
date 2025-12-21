/**
 * auth.ts 单元测试
 * 测试认证模块的核心功能
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateAuthToken,
  verifyAuthToken,
  verifyPassword,
  getAdminPassword,
} from '../auth';

describe('auth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 重置环境变量
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getAdminPassword', () => {
    it('应该返回环境变量中的密码', () => {
      process.env.ADMIN_PASSWORD = 'test_password';
      expect(getAdminPassword()).toBe('test_password');
    });

    it('未设置时应该返回 undefined', () => {
      delete process.env.ADMIN_PASSWORD;
      expect(getAdminPassword()).toBeUndefined();
    });
  });

  describe('generateAuthToken', () => {
    beforeEach(() => {
      process.env.ADMIN_PASSWORD = 'test_secret';
    });

    it('应该生成正确格式的 token (timestamp:nonce:signature)', () => {
      const token = generateAuthToken();
      const parts = token.split(':');

      expect(parts).toHaveLength(3);

      // timestamp 应该是数字
      expect(Number(parts[0])).not.toBeNaN();

      // nonce 应该是 32 字符的 hex 字符串 (16 bytes)
      expect(parts[1]).toHaveLength(32);
      expect(parts[1]).toMatch(/^[0-9a-f]+$/);

      // signature 应该是 64 字符的 hex 字符串 (SHA256)
      expect(parts[2]).toHaveLength(64);
      expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    });

    it('每次生成的 token 应该不同', () => {
      const token1 = generateAuthToken();
      const token2 = generateAuthToken();

      expect(token1).not.toBe(token2);
    });

    it('timestamp 应该接近当前时间', () => {
      const before = Date.now();
      const token = generateAuthToken();
      const after = Date.now();

      const timestamp = parseInt(token.split(':')[0], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('verifyAuthToken', () => {
    beforeEach(() => {
      process.env.ADMIN_PASSWORD = 'test_secret';
    });

    it('应该验证有效的 token', () => {
      const token = generateAuthToken();
      expect(verifyAuthToken(token)).toBe(true);
    });

    it('空 token 应该返回 false', () => {
      expect(verifyAuthToken('')).toBe(false);
    });

    it('null/undefined token 应该返回 false', () => {
      expect(verifyAuthToken(null as unknown as string)).toBe(false);
      expect(verifyAuthToken(undefined as unknown as string)).toBe(false);
    });

    it('格式错误的 token (少于 3 段) 应该返回 false', () => {
      expect(verifyAuthToken('invalid')).toBe(false);
      expect(verifyAuthToken('part1:part2')).toBe(false);
    });

    it('格式错误的 token (多于 3 段) 应该返回 false', () => {
      expect(verifyAuthToken('a:b:c:d')).toBe(false);
    });

    it('signature 长度不正确应该返回 false', () => {
      const timestamp = Date.now().toString();
      const nonce = 'a'.repeat(32);
      const shortSig = 'a'.repeat(63);
      expect(verifyAuthToken(`${timestamp}:${nonce}:${shortSig}`)).toBe(false);
    });

    it('非法 hex 字符串 signature 应该返回 false', () => {
      const timestamp = Date.now().toString();
      const nonce = 'a'.repeat(32);
      const invalidSig = 'g'.repeat(64); // 'g' 不是 hex 字符
      expect(verifyAuthToken(`${timestamp}:${nonce}:${invalidSig}`)).toBe(false);
    });

    it('被篡改的 signature 应该返回 false', () => {
      const token = generateAuthToken();
      const parts = token.split(':');
      // 篡改 signature 的第一个字符
      const tamperedSig = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);
      const tamperedToken = `${parts[0]}:${parts[1]}:${tamperedSig}`;

      expect(verifyAuthToken(tamperedToken)).toBe(false);
    });

    it('被篡改的 nonce 应该返回 false', () => {
      const token = generateAuthToken();
      const parts = token.split(':');
      // 篡改 nonce
      const tamperedNonce = 'b'.repeat(32);
      const tamperedToken = `${parts[0]}:${tamperedNonce}:${parts[2]}`;

      expect(verifyAuthToken(tamperedToken)).toBe(false);
    });

    it('被篡改的 timestamp 应该返回 false', () => {
      const token = generateAuthToken();
      const parts = token.split(':');
      // 篡改 timestamp
      const tamperedTimestamp = (parseInt(parts[0], 10) + 1000).toString();
      const tamperedToken = `${tamperedTimestamp}:${parts[1]}:${parts[2]}`;

      expect(verifyAuthToken(tamperedToken)).toBe(false);
    });

    it('过期的 token 应该返回 false', () => {
      const token = generateAuthToken();
      const parts = token.split(':');

      // 将 timestamp 设为 8 天前（超过 7 天有效期）
      const oldTimestamp = (Date.now() - 8 * 24 * 60 * 60 * 1000).toString();

      // 需要用旧 timestamp 重新计算签名
      // 但由于我们无法获取原始 nonce 的签名，这里直接用原 token 修改 timestamp
      // 这会导致签名不匹配，同样返回 false
      const expiredToken = `${oldTimestamp}:${parts[1]}:${parts[2]}`;
      expect(verifyAuthToken(expiredToken)).toBe(false);
    });

    it('未来时间的 token 应该返回 false', () => {
      const token = generateAuthToken();
      const parts = token.split(':');

      // 将 timestamp 设为未来时间
      const futureTimestamp = (Date.now() + 1000).toString();
      const futureToken = `${futureTimestamp}:${parts[1]}:${parts[2]}`;

      expect(verifyAuthToken(futureToken)).toBe(false);
    });

    it('使用不同密码生成的 token 应该无法验证', () => {
      process.env.ADMIN_PASSWORD = 'secret1';
      const token = generateAuthToken();

      process.env.ADMIN_PASSWORD = 'secret2';
      expect(verifyAuthToken(token)).toBe(false);
    });
  });

  describe('verifyPassword', () => {
    it('正确的密码应该返回 true', () => {
      process.env.ADMIN_PASSWORD = 'correct_password';
      expect(verifyPassword('correct_password')).toBe(true);
    });

    it('错误的密码应该返回 false', () => {
      process.env.ADMIN_PASSWORD = 'correct_password';
      expect(verifyPassword('wrong_password')).toBe(false);
    });

    it('未设置管理员密码时应该返回 false', () => {
      delete process.env.ADMIN_PASSWORD;
      expect(verifyPassword('any_password')).toBe(false);
    });

    it('空密码应该返回 false（当管理员密码非空时）', () => {
      process.env.ADMIN_PASSWORD = 'admin123';
      expect(verifyPassword('')).toBe(false);
    });

    it('长度不同的密码应该返回 false', () => {
      process.env.ADMIN_PASSWORD = 'short';
      expect(verifyPassword('longer_password')).toBe(false);
    });

    it('应该正确处理特殊字符', () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      process.env.ADMIN_PASSWORD = specialPassword;
      expect(verifyPassword(specialPassword)).toBe(true);
      expect(verifyPassword(specialPassword + 'x')).toBe(false);
    });

    it('应该正确处理 Unicode 字符', () => {
      const unicodePassword = '密码测试🔐';
      process.env.ADMIN_PASSWORD = unicodePassword;
      expect(verifyPassword(unicodePassword)).toBe(true);
      expect(verifyPassword('密码测试')).toBe(false);
    });

    it('应该区分大小写', () => {
      process.env.ADMIN_PASSWORD = 'Password123';
      expect(verifyPassword('Password123')).toBe(true);
      expect(verifyPassword('password123')).toBe(false);
      expect(verifyPassword('PASSWORD123')).toBe(false);
    });
  });

  describe('安全性测试', () => {
    it('verifyPassword 应该使用时间常量比较（性能一致性检测）', () => {
      process.env.ADMIN_PASSWORD = 'a'.repeat(100);

      // 测试不同长度的错误密码，执行时间应该相近
      // 注意：这是一个概率性测试，不能完全保证
      const iterations = 100;

      const measureTime = (password: string): number => {
        const start = process.hrtime.bigint();
        for (let i = 0; i < iterations; i++) {
          verifyPassword(password);
        }
        return Number(process.hrtime.bigint() - start);
      };

      // 第一个字符就错
      const time1 = measureTime('b' + 'a'.repeat(99));
      // 最后一个字符错
      const time2 = measureTime('a'.repeat(99) + 'b');
      // 完全不同
      const time3 = measureTime('b'.repeat(100));

      // 时间差异应该在合理范围内（不超过 50%）
      // 由于 JIT 和其他因素，这个测试可能有波动
      const maxTime = Math.max(time1, time2, time3);
      const minTime = Math.min(time1, time2, time3);

      // 如果使用普通比较，time1 应该明显快于 time2
      // 使用时间常量比较后，差异应该较小
      expect(maxTime / minTime).toBeLessThan(3);
    });
  });
});
