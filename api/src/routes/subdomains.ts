import { Router, Request, Response } from "express";
import { sql } from "../services/db";
import { spawn } from "node:child_process";
import path from "node:path";
import * as searchService from "../services/searchService";

const router = Router();

// GET /api/subdomains?root_domain=...
router.get("/", async (req: Request, res: Response) => {
  const rootDomain = req.query.root_domain as string;

  if (!rootDomain) {
    res.status(400).json({ error: "root_domain parameter is required" });
    return;
  }

  try {
    // Ensure column exists
    try {
      await sql`ALTER TABLE subdomains ADD COLUMN IF NOT EXISTS has_sitemap BOOLEAN DEFAULT NULL`;
    } catch (e) {}

    const subdomains = await sql`
      SELECT id, subdomain, created_at, has_sitemap
      FROM subdomains 
      WHERE root_domain = ${rootDomain}
      ORDER BY created_at DESC
    `;
    res.json({ subdomains });
  } catch (error) {
    console.error("Failed to fetch subdomains:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/add", async (req: Request, res: Response) => {
  const rootDomain = req.query.root as string;
  const subdomain = req.query.sub as string;

  if (!rootDomain || !subdomain) {
    res.status(400).json({ error: "root and sub parameters are required" });
    return;
  }

  try {
    const result = await sql`
            INSERT INTO subdomains (root_domain, subdomain)
            VALUES (${rootDomain}, ${subdomain})
            RETURNING *
        `;
    res.json({ success: true, subdomain: result[0] });
  } catch (error: any) {
    if (error.code === "23505") {
      // unique_violation
      res.status(400).json({ error: "Subdomain already exists" });
    } else {
      console.error("Failed to add subdomain:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

router.post("/", async (req: Request, res: Response) => {
  const { rootDomain, subdomain } = req.body;

  if (!rootDomain || !subdomain) {
    res.status(400).json({ error: "rootDomain and subdomain are required" });
    return;
  }

  try {
    const result = await sql`
      INSERT INTO subdomains (root_domain, subdomain)
      VALUES (${rootDomain}, ${subdomain})
      RETURNING *
    `;
    res.json({ success: true, subdomain: result[0] });
  } catch (error: any) {
    if (error.code === "23505") {
      res.status(400).json({ error: "Subdomain already exists" });
    } else {
      console.error("Failed to add subdomain:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// GET /api/subdomains/pages?host=...
router.get("/pages", async (req: Request, res: Response) => {
  const host = req.query.host as string;

  if (!host) {
    res.status(400).json({ error: "host parameter is required" });
    return;
  }

  try {
    // Search for pages belonging to this host
    // We match http://host/, https://host/, or just the prefix if the host is already full
    const pages = await sql`
      SELECT url, title, description, crawled_at
      FROM pages 
      WHERE url LIKE ${`http://${host}/%`} 
         OR url LIKE ${`https://${host}/%`}
         OR url = ${`http://${host}`}
         OR url = ${`https://${host}`}
      ORDER BY crawled_at DESC
      LIMIT 100
    `;
    res.json({ pages });
  } catch (error) {
    console.error("Failed to fetch pages for host:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/subdomains/sitemap?host=...
router.get("/sitemap", async (req: Request, res: Response) => {
  const host = req.query.host as string;
  if (!host) {
    res.status(400).json({ error: "host is required" });
    return;
  }

  // Parse root from host for DB update
  const parts = host.split(".");
  const root = parts.slice(-2).join(".");

  const sitemapUrls = [
    `https://${host}/sitemap.xml`,
    `http://${host}/sitemap.xml`,
    `https://${host}/sitemap_index.xml`,
    `http://${host}/sitemap_index.xml`,
  ];

  for (const url of sitemapUrls) {
    try {
      // @ts-ignore - node 24 has fetch
      const response = await fetch(url, {
        headers: { "User-Agent": "OctaraBot/1.0" },
      });
      if (response.ok) {
        const text = await response.text();
        const urls =
          text
            .match(/<loc>(.*?)<\/loc>/g)
            ?.map((m: string) => m.replace(/<\/?loc>/g, "")) || [];
        if (urls.length > 0) {
          try {
            await sql`UPDATE subdomains SET has_sitemap = true WHERE root_domain = ${root} AND subdomain = ${host}`;
          } catch (e) {}
          res.json({ success: true, url, urls });
          return;
        }
      }
    } catch (e) {
      // Continue to next attempt
    }
  }

  try {
    await sql`UPDATE subdomains SET has_sitemap = false WHERE root_domain = ${root} AND subdomain = ${host}`;
  } catch (e) {}

  res.status(404).json({ error: "Sitemap not found" });
});

// GET /api/subdomains/info?host=...
router.get("/info", async (req: Request, res: Response) => {
  const host = req.query.host as string;
  if (!host) {
    res.status(400).json({ error: "host is required" });
    return;
  }

  const parts = host.split(".");
  const root = parts.slice(-2).join(".");

  try {
    const info = await sql`
      SELECT id, subdomain, root_domain, created_at, has_sitemap
      FROM subdomains
      WHERE root_domain = ${root} AND subdomain = ${host}
    `;
    if (info.length === 0) {
      res.status(404).json({ error: "subdomain not found" });
      return;
    }
    res.json({ info: info[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/subdomains/recrawl
router.post("/recrawl", async (req: Request, res: Response) => {
  const { urls, recursive } = req.body;

  if (!urls || !Array.isArray(urls)) {
    res.status(400).json({ error: "urls array is required" });
    return;
  }

  const crawlerDir = path.resolve(__dirname, "../../../crawler");
  const args = ["run", "start", "--", "--worker", `--urls=${urls.join(",")}`];
  if (recursive === false) args.push("--norecurse");

  try {
    const child = spawn("npm", args, {
      cwd: crawlerDir,
      detached: true,
      stdio: "inherit",
      shell: true,
    });
    child.unref();
    res.json({ success: true, count: urls.length, mode: "worker-spawned" });
  } catch (error) {
    console.error("Failed to spawn crawler worker:", error);
    res.status(500).json({ error: "Failed to start crawler mission" });
  }
});

// DELETE /api/subdomains/pages?url=...
router.delete("/pages", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    await sql`DELETE FROM pages WHERE url = ${url}`;

    // Trigger incremental index removal
    const rootDir = path.resolve(__dirname, "../../../");
    const child = spawn(
      "npm",
      ["run", "start:indexer", "--", `--urls=${url}`, "--delete"],
      {
        cwd: rootDir,
        stdio: "inherit",
        shell: true,
      },
    );

    child.on("exit", (code) => {
      console.log(`[API] Indexer exited with code ${code}. Reloading index...`);
      searchService.loadIndex();
    });

    res.json({ success: true });
  } catch (e) {
    console.error("Failed to delete page:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/subdomains?id=...&remove_pages=true
router.delete("/", async (req: Request, res: Response) => {
  const id = req.query.id as string;
  const removePages = req.query.remove_pages === "true";

  if (!id) return res.status(400).json({ error: "id is required" });

  try {
    const subdomainRow =
      await sql`SELECT subdomain FROM subdomains WHERE id = ${id}`;
    if (subdomainRow.length === 0)
      return res.status(404).json({ error: "Subdomain not found" });
    const host = subdomainRow[0].subdomain;

    await sql`DELETE FROM subdomains WHERE id = ${id}`;

    if (removePages) {
      // Find all pages for this host
      const pages = await sql`
                SELECT url FROM pages 
                WHERE url LIKE ${`http://${host}/%`} 
                   OR url LIKE ${`https://${host}/%`}
                   OR url = ${`http://${host}`}
                   OR url = ${`https://${host}`}
            `;
      const urls = pages.map((p) => p.url);
      if (urls.length > 0) {
        await sql`DELETE FROM pages WHERE url IN ${sql(urls)}`;

        // Trigger incremental index removal
        const rootDir = path.resolve(__dirname, "../../../");
        const child = spawn(
          "npm",
          [
            "run",
            "start:indexer",
            "--",
            `--urls=${urls.join(",")}`,
            "--delete",
          ],
          {
            cwd: rootDir,
            stdio: "inherit",
            shell: true,
          },
        );

        child.on("exit", (code) => {
          console.log(
            `[API] Indexer exited with code ${code}. Reloading index...`,
          );
          searchService.loadIndex();
        });
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error("Failed to delete subdomain:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
