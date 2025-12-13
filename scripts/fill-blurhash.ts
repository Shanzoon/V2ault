import Database from 'better-sqlite3';
import sharp from 'sharp';
import { encode } from 'blurhash';
import path from 'path';
import fs from 'fs';

// --- Configuration ---
const DB_PATH = path.join(process.cwd(), '../images.db');
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;

interface ImageRecord {
  id: number;
  filepath: string;
}

// --- Helper: Convert Windows path to WSL path (if needed) ---
function windowsToWslPath(windowsPath: string): string {
  if (!windowsPath) return '';
  if (windowsPath.startsWith('/') || windowsPath.startsWith('.')) {
    return windowsPath;
  }
  const driveMatch = windowsPath.match(/^([a-zA-Z]):/);
  if (driveMatch) {
    const driveLetter = driveMatch[1].toLowerCase();
    const restOfPath = windowsPath.slice(2).replace(/\\/g, '/');
    return '/mnt/' + driveLetter + restOfPath;
  }
  return windowsPath;
}

// --- Helper: Calculate Dominant Color ---
async function getDominantColor(imageBuffer: Buffer): Promise<string | null> {
  try {
    const { dominant } = await sharp(imageBuffer).stats();
    const r = dominant.r.toString(16).padStart(2, '0');
    const g = dominant.g.toString(16).padStart(2, '0');
    const b = dominant.b.toString(16).padStart(2, '0');
    return '#' + r + g + b;
  } catch (error: any) {
    console.warn('Failed to calculate dominant color:', error.message);
    return null;
  }
}

// --- Main Script ---
async function main() {
  console.log('Starting BlurHash backfill process...');
  
  if (!fs.existsSync(DB_PATH)) {
    console.error('Database not found at: ' + DB_PATH);
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  console.log('Connected to database: ' + DB_PATH);

  const query = db.prepare('SELECT id, filepath FROM images WHERE blurhash IS NULL OR dominant_color IS NULL');
  const images = query.all() as ImageRecord[];
  
  const total = images.length;
  console.log('Found ' + total + ' images to process.');

  if (total === 0) {
    console.log('No images need processing. Exiting.');
    db.close();
    return;
  }

  const updateStmt = db.prepare('UPDATE images SET blurhash = @blurhash, dominant_color = @dominant_color WHERE id = @id');

  let processed = 0;
  let success = 0;
  let failed = 0;

  for (const img of images) {
    processed++;
    const progress = ((processed / total) * 100).toFixed(1);
    let filePath = img.filepath;
    
    if (filePath.includes('\\') || /^[a-zA-Z]:/.test(filePath)) {
       filePath = windowsToWslPath(filePath);
    }
    
    if (filePath.startsWith('/data/seed_images/')) {
        failed++;
        continue;
    }

    if (!fs.existsSync(filePath)) {
       const relativePath = path.join(process.cwd(), filePath);
       if (fs.existsSync(relativePath)) {
           filePath = relativePath;
       } else {
           console.warn('[' + processed + '/' + total + '] File not found: ' + filePath + ' (Original: ' + img.filepath + ')');
           failed++;
           continue;
       }
    }

    try {
      const imageBuffer = fs.readFileSync(filePath);

      const { data, info } = await sharp(imageBuffer)
        .raw()
        .ensureAlpha()
        .resize(32, 32, { fit: 'inside' })
        .toBuffer({ resolveWithObject: true });

      const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, BLURHASH_COMPONENT_X, BLURHASH_COMPONENT_Y);
      const dominantColor = await getDominantColor(imageBuffer);

      updateStmt.run({
        blurhash: blurhash,
        dominant_color: dominantColor,
        id: img.id
      });

      success++;
      process.stdout.write('\r[' + progress + '%] Processed: ' + path.basename(filePath) + '          ');

    } catch (err: any) {
      console.error('\nError processing ' + filePath + ':', err.message);
      failed++;
    }
  }

  console.log('\n\n--- Summary ---');
  console.log('Total: ' + total);
  console.log('Success: ' + success);
  console.log('Failed/Skipped: ' + failed);
  
  db.close();
  console.log('Database connection closed.');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
