/**
 * 图片扫描脚本
 * 扫描指定目录下的图片文件，提取元数据并写入数据库
 *
 * 使用方法:
 *   npx tsx scripts/scan-images.ts
 *   npx tsx scripts/scan-images.ts --root "/mnt/d/custom/path"
 */
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import Database from 'better-sqlite3';
import { IMAGE_DB_PATH, IMAGE_ROOTS, normalizePath, printConfig } from './config';

// ============================================
// 配置
// ============================================

const BATCH_SIZE = 100;

// 支持命令行参数覆盖
function parseArgs(): { roots: string[] } {
  const args = process.argv.slice(2);
  const roots: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) {
      roots.push(normalizePath(args[i + 1]));
      i++;
    }
  }

  // 如果命令行没有指定，使用环境变量配置
  return { roots: roots.length > 0 ? roots : IMAGE_ROOTS };
}

// ============================================
// 工具函数
// ============================================

function getDimensions(buffer: Buffer): { width: number; height: number } {
  try {
    // PNG Signature
    if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
      return { width: 0, height: 0 };
    }
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  } catch {
    return { width: 0, height: 0 };
  }
}

// ============================================
// 主扫描逻辑
// ============================================

async function scan() {
  const { roots } = parseArgs();

  console.log('=== V2ault Image Scanner ===');
  printConfig();

  if (roots.length === 0) {
    console.error('错误: 未配置图片根目录');
    console.error('请设置 IMAGE_ROOTS 环境变量，或使用 --root 参数');
    console.error('示例: npx tsx scripts/scan-images.ts --root "/mnt/d/images"');
    process.exit(1);
  }

  console.log(`数据库路径: ${IMAGE_DB_PATH}`);
  console.log(`扫描目录: ${roots.join(', ')}`);

  const db = new Database(IMAGE_DB_PATH);

  // 注意：这里已经把 filesize / imported_at / source 一起写进去了
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO images (
      filename,
      filepath,
      prompt,
      width,
      height,
      created_at,
      filesize,
      imported_at,
      source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const processBatch = db.transaction((items: Array<{
    filename: string;
    filepath: string;
    prompt: string | null;
    width: number;
    height: number;
    created_at: string;
    filesize: number;
    imported_at: number;
    source: string;
  }>) => {
    for (const item of items) {
      insertStmt.run(
        item.filename,
        item.filepath,
        item.prompt,
        item.width,
        item.height,
        item.created_at,
        item.filesize,
        item.imported_at,
        item.source
      );
    }
  });

  try {
    let totalProcessed = 0;

    for (const root of roots) {
      console.log(`\n正在扫描: ${root}`);
      const pattern = `${root}/**/*.png`;
      const files = await glob(pattern);
      console.log(`找到 ${files.length} 个 PNG 文件`);

      let batch: Array<{
        filename: string;
        filepath: string;
        prompt: string | null;
        width: number;
        height: number;
        created_at: string;
        filesize: number;
        imported_at: number;
        source: string;
      }> = [];
      let processed = 0;

      for (const file of files) {
        try {
          const stats = fs.statSync(file);
          const buffer = fs.readFileSync(file);
          const dimensions = getDimensions(buffer);
          const filename = path.basename(file);
          const filepath = path.resolve(file);

          // 查找对应的 .txt 文件
          const txtPath = path.join(
            path.dirname(file),
            path.basename(file, path.extname(file)) + '.txt'
          );
          let prompt: string | null = null;

          if (fs.existsSync(txtPath)) {
            try {
              prompt = fs.readFileSync(txtPath, 'utf8').trim();
            } catch {
              // 忽略读取错误
            }
          }

          batch.push({
            filename,
            filepath,
            prompt,
            width: dimensions.width,
            height: dimensions.height,
            created_at: new Date(stats.mtime)
              .toISOString()
              .replace('T', ' ')
              .split('.')[0],
            // 新增的三个字段
            filesize: stats.size,                     // 文件大小（字节）
            imported_at: Math.floor(Date.now() / 1000), // 导入时间（当前时间，Unix 秒）
            source: 'scan_script',                    // 标记来源，你也可以改成 'comfy' 等
          });

          if (batch.length >= BATCH_SIZE) {
            processBatch(batch);
            batch = [];
          }

          processed++;
          if (processed % 1000 === 0) {
            console.log(`  已处理 ${processed}/${files.length}...`);
          }
        } catch (err) {
          console.error(`处理文件出错 ${file}:`, err);
        }
      }

      if (batch.length > 0) {
        processBatch(batch);
      }

      totalProcessed += processed;
    }

    console.log(`\n扫描完成，共处理 ${totalProcessed} 个文件`);
  } finally {
    db.close();
  }
}

scan().catch(console.error);
