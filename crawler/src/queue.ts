import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const QUEUE_PATH = path.resolve(__dirname, "../../data/queue.json");

export interface QueueItem {
  url: string;
  depth: number;
}

export class QueueManager {
  private queue: QueueItem[] = [];
  private head: number = 0;

  async load(seedUrls: string[], fresh: boolean = false) {
    if (fresh || !fs.existsSync(QUEUE_PATH)) {
      this.queue = seedUrls.map((url) => ({ url, depth: 0 }));
      this.head = 0;
      console.log(`Queue initialized with ${this.queue.length} seed URLs.`);
      return;
    }

    try {
      const stats = fs.statSync(QUEUE_PATH);
      if (stats.size < 50 * 1024 * 1024) {
        const data = fs.readFileSync(QUEUE_PATH, "utf-8");
        const parsed = JSON.parse(data);
        this.queue = parsed.map((item: any) => {
          if (typeof item === "string") return { url: item, depth: 0 };
          return item as QueueItem;
        });
        console.log(
          `Queue loaded with ${this.queue.length} items (JSON.parse).`,
        );
      } else {
        const fileStream = fs.createReadStream(QUEUE_PATH);
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        });

        this.queue = [];
        for await (const line of rl) {
          try {
            const cleanLine = line.trim().replace(/,$/, "");
            if (cleanLine === "[" || cleanLine === "]") continue;
            const item = JSON.parse(cleanLine);
            if (typeof item === "string") {
              this.queue.push({ url: item, depth: 0 });
            } else {
              this.queue.push(item);
            }
          } catch (e) {}
        }
        console.log(
          `Queue loaded with ${this.queue.length} items (Streaming).`,
        );
      }
      this.head = 0;

      if (this.queue.length === 0) {
        this.queue = seedUrls.map((url) => ({ url, depth: 0 }));
        console.log(`Queue was empty, falling back to seeds.`);
      }
    } catch (e) {
      console.error("Error loading queue, fallback to seeds.", e);
      this.queue = seedUrls.map((url) => ({ url, depth: 0 }));
      this.head = 0;
    }
  }

  save() {
    fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true });

    const fd = fs.openSync(QUEUE_PATH, "w");
    fs.writeSync(fd, "[\n");
    for (let i = this.head; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (item === undefined) continue;
      const comma = i === this.queue.length - 1 ? "" : ",";
      fs.writeSync(fd, `  ${JSON.stringify(item)}${comma}\n`);
    }
    fs.writeSync(fd, "]\n");
    fs.closeSync(fd);
  }

  enqueue(url: string, depth: number = 0, atStart: boolean = false) {
    if (atStart) {
      if (this.head > 0) {
        this.head--;
        this.queue[this.head] = { url, depth };
      } else {
        this.queue.unshift({ url, depth });
      }
    } else {
      this.queue.push({ url, depth });
    }
  }

  dequeue(): QueueItem | undefined {
    if (this.head >= this.queue.length) {
      this.queue = [];
      this.head = 0;
      return undefined;
    }
    const item = this.queue[this.head];

    (this.queue as any)[this.head] = undefined;
    this.head++;

    if (this.head > 50000) {
      this.queue = this.queue.slice(this.head);
      this.head = 0;
    }

    return item;
  }

  resetDepths(newDepth: number) {
    this.queue.forEach((item) => {
      if (item) item.depth = newDepth;
    });
  }

  length() {
    return this.queue.length - this.head;
  }
}
