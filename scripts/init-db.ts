/**
 * PostgreSQL 数据库初始化脚本
 * 创建表结构和索引
 *
 * 使用方法:
 *   npx tsx scripts/init-db.ts
 */
import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'node:path';

// 加载环境变量
config({ path: path.join(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('错误: 未配置 DATABASE_URL 环境变量');
  process.exit(1);
}

console.log('正在连接数据库...');

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function initDatabase() {
  const client = await pool.connect();

  try {
    console.log('数据库连接成功');

    // 创建 images 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        filename TEXT,
        filepath TEXT UNIQUE,
        oss_key TEXT,
        prompt TEXT,
        negative_prompt TEXT,
        width INTEGER,
        height INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    `);
    console.log('✓ images 表已创建/确认存在');

    // 创建索引
    const indexes = [
      { name: 'idx_images_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC)' },
      { name: 'idx_images_prompt', sql: 'CREATE INDEX IF NOT EXISTS idx_images_prompt ON images(prompt)' },
      { name: 'idx_images_deleted_at', sql: 'CREATE INDEX IF NOT EXISTS idx_images_deleted_at ON images(deleted_at)' },
      { name: 'idx_images_oss_key', sql: 'CREATE INDEX IF NOT EXISTS idx_images_oss_key ON images(oss_key)' },
      { name: 'idx_images_source', sql: 'CREATE INDEX IF NOT EXISTS idx_images_source ON images(source)' },
      { name: 'idx_images_style', sql: 'CREATE INDEX IF NOT EXISTS idx_images_style ON images(style)' },
      { name: 'idx_images_model_base', sql: 'CREATE INDEX IF NOT EXISTS idx_images_model_base ON images(model_base)' },
    ];

    for (const index of indexes) {
      await client.query(index.sql);
      console.log(`✓ 索引 ${index.name} 已创建/确认存在`);
    }

    // 检查是否需要添加新列（迁移支持）
    const columnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'images' AND table_schema = 'public'
    `);

    const existingColumns = new Set(columnsResult.rows.map(r => r.column_name));

    const migrations: { name: string; sql: string }[] = [
      { name: 'oss_key', sql: 'ALTER TABLE images ADD COLUMN oss_key TEXT' },
      { name: 'deleted_at', sql: 'ALTER TABLE images ADD COLUMN deleted_at INTEGER DEFAULT NULL' },
      { name: 'model_base', sql: 'ALTER TABLE images ADD COLUMN model_base TEXT' },
      { name: 'style_ref', sql: 'ALTER TABLE images ADD COLUMN style_ref TEXT' },
    ];

    for (const migration of migrations) {
      if (!existingColumns.has(migration.name)) {
        await client.query(migration.sql);
        console.log(`✓ 已添加列: ${migration.name}`);
      }
    }

    console.log('\n数据库初始化成功！');

  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase().catch((err) => {
  console.error(err);
  process.exit(1);
});
