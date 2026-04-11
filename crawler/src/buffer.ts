import { sql } from "./db";

interface PageEntry {
  url: string;
  title: string;
  description: string;
  snippet: string;
  language: string;
  content_hash: string;
  nsfw: boolean;
}

export class DbBuffer {
  private buffer: PageEntry[] = [];
  private limit = 20;
  public totalInserted = 0;

  async add(entry: PageEntry) {
    this.buffer.push(entry);
    if (this.buffer.length >= this.limit) {
      await this.flush();
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const toFlush = [...this.buffer];
    this.buffer = [];

    // Deduplicate by URL to avoid PostgresError (row affected twice in same command)
    const uniqueMap = new Map();
    toFlush.forEach((item) => uniqueMap.set(item.url, item));
    const unique: PageEntry[] = Array.from(uniqueMap.values());

    try {
      await sql`
        INSERT INTO pages ${sql(unique as any, "url", "title", "description", "snippet", "language", "content_hash", "nsfw")}
        ON CONFLICT (url) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          snippet = EXCLUDED.snippet,
          language = EXCLUDED.language,
          content_hash = EXCLUDED.content_hash,
          nsfw = EXCLUDED.nsfw,
          crawled_at = NOW()
      `;
      this.totalInserted += unique.length;
    } catch (e) {
      console.error("[Buffer] Flush error:", e);
    }
  }
}
