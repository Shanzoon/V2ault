/**
 * 数据库初始化脚本
 * 创建表结构、索引，并自动迁移旧数据库
 *
 * 功能:
 *   - 新数据库: 创建完整表结构
 *   - 旧数据库: 自动添加缺失的列
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    filesize INTEGER,
    imported_at INTEGER,
    source TEXT,
    model_base_id INTEGER,
    model_base TEXT,
    style TEXT,
    style_ref TEXT,
    blurhash TEXT,
    dominant_color TEXT,
    like_count INTEGER NOT NULL DEFAULT 0,
    favorite INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER DEFAULT NULL
);
`;

const createIndexCreatedAt = `CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);`;
const createIndexPrompt = `CREATE INDEX IF NOT EXISTS idx_images_prompt ON images(prompt);`;
const createIndexDeletedAt = `CREATE INDEX IF NOT EXISTS idx_images_deleted_at ON images(deleted_at);`;

try {
  // 开启 WAL 模式
  db.pragma('journal_mode = WAL');
  // 同步模式设为 NORMAL
  db.pragma('synchronous = NORMAL');

  // 创建表
  db.exec(createTableQuery);

  // 迁移旧数据库：检查并添加缺失的列
  const columns = db.prepare("PRAGMA table_info(images)").all() as { name: string }[];
  const columnNames = new Set(columns.map(col => col.name));

  const migrations: { name: string; sql: string }[] = [
    { name: 'model_base', sql: 'ALTER TABLE images ADD COLUMN model_base TEXT' },
    { name: 'style_ref', sql: 'ALTER TABLE images ADD COLUMN style_ref TEXT' },
    { name: 'deleted_at', sql: 'ALTER TABLE images ADD COLUMN deleted_at INTEGER DEFAULT NULL' },
  ];

  for (const migration of migrations) {
    if (!columnNames.has(migration.name)) {
      db.exec(migration.sql);
      console.log(`已添加列: ${migration.name}`);
    }
  }

  // 创建索引
  db.exec(createIndexCreatedAt);
  db.exec(createIndexPrompt);
  db.exec(createIndexDeletedAt);

  // 整理数据库
  db.exec('VACUUM;');

  console.log('数据库初始化成功 (WAL 模式已启用)');
} catch (error) {
  console.error('数据库初始化失败:', error);
  process.exit(1);
} finally {
  db.close();
}
