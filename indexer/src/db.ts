import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve(__dirname, "../../config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

export const sql = postgres(config.databaseUrl, {
  max: 10,
  idle_timeout: 20,
});

export async function countPages() {
  const result = await sql`SELECT COUNT(*)::int AS count FROM pages`;
  return result[0].count;
}

export async function fetchPages(limit: number, offset: number) {
  return sql`SELECT url, title, description, snippet, language, nsfw FROM pages ORDER BY url LIMIT ${limit} OFFSET ${offset}`;
}

export async function saveIndex(indexData: string) {
  await sql`
    INSERT INTO search_index (id, index_data) VALUES (1, ${indexData})
    ON CONFLICT (id) DO UPDATE SET index_data = EXCLUDED.index_data
  `;
}
