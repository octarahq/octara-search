import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve(__dirname, "../../config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

export const sql = postgres(config.databaseUrl, {
  max: 20,
  idle_timeout: 20,
  onnotice: () => {},
});

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS pages (
      url TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      snippet TEXT,
      language TEXT DEFAULT 'en',
      content_hash CHAR(16),
      crawled_at TIMESTAMP DEFAULT NOW()
    )
  `;

  try {
    await sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en'`;
  } catch (e) {}

  await sql`CREATE INDEX IF NOT EXISTS idx_crawled_at ON pages(crawled_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_language ON pages(language)`;

  await sql`
    CREATE TABLE IF NOT EXISTS search_index (
      id INT PRIMARY KEY,
      index_data TEXT
    )
  `;
}
