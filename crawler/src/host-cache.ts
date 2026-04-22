import fs from "node:fs";
import path from "node:path";
import { fetchPage } from "./fetcher";

const CACHE_PATH = path.resolve(__dirname, "../../data/host-cache.json");

const MAX_ROBOTS = 5000;
const MAX_SITEMAPS = 5000;
const MAX_PROCESSED_SITEMAPS = 50000;

export class HostCache {
  private robots: Map<string, string> = new Map();
  private sitemaps: Map<string, string[]> = new Map();
  private processedSitemaps: Set<string> = new Set();

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    if (!fs.existsSync(CACHE_PATH)) return;
    try {
      const data = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
      const robotsEntries = Object.entries(data.robots || {}) as [
        string,
        string,
      ][];
      // Only keep the most recent entries up to the limit
      this.robots = new Map(robotsEntries.slice(-MAX_ROBOTS));
      const sitemapsEntries = Object.entries(data.sitemaps || {}) as [
        string,
        string[],
      ][];
      this.sitemaps = new Map(sitemapsEntries.slice(-MAX_SITEMAPS));
      const processedArr: string[] = data.processedSitemaps || [];
      this.processedSitemaps = new Set(
        processedArr.slice(-MAX_PROCESSED_SITEMAPS),
      );
    } catch (e) {
      console.error("Failed to load HostCache from disk:", e);
    }
  }

  private enforceRobotsLimit() {
    if (this.robots.size > MAX_ROBOTS) {
      const excess = this.robots.size - MAX_ROBOTS;
      const keys = this.robots.keys();
      for (let i = 0; i < excess; i++) {
        const k = keys.next().value;
        if (k) this.robots.delete(k);
      }
    }
  }

  private enforceSitemapsLimit() {
    if (this.sitemaps.size > MAX_SITEMAPS) {
      const excess = this.sitemaps.size - MAX_SITEMAPS;
      const keys = this.sitemaps.keys();
      for (let i = 0; i < excess; i++) {
        const k = keys.next().value;
        if (k) this.sitemaps.delete(k);
      }
    }
  }

  private enforceProcessedLimit() {
    if (this.processedSitemaps.size > MAX_PROCESSED_SITEMAPS) {
      const excess = this.processedSitemaps.size - MAX_PROCESSED_SITEMAPS;
      const iter = this.processedSitemaps.values();
      for (let i = 0; i < excess; i++) {
        const v = iter.next().value;
        if (v) this.processedSitemaps.delete(v);
      }
    }
  }

  save() {
    try {
      this.enforceRobotsLimit();
      this.enforceSitemapsLimit();
      this.enforceProcessedLimit();

      const data = {
        robots: Object.fromEntries(this.robots),
        sitemaps: Object.fromEntries(this.sitemaps),
        processedSitemaps: Array.from(this.processedSitemaps),
      };
      fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
      fs.writeFileSync(CACHE_PATH, JSON.stringify(data));
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
      this.enforceRobotsLimit();
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
    this.enforceSitemapsLimit();
  }

  getSitemaps(domain: string): string[] {
    return this.sitemaps.get(domain) || [];
  }

  isSitemapProcessed(url: string): boolean {
    return this.processedSitemaps.has(url);
  }

  markSitemapProcessed(url: string) {
    this.processedSitemaps.add(url);
    this.enforceProcessedLimit();
  }
}
