/**
 * 数据库调试脚本
 * 随机查看一条带有 prompt 的记录
 *
 * 使用方法:
 *   npx tsx scripts/debug-data.ts
 */
import Database from 'better-sqlite3';
import { IMAGE_DB_PATH } from './config';

console.log(`数据库路径: ${IMAGE_DB_PATH}`);

const db = new Database(IMAGE_DB_PATH, { readonly: true });

// 随机抽查一条带 prompt 的记录
const row = db.prepare(
  'SELECT filename, prompt FROM images WHERE prompt IS NOT NULL ORDER BY RANDOM() LIMIT 1'
).get() as { filename: string; prompt: string } | undefined;

if (row) {
  console.log('=== Filename: ===', row.filename);
  console.log('=== Raw Prompt Data: ===');
  try {
    // 尝试格式化 JSON 输出
    const jsonData = JSON.parse(row.prompt);
    console.log(JSON.stringify(jsonData, null, 2));
  } catch {
    // 如果不是 JSON，直接打印字符串
    console.log(row.prompt);
  }
} else {
  console.log('数据库为空或没有找到带 prompt 的记录');
}

db.close();
