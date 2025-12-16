/**
 * 数据库迁移脚本：添加 model_base 列
 *
 * 使用方法:
 *   npx tsx scripts/migrate-add-model-base.ts
 */
import Database from 'better-sqlite3';
import { IMAGE_DB_PATH } from './config';

console.log(`迁移数据库: ${IMAGE_DB_PATH}`);

const db = new Database(IMAGE_DB_PATH);

try {
  // 检查列是否已存在
  const columns = db.prepare("PRAGMA table_info(images)").all() as { name: string }[];
  const hasModelBase = columns.some(col => col.name === 'model_base');

  if (hasModelBase) {
    console.log('model_base 列已存在，跳过迁移');
  } else {
    // 添加 model_base 列
    db.exec('ALTER TABLE images ADD COLUMN model_base TEXT');
    console.log('成功添加 model_base 列');
  }

  console.log('迁移完成');
} catch (error) {
  console.error('迁移失败:', error);
  process.exit(1);
} finally {
  db.close();
}
