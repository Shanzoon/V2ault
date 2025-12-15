/**
 * 图片扫描脚本
 * 扫描指定目录下的图片文件，提取元数据并写入数据库
 *
 * 使用方法:
 *   npx tsx scripts/scan-images.ts                          # 快速扫描
 *   npx tsx scripts/scan-images.ts --blurhash               # 扫描并生成 blurhash
 *   npx tsx scripts/scan-images.ts --root "/mnt/d/images"   # 指定目录
 *   npx tsx scripts/scan-images.ts --root "/path" --blurhash # 组合使用
 */
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { encode } from 'blurhash';
import { IMAGE_DB_PATH, IMAGE_ROOTS, normalizePath, printConfig } from './config';

// ============================================
// 配置
// ============================================

const BATCH_SIZE = 100;
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;

// 支持命令行参数覆盖
function parseArgs(): { roots: string[]; generateBlurhash: boolean } {
  const args = process.argv.slice(2);
  const roots: string[] = [];
  let generateBlurhash = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) {
      roots.push(normalizePath(args[i + 1]));
      i++;
    } else if (args[i] === '--blurhash') {
      generateBlurhash = true;
    }
  }

  // 如果命令行没有指定，使用环境变量配置
  return { roots: roots.length > 0 ? roots : IMAGE_ROOTS, generateBlurhash };
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

async function getDominantColor(imageBuffer: Buffer): Promise<string | null> {
  try {
    const { dominant } = await sharp(imageBuffer).stats();
    const r = dominant.r.toString(16).padStart(2, '0');
    const g = dominant.g.toString(16).padStart(2, '0');
    const b = dominant.b.toString(16).padStart(2, '0');
    return '#' + r + g + b;
  } catch {
    return null;
  }
}

async function generateBlurhash(imageBuffer: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .ensureAlpha()
      .resize(32, 32, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });

    return encode(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      BLURHASH_COMPONENT_X,
      BLURHASH_COMPONENT_Y
    );
  } catch {
    return null;
  }
}

// ============================================
// 主扫描逻辑
// ============================================

async function scan() {
  const { roots, generateBlurhash: withBlurhash } = parseArgs();

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
  console.log(`生成 Blurhash: ${withBlurhash ? '是' : '否'}`);

  const db = new Database(IMAGE_DB_PATH);

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
      source,
      blurhash,
      dominant_color
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  interface BatchItem {
    filename: string;
    filepath: string;
    prompt: string | null;
    width: number;
    height: number;
    created_at: string;
    filesize: number;
    imported_at: number;
    source: string;
    blurhash: string | null;
    dominant_color: string | null;
  }

  const processBatch = db.transaction((items: BatchItem[]) => {
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
        item.source,
        item.blurhash,
        item.dominant_color
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

      let batch: BatchItem[] = [];
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

          // 可选生成 blurhash 和 dominant_color
          let blurhash: string | null = null;
          let dominant_color: string | null = null;

          if (withBlurhash) {
            [blurhash, dominant_color] = await Promise.all([
              generateBlurhash(buffer),
              getDominantColor(buffer),
            ]);
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
            filesize: stats.size,
            imported_at: Math.floor(Date.now() / 1000),
            source: 'scan_script',
            blurhash,
            dominant_color,
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
