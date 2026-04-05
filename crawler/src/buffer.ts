import { sql } from "./db";

interface PageEntry {
  url: string;
  title: string;
  description: string;
  snippet: string;
  language: string;
  content_hash: string;
}

export class DbBuffer {
  private buffer: PageEntry[] = [];
  private limit = 100;
  public totalInserted = 0;

  async add(entry: PageEntry) {
    this.buffer.push(entry);
    if (this.buffer.length >= this.limit) {
      await this.flush();
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;

    try {
      await sql`
        INSERT INTO pages ${sql(this.buffer, "url", "title", "description", "snippet", "language", "content_hash")}
        ON CONFLICT (url) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          snippet = EXCLUDED.snippet,
          language = EXCLUDED.language,
          content_hash = EXCLUDED.content_hash,
          crawled_at = NOW()
      `;
      this.totalInserted += this.buffer.length;
      console.log(
        `[Buffer] Flushed ${this.buffer.length} records. Total: ${this.totalInserted}`,
      );
    } catch (e) {
      console.error("[Buffer] Flush error:", e);
    } finally {
      this.buffer = [];
    }
  }
}
