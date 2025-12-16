/**
 * 数据库迁移脚本：添加 style_ref 列（风格参照/LoRA名称）
 *
 * 使用方法:
 *   npx tsx scripts/migrate-add-style-ref.ts
 */
import Database from 'better-sqlite3';
import { IMAGE_DB_PATH } from './config';

console.log(`迁移数据库: ${IMAGE_DB_PATH}`);

const db = new Database(IMAGE_DB_PATH);

try {
  // 检查列是否已存在
  const columns = db.prepare("PRAGMA table_info(images)").all() as { name: string }[];
  const hasStyleRef = columns.some(col => col.name === 'style_ref');

  if (hasStyleRef) {
    console.log('style_ref 列已存在，跳过迁移');
  } else {
    // 添加 style_ref 列
    db.exec('ALTER TABLE images ADD COLUMN style_ref TEXT');
    console.log('成功添加 style_ref 列');
  }

  console.log('迁移完成');
} catch (error) {
  console.error('迁移失败:', error);
  process.exit(1);
} finally {
  db.close();
}
