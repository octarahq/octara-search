import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";

import searchRouter from "./routes/search";
import newsRouter from "./routes/news";
import * as searchService from "./services/searchService";
import * as newsService from "./services/newsService";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/search", searchRouter);
app.use("/api/news", newsRouter);

app.get("/api/stats", async (req: Request, res: Response) => {
  const searchStats = await searchService.getStats();
  const newsCacheList = await newsService.getCache("news:feeds:list");
  const feedCount = newsCacheList
    ? Object.keys(JSON.parse(newsCacheList)).length
    : 0;

  res.json({
    status: "online",
    search: searchStats,
    news: {
      countries_cached: feedCount,
      redis_connected: true,
    },
    uptime: Math.floor(process.uptime()),
    memory:
      Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
  });
});

app.listen(PORT, async () => {
  console.log(`[API] server started on http://localhost:${PORT}`);

  await searchService.loadIndex();

  console.log(`[API] Starting news sync...`);
  newsService.fullRefresh();
});
