import axios from "axios";
import { createClient } from "redis";
import RSSParser from "rss-parser";
import { parseStringPromise } from "xml2js";
import nodeCron from "node-cron";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const GITHUB_REPO_URL =
  "https://api.github.com/repos/plenaryapp/awesome-rss-feeds/contents/countries/with_category?ref=master";
const RAW_GITHUB_URL =
  "https://raw.githubusercontent.com/plenaryapp/awesome-rss-feeds/master/countries/with_category/";
const SOURCES_FILE = path.join(__dirname, "../../../data/news_sources.json");

const client = axios.create({
  headers: { "User-Agent": "Octara-Search-Backend/1.0" },
});

const parser = new RSSParser({
  timeout: 5000,
  headers: { "User-Agent": "Octara-News-Service/1.0" },
});

const redisClient = createClient({
  url: REDIS_URL,
  password: process.env.REDIS_PASSWORD,
});
let isRedisConnected = false;
const memoryCache = new Map<string, string>();

async function initRedis() {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      isRedisConnected = true;
      console.log("[Redis] News: Connected!");
    }
  } catch (err) {
    console.warn("[Redis] News: Connection failed.");
    isRedisConnected = false;
  }
}

async function setCache(key: string, value: string, ttl: number = 0) {
  if (isRedisConnected) {
    if (ttl > 0) {
      await redisClient.set(key, value, { EX: ttl });
    } else {
      await redisClient.set(key, value);
    }
  } else {
    memoryCache.set(key, value);
    if (ttl > 0) {
      setTimeout(() => memoryCache.delete(key), ttl * 1000);
    }
  }
}

export async function getCache(key: string): Promise<string | null> {
  if (isRedisConnected) {
    return await redisClient.get(key);
  }
  return memoryCache.get(key) || null;
}

function getLocalSources(): Record<string, any[]> | null {
  if (fs.existsSync(SOURCES_FILE)) {
    try {
      const data = fs.readFileSync(SOURCES_FILE, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export async function updateNewsForCountry(country: string, feeds: any[]) {
  const allArticles: any[] = [];
  const limitedFeeds = feeds.slice(0, 10);

  for (const feed of limitedFeeds) {
    try {
      const feedData = await parser.parseURL(feed.url);
      feedData.items.forEach((item) => {
        if (item.title && item.link) {
          allArticles.push({
            source: feed.name,
            title: item.title,
            url: item.link,
            pubDate: item.pubDate || new Date().toISOString(),
            image: item.enclosure?.url || null,
            contentSnippet: item.contentSnippet?.substring(0, 200),
            category: "Général",
          });
        }
      });
    } catch (err) {}
  }

  const uniqueArticlesMap = new Map<string, any>();
  for (const article of allArticles) {
    if (!uniqueArticlesMap.has(article.url)) {
      uniqueArticlesMap.set(article.url, article);
    }
  }
  const uniqueArticles = Array.from(uniqueArticlesMap.values());

  if (uniqueArticles.length > 0) {
    uniqueArticles.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
    );
    await setCache(
      `news:articles:${country}`,
      JSON.stringify(uniqueArticles.slice(0, 200)),
    );
    console.log(
      `[News] ${uniqueArticles.length} articles saved for ${country}`,
    );
  }
}

export async function fullRefresh() {
  await initRedis();
  const feedList = getLocalSources();
  if (feedList) {
    const countries = Object.keys(feedList).sort((a, b) => {
      if (a === "france") return -1;
      if (b === "france") return 1;
      if (a === "united_kingdom") return -1;
      if (b === "united_kingdom") return 1;
      return a.localeCompare(b);
    });

    for (const country of countries) {
      const feeds = feedList[country];
      if (feeds) {
        await updateNewsForCountry(country, feeds);
      }
    }
    console.log(
      `[News] Finished Next refresh at ${new Date(Date.now() + 30 * 60 * 1000).toLocaleTimeString()}.`,
    );
  }
}

export async function getNewsArticles(country: string) {
  const key = country.toLowerCase().replace(/\s+/g, "_");
  const cacheKey = `news:articles:${key}`;
  const cached = await getCache(cacheKey);

  if (!cached) {
    return [];
  }

  const articles = JSON.parse(cached);
  return articles;
}

export async function getFinanceData() {
  const cacheKey = "news:finance:data";
  const cached = await getCache(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const symbols = [
    { name: "S&P 500", symbol: "^GSPC", type: "index" },
    { name: "NASDAQ", symbol: "^IXIC", type: "index" },
    { name: "CAC 40", symbol: "^FCHI", type: "index" },
    { name: "DAX", symbol: "^GDAXI", type: "index" },
    { name: "BTC", symbol: "BTC-EUR", type: "currency", unit: "EUR" },
    { name: "ETH", symbol: "ETH-EUR", type: "currency", unit: "EUR" },
    { name: "SOL", symbol: "SOL-EUR", type: "currency", unit: "EUR" },
    { name: "XRP", symbol: "XRP-EUR", type: "currency", unit: "EUR" },
    { name: "AAPL", symbol: "AAPL", type: "currency", unit: "USD" },
    { name: "NVDA", symbol: "NVDA", type: "currency", unit: "USD" },
    { name: "TSLA", symbol: "TSLA", type: "currency", unit: "USD" },
    { name: "MSFT", symbol: "MSFT", type: "currency", unit: "USD" },
    { name: "EUR/USD", symbol: "EURUSD=X", type: "forex" },
    { name: "EUR/GBP", symbol: "EURGBP=X", type: "forex" },
    { name: "GOLD", symbol: "GC=F", type: "currency", unit: "USD" },
    { name: "OIL", symbol: "CL=F", type: "currency", unit: "USD" },
  ];

  const fetchSymbol = async (item: any) => {
    try {
      const response = await client.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${item.symbol}`,
      );
      const chart = response.data.chart.result[0];
      const price = chart.meta.regularMarketPrice;
      const prevClose = chart.meta.chartPreviousClose;
      const change = ((price - prevClose) / prevClose) * 100;

      let formattedValue = "";
      if (item.type === "index") {
        formattedValue = price.toLocaleString("fr-FR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } else if (item.type === "currency") {
        formattedValue = price.toLocaleString("fr-FR", {
          style: "currency",
          currency: item.unit || "EUR",
        });
      } else if (item.type === "forex") {
        formattedValue = price.toFixed(4);
      }

      return {
        name: item.name,
        value: formattedValue,
        change: (change >= 0 ? "+" : "") + change.toFixed(2) + "%",
      };
    } catch (err) {
      return { name: item.name, value: "N/A", change: "0.00%" };
    }
  };

  const results = await Promise.all(symbols.map((s) => fetchSymbol(s)));
  await setCache(cacheKey, JSON.stringify(results), 300);
  return results;
}

nodeCron.schedule("*/30 * * * *", () => {
  fullRefresh();
});
