import { Router, Request, Response } from "express";
import * as searchService from "../services/searchService";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const rawLimit = parseInt(req.query.limit as string);
  const limit = isNaN(rawLimit) ? 10 : Math.min(100, Math.max(1, rawLimit));
  const lang = (req.query.lang as string) || "auto";
  const safeSearch = (req.query.safesearch as string) || "moderate";

  console.log(`[API Search] Query: "${query}", Page: ${page}, Limit: ${limit}`);

  if (!query) {
    res.status(400).json({ error: 'Le paramètre de requête "q" est requis.' });
    return;
  }

  const start = performance.now();
  const searchResult = await searchService.search(
    query,
    page,
    limit,
    lang,
    safeSearch,
  );
  const end = performance.now();

  res.json({
    query,
    page,
    totalPages: searchResult.totalPages,
    total: searchResult.total,
    correction: searchResult.correction,
    limit,
    timeMs: Math.round((end - start) * 100) / 100,
    results: searchResult.results.map((r: any) => ({
      score: Math.round(r.score * 100) / 100,
      url: r.url,
      title: r.title,
      description: r.description,
      snippet: r.snippet,
      language: r.language,
      blur: r.blur || false,
      crawledAt: r.crawledAt,
      sitelinks: (r.sitelinks || []).map((sl: any) => ({
        url: sl.url,
        title: sl.title,
        description: sl.description,
        snippet: sl.snippet,
      })),
    })),
  });
});

router.get("/autocomplete", async (req: Request, res: Response) => {
  const query = req.query.q as string;
  if (!query) {
    res.json({ results: [] });
    return;
  }

  const suggestions = searchService.autocomplete(query);
  res.json({ results: suggestions });
});

router.post("/reload", async (req: Request, res: Response) => {
  console.log("[API Search] Reloading index requested...");
  await searchService.loadIndex();
  res.json({ success: true });
});

export default router;
