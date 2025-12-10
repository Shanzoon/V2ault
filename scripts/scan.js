const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const Database = require('better-sqlite3');

// Configuration
const IMAGE_ROOT = 'D:\\desktop\\尸块们\\image_data_cache';
const DB_PATH = path.join(__dirname, '..', 'images.db');
const BATCH_SIZE = 100;

console.log(`DB Path: ${DB_PATH}`);
console.log(`Scanning directory: ${IMAGE_ROOT}`);

// Initialize DB connection
const db = new Database(DB_PATH);

// Prepare statement
const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO images (
        filename, filepath, prompt, width, height, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
`);

function getDimensions(buffer) {
    try {
        // PNG Signature
        if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
            return { width: 0, height: 0 };
        }
        // IHDR chunk is always the first chunk after signature
        // Signature (8) + Length (4) + Type "IHDR" (4)
        // Width is at offset 16, Height at 20
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
    } catch (e) {
        return { width: 0, height: 0 };
    }
}

async function scan() {
    try {
        console.log('Searching for PNG files...');
        // Handle windows path for glob
        const pattern = `${IMAGE_ROOT.replace(/\\/g, '/')}/**/*.png`;
        const files = await glob(pattern);
        
        console.log(`Found ${files.length} files. Starting processing...`);

        let processed = 0;
        let batch = [];
        let hasLoggedPrompt = false;

        const processBatch = db.transaction((items) => {
            for (const item of items) {
                insertStmt.run(
                    item.filename,
                    item.filepath,
                    item.prompt,
                    item.width,
                    item.height,
                    item.created_at
                );
            }
        });

        for (const file of files) {
            try {
                const stats = fs.statSync(file);
                // Read file buffer for dimensions
                const buffer = fs.readFileSync(file);
                const dimensions = getDimensions(buffer);

                const filename = path.basename(file);
                const filepath = path.resolve(file);
                
                // Look for corresponding .txt file
                const txtPath = path.join(path.dirname(file), path.basename(file, path.extname(file)) + '.txt');
                let prompt = null;

                if (fs.existsSync(txtPath)) {
                    try {
                        prompt = fs.readFileSync(txtPath, 'utf8').trim();
                        if (prompt && !hasLoggedPrompt) {
                            console.log(`[DEBUG] Found prompt in ${path.basename(txtPath)}: ${prompt.slice(0, 20)}...`);
                            hasLoggedPrompt = true;
                        }
                    } catch (readErr) {
                        console.error(`Error reading text file ${txtPath}:`, readErr.message);
                    }
                }

                batch.push({
                    filename,
                    filepath,
                    prompt,
                    width: dimensions.width,
                    height: dimensions.height,
                    // Format: YYYY-MM-DD HH:MM:SS
                    created_at: new Date(stats.mtime).toISOString().replace('T', ' ').split('.')[0]
                });

                if (batch.length >= BATCH_SIZE) {
                    processBatch(batch);
                    batch = [];
                }

                processed++;
                if (processed % 1000 === 0) {
                    console.log(`Processed ${processed}/${files.length}...`);
                }

            } catch (err) {
                console.error(`Error processing ${file}:`, err.message);
            }
        }

        // Process remaining
        if (batch.length > 0) {
            processBatch(batch);
        }

        console.log(`Scan complete. Processed ${processed} files.`);

    } catch (error) {
        console.error('Fatal error during scan:', error);
    } finally {
        if (db) db.close();
    }
}

scan();
