import fs from "fs";
import path from "path";
import { BloomFilter } from "bloom-filters";

const BLOOM_PATH = path.resolve(__dirname, "../../data/bloom.bin");

export class BloomManager {
  private filter: BloomFilter;

  constructor() {
    this.filter = BloomFilter.create(2_000_000, 0.01);
  }

  load(fresh: boolean = false) {
    if (!fresh && fs.existsSync(BLOOM_PATH)) {
      const data = fs.readFileSync(BLOOM_PATH);
      const json = JSON.parse(data.toString("utf-8"));
      this.filter = BloomFilter.fromJSON(json);
      console.log("Bloom filter loaded.");
    } else {
      this.filter = BloomFilter.create(2_000_000, 0.01);
    }
  }

  async save() {
    try {
      await fs.promises.mkdir(path.dirname(BLOOM_PATH), { recursive: true });
      const json = this.filter.saveAsJSON();
      await fs.promises.writeFile(BLOOM_PATH, JSON.stringify(json));
    } catch (e) {
      console.error("Failed to save bloom filter:", e);
    }
  }

  has(url: string) {
    return this.filter.has(url);
  }

  add(url: string) {
    this.filter.add(url);
  }
}
