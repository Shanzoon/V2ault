/**
 * 数据库初始化脚本
 * 创建表结构和索引
 *
 * 使用方法:
 *   npx tsx scripts/init-db.ts
 */
import Database from 'better-sqlite3';
import { IMAGE_DB_PATH } from './config';

console.log(`初始化数据库: ${IMAGE_DB_PATH}`);

const db = new Database(IMAGE_DB_PATH);

const createTableQuery = `
CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    filepath TEXT UNIQUE,
    prompt TEXT,
    negative_prompt TEXT,
    width INTEGER,
    height INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const createIndexCreatedAt = `CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);`;
const createIndexPrompt = `CREATE INDEX IF NOT EXISTS idx_images_prompt ON images(prompt);`;

try {
  // 开启 WAL 模式
  db.pragma('journal_mode = WAL');
  // 同步模式设为 NORMAL
  db.pragma('synchronous = NORMAL');

  // 创建表
  db.exec(createTableQuery);

  // 创建索引
  db.exec(createIndexCreatedAt);
  db.exec(createIndexPrompt);

  // 整理数据库
  db.exec('VACUUM;');

  console.log('数据库初始化成功 (WAL 模式已启用)');
} catch (error) {
  console.error('数据库初始化失败:', error);
  process.exit(1);
} finally {
  db.close();
}
