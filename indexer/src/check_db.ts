import postgres from "postgres";
import fs from "fs";
import path from "path";

const configPath = path.resolve(__dirname, "../../config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const sql = postgres(config.databaseUrl);

async function check() {
  try {
    const result = await sql`SELECT COUNT(*) FROM pages`;
    console.log(`Total pages: ${result[0].count}`);
    const index = await sql`SELECT id FROM search_index WHERE id = 1`;
    console.log(`Index exists: ${index.length > 0}`);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

check();
