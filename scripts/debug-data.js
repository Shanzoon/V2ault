const Database = require('better-sqlite3');
const path = require('path');

// 连接数据库
const db = new Database(path.join(__dirname, '../images.db'));

// 旧的（垃圾）：
// const row = db.prepare('SELECT ... LIMIT 1').get();

// 新的（随机抽查）：
const row = db.prepare('SELECT filename, prompt FROM images WHERE prompt IS NOT NULL ORDER BY RANDOM() LIMIT 1').get();

if (row) {
    console.log('=== Filename: ===', row.filename);
    console.log('=== Raw Prompt Data: ===');
    try {
        // 尝试格式化 JSON 输出
        const jsonData = JSON.parse(row.prompt);
        console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
        // 如果不是 JSON，直接打印字符串
        console.log(row.prompt);
    }
} else {
    console.log('Database is empty or no prompts found.');
}