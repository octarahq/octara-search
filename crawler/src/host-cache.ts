import fs from "node:fs";
import path from "node:path";
import { fetchPage } from "./fetcher";

const CACHE_PATH = path.resolve(__dirname, "../../data/host-cache.json");

export class HostCache {
  private robots: Map<string, string> = new Map();
  private sitemaps: Map<string, string[]> = new Map();
  private processedSitemaps: Set<string> = new Set();

  constructor() {
    this.load();
  }

  load() {
    if (!fs.existsSync(CACHE_PATH)) return;
    try {
      const data = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
      this.robots = new Map(Object.entries(data.robots || {}));
      this.sitemaps = new Map(Object.entries(data.sitemaps || {}));
      this.processedSitemaps = new Set(data.processedSitemaps || []);
    } catch (e) {
      console.error("Failed to load HostCache from disk:", e);
    }
  }

  save() {
    try {
      const data = {
        robots: Object.fromEntries(this.robots),
        sitemaps: Object.fromEntries(this.sitemaps),
        processedSitemaps: Array.from(this.processedSitemaps),
      };
      fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
      fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error("Failed to save HostCache to disk:", e);
    }
  }

  async getRobots(domain: string): Promise<string | null> {
    if (this.robots.has(domain)) {
      const cached = this.robots.get(domain);
      return cached === "" ? null : cached || null;
    }

    try {
      const url = `https://${domain}/robots.txt`;
      const content = await fetchPage(url);
      this.robots.set(domain, content);
      return content;
    } catch (e) {
      this.robots.set(domain, "");
      return null;
    }
  }

  async getSitemapsFromRobots(domain: string): Promise<string[]> {
    const robots = await this.getRobots(domain);
    if (!robots) return [];

    const sitemaps: string[] = [];
    const lines = robots.split("\n");
    for (const line of lines) {
      if (line.toLowerCase().startsWith("sitemap:")) {
        const sitemapUrl = line.substring(8).trim();
        if (sitemapUrl) {
          sitemaps.push(sitemapUrl);
        }
      }
    }
    return sitemaps;
  }

  addSitemaps(domain: string, urls: string[]) {
    const current = this.sitemaps.get(domain) || [];
    const updated = [...new Set([...current, ...urls])];
    this.sitemaps.set(domain, updated);
  }

  getSitemaps(domain: string): string[] {
    return this.sitemaps.get(domain) || [];
  }

  isSitemapProcessed(url: string): boolean {
    return this.processedSitemaps.has(url);
  }

  markSitemapProcessed(url: string) {
    this.processedSitemaps.add(url);
  }
}
