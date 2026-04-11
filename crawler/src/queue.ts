import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { normalizeUrl } from "./parser";

const DB_PATH = path.resolve(__dirname, "../../data/queue.sqlite");

export interface QueueItem {
  url: string;
  depth: number;
  recursive: boolean;
}

export class QueueManager {
  private db: Database.Database;

  constructor(memory = false) {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir) && !memory) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(memory ? ":memory:" : DB_PATH);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE,
        domain TEXT,
        depth INTEGER,
        recursive BOOLEAN DEFAULT 1
      )
    `);

    try {
      this.db.exec("ALTER TABLE queue ADD COLUMN recursive BOOLEAN DEFAULT 1");
    } catch (e) {}

    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_queue_domain ON queue(domain)`,
    );
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_queue_id ON queue(id)`);
  }

  async load(seedUrls: string[], fresh: boolean = false) {
    if (fresh) {
      console.log("Fresh start: Clearing queue database.");
      this.db.prepare("DELETE FROM queue").run();
      for (const url of seedUrls) {
        this.enqueue(url, 0);
      }
      return;
    }

    const count = this.length();
    if (count === 0 && seedUrls.length > 0) {
      console.log("Queue empty, loading seed URLs.");
      for (const url of seedUrls) {
        this.enqueue(url, 0);
      }
    } else {
      console.log(`Queue loaded from SQLite with ${count} items.`);
    }
  }

  save() {}

  enqueue(
    url: string,
    depth: number = 0,
    atStart: boolean = false,
    recursive: boolean = true,
  ) {
    try {
      url = normalizeUrl(url);
      const domain = new URL(url).hostname;
      if (atStart) {
        const minIdRow = this.db
          .prepare("SELECT MIN(id) as id FROM queue")
          .get() as { id: number | null };
        const minId = minIdRow.id !== null ? minIdRow.id : 0;
        this.db
          .prepare(
            "INSERT OR IGNORE INTO queue (id, url, domain, depth, recursive) VALUES (?, ?, ?, ?, ?)",
          )
          .run(minId - 1, url, domain, depth, recursive ? 1 : 0);
      } else {
        this.db
          .prepare(
            "INSERT OR IGNORE INTO queue (url, domain, depth, recursive) VALUES (?, ?, ?, ?)",
          )
          .run(url, domain, depth, recursive ? 1 : 0);
      }
    } catch (e) {}
  }

  private memoryBuffer: {
    id: number;
    url: string;
    domain: string;
    depth: number;
    recursive: number;
  }[] = [];
  private recentDomains: string[] = [];

  dequeue(): QueueItem | undefined {
    if (this.memoryBuffer.length === 0) {
      const rows = this.db
        .prepare(
          "SELECT id, url, domain, depth, recursive FROM queue ORDER BY id ASC LIMIT 2000",
        )
        .all() as {
        id: number;
        url: string;
        domain: string;
        depth: number;
        recursive: number;
      }[];
      if (rows.length === 0) return undefined;

      const stmt = this.db.prepare("DELETE FROM queue WHERE id = ?");
      const transaction = this.db.transaction((ids: number[]) => {
        for (const id of ids) stmt.run(id);
      });
      transaction(rows.map((r) => r.id));

      this.memoryBuffer = rows;
    }

    let selectedIndex = 0;

    for (let i = 0; i < Math.min(this.memoryBuffer.length, 500); i++) {
      const domain = this.memoryBuffer[i].domain;
      if (!this.recentDomains.includes(domain)) {
        selectedIndex = i;
        this.recentDomains.push(domain);
        if (this.recentDomains.length > 50) this.recentDomains.shift();
        break;
      }
    }

    const item = this.memoryBuffer.splice(selectedIndex, 1)[0];
    return {
      url: item.url,
      depth: item.depth,
      recursive: item.recursive === 1,
    };
  }

  resetDepths(newDepth: number) {
    this.db.prepare("UPDATE queue SET depth = ?").run(newDepth);
  }

  length(): number {
    const res = this.db
      .prepare("SELECT COUNT(*) as count FROM queue")
      .get() as { count: number };
    return (res.count || 0) + this.memoryBuffer.length;
  }
}
