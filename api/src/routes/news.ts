import { Router, Request, Response } from "express";
import * as newsService from "../services/newsService";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const country = ((req.query.country as string) || "france").toLowerCase();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 50);
    const q = ((req.query.q as string) || "").toLowerCase();

    const [allArticles, financeData] = await Promise.all([
      newsService.getNewsArticles(country),
      newsService.getFinanceData(),
    ]);

    const filteredArticles = q
      ? allArticles.filter(
          (a: any) =>
            a.title.toLowerCase().includes(q) ||
            (a.source && a.source.toLowerCase().includes(q)),
        )
      : allArticles;

    const total = filteredArticles.length;
    const offset = (page - 1) * limit;
    const pagedArticles = filteredArticles.slice(offset, offset + limit);

    res.json({
      country,
      q,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
      total_results: total,
      finance: financeData,
      articles: pagedArticles,
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur news" });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  newsService.fullRefresh();
  res.json({ message: "News refresh started" });
});

export default router;
