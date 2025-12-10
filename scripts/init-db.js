const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'images.db');
const db = new Database(dbPath);

const createTableQuery = `
CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    filepath TEXT UNIQUE,
    prompt TEXT,
    negative_prompt TEXT,
    width INTEGER,
    height INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

// 搜索时常用 prompt，排序常用 created_at，这两个必须有索引。
const createIndexCreatedAt = `CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);`;
const createIndexPrompt = `CREATE INDEX IF NOT EXISTS idx_images_prompt ON images(prompt);`;

try {
    // 开启 WAL 模式，这才是生产环境该有的样子
    db.pragma('journal_mode = WAL');
    // 同步模式设为 NORMAL，牺牲极小的安全性换取巨大的写入性能提升
    db.pragma('synchronous = NORMAL');

    // Create table
    db.exec(createTableQuery);

    // Create indexes
    db.exec(createIndexCreatedAt);
    db.exec(createIndexPrompt);

    // 定期整理数据库，减小体积
    db.exec('VACUUM;');

    console.log('Database initialized successfully (WAL mode enabled)');
} catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
} finally {
    db.close();
}