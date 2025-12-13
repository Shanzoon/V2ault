import Database from 'better-sqlite3';
import path from 'path';

// Adjust this path if necessary to point to your actual database file
const DB_PATH = path.join(process.cwd(), 'images.db');

function main() {
  if (!require('fs').existsSync(DB_PATH)) {
    console.error(`Database not found at: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  console.log(`Connected to database: ${DB_PATH}`);

  // 1. Pick a random image
  const image = db.prepare('SELECT id, like_count FROM images ORDER BY RANDOM() LIMIT 1').get() as { id: number, like_count: number } | undefined;

  if (!image) {
    console.log('No images found in database.');
    return;
  }

  console.log(`[TEST] Selected Image ID: ${image.id}, Current Like Count: ${image.like_count}`);

  // 2. Toggle Like Count (Simulate PATCH)
  const newStatus = image.like_count > 0 ? 0 : 1;
  const updateResult = db.prepare('UPDATE images SET like_count = ? WHERE id = ?').run(newStatus, image.id);

  console.log(`[TEST] Updated Like Count to: ${newStatus}, Changes: ${updateResult.changes}`);

  // 3. Verify Update
  const updatedImage = db.prepare('SELECT id, like_count FROM images WHERE id = ?').get(image.id) as { id: number, like_count: number };
  
  if (updatedImage.like_count === newStatus) {
    console.log('[PASS] Database update verified.');
  } else {
    console.error('[FAIL] Database update failed.');
  }

  // 4. Test Filter Query (Simulate GET /api/images/list?liked=true)
  // Ensure we have at least one liked image
  if (newStatus === 0) {
     // If we just unliked it, let's like it back for the filter test
     db.prepare('UPDATE images SET like_count = 1 WHERE id = ?').run(image.id);
  }

  const likedImages = db.prepare('SELECT count(*) as count FROM images WHERE like_count > 0').get() as { count: number };
  console.log(`[TEST] Total Liked Images in DB: ${likedImages.count}`);

  if (likedImages.count > 0) {
      console.log('[PASS] Filter query "like_count > 0" works.');
  } else {
      console.warn('[WARN] No liked images found to test filter.');
  }

  // 5. Cleanup (Revert to original state)
  db.prepare('UPDATE images SET like_count = ? WHERE id = ?').run(image.like_count, image.id);
  console.log(`[TEST] Reverted Image ${image.id} to original Like Count: ${image.like_count}`);
  
  db.close();
}

main();
