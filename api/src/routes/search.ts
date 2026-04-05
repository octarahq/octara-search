import { Router, Request, Response } from "express";
import * as searchService from "../services/searchService";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 50;

  if (!query) {
    res.status(400).json({ error: 'Le paramètre de requête "q" est requis.' });
    return;
  }

  const start = performance.now();
  const searchResult = await searchService.search(query, page, limit);
  const end = performance.now();

  res.json({
    query,
    page,
    totalPages: searchResult.totalPages,
    total: searchResult.total,
    limit,
    timeMs: Math.round((end - start) * 100) / 100,
    results: searchResult.results.map((r: any) => ({
      score: Math.round(r.score * 100) / 100,
      url: r.url,
      title: r.title,
      description: r.description,
      snippet: r.snippet,
      language: r.language,
      sitelinks: (r.sitelinks || []).map((sl: any) => ({
        url: sl.url,
        title: sl.title,
        description: sl.description,
        snippet: sl.snippet,
      })),
    })),
  });
});

export default router;
