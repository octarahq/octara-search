import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve(__dirname, "../../../config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

export const sql = postgres(config.databaseUrl, {
  max: 10,
  idle_timeout: 20,
});
