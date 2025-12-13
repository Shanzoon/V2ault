const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(process.cwd(), "images.db");
const db = new Database(DB_PATH);

console.log("Connected to database at " + DB_PATH);

const basePrompts = [
  "A cyberpunk city street at night with neon lights",
  "A serene landscape with a mountain and a lake",
  "A futuristic space station orbiting a blue planet",
  "A portrait of a robot with human-like features",
  "A magical forest with glowing mushrooms",
  "A steampunk airship flying over a victorian city",
  "A delicious looking plate of sushi",
  "A cute kitten playing with a ball of yarn",
  "A dragon flying over a castle",
  "A snowy mountain peak at sunrise"
];

const resolutions = [
  { w: 512, h: 512 },
  { w: 512, h: 768 },
  { w: 768, h: 512 },
  { w: 1024, h: 1024 },
  { w: 1024, h: 1536 },
  { w: 1920, h: 1080 }
];

// Detected schema has: id, filename, filepath, prompt, negative_prompt, width, height, created_at
const insertStmt = db.prepare("INSERT OR IGNORE INTO images (filename, filepath, prompt, width, height) VALUES (@filename, @filepath, @prompt, @width, @height)");

let addedCount = 0;

try {
  const runTransaction = db.transaction(() => {
    for (let i = 1; i <= 50; i++) {
      const prompt = basePrompts[i % basePrompts.length];
      const res = resolutions[i % resolutions.length];
      const filename = "seed_image_" + i + ".png";
      const filepath = "/data/seed_images/" + filename;
      
      const info = insertStmt.run({
        filename: filename,
        filepath: filepath,
        prompt: prompt,
        width: res.w,
        height: res.h
      });

      if (info.changes > 0) {
        addedCount++;
      }
    }
  });
  runTransaction();
} catch (error) {
  console.error("Error seeding data:", error);
}

console.log("Finished. Added " + addedCount + " new images.");
db.close();
