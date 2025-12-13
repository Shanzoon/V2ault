const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(process.cwd(), "images.db");
const db = new Database(dbPath);

console.log("Migrating database at:", dbPath);

// 1. Create models table if not exists
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filename TEXT,
      hash TEXT,
      type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("Ensured models table exists.");
} catch (error) {
  console.error("Error creating models table:", error);
}

// 2. Add columns to images table
const columnsToAdd = [
  { name: "filesize", type: "INTEGER" },
  { name: "imported_at", type: "INTEGER" },
  { name: "source", type: "TEXT" },
  { name: "model_base_id", type: "INTEGER" },
  { name: "style", type: "TEXT" },
  { name: "blurhash", type: "TEXT" },
  { name: "dominant_color", type: "TEXT" },
  { name: "like_count", type: "INTEGER NOT NULL DEFAULT 0" },
  { name: "favorite", type: "INTEGER NOT NULL DEFAULT 0" }
];

// Get current columns
const currentColumns = db.prepare("PRAGMA table_info(images)").all().map(c => c.name);
console.log("Current columns:", currentColumns);

const runMigration = db.transaction(() => {
  for (const col of columnsToAdd) {
    if (!currentColumns.includes(col.name)) {
      console.log(`Adding column: ${col.name} ${col.type}`);
      try {
        db.exec(`ALTER TABLE images ADD COLUMN ${col.name} ${col.type}`);
      } catch (e) {
        console.error(`Failed to add column ${col.name}:`, e.message);
        throw e;
      }
    } else {
      console.log(`Column ${col.name} already exists, skipping.`);
    }
  }
});

try {
  runMigration();
  console.log("Migration completed successfully.");
} catch (error) {
  console.error("Migration failed:", error);
}

// Verify
const newColumns = db.prepare("PRAGMA table_info(images)").all().map(c => c.name);
console.log("New columns:", newColumns);

db.close();
