import path from "node:path";
import pLimit from "p-limit";
import { initDb, sql } from "./db";
import { fetchPage } from "./fetcher";
import { parseHtml, normalizeUrl } from "./parser";
import { DomainLimiter } from "./limiter";

async function refresh() {
  const args = process.argv.slice(2);
  const hostnameIndex = args.indexOf("--hostname");
  const targetHostname = hostnameIndex !== -1 ? args[hostnameIndex + 1] : null;

  if (!targetHostname) {
    console.error("Usage: npm run crawler:refresh -- --hostname XXX.xyz");
    process.exit(1);
  }

  console.log(
    `\x1b[1m\x1b[32m[Refresh] Démarrage du recrawl pour *.${targetHostname}...\x1b[0m`,
  );

  await initDb();

  const existingPages = await sql`
    SELECT url FROM pages 
    WHERE url LIKE ${`https://${targetHostname}/%`}
       OR url LIKE ${`http://${targetHostname}/%`}
       OR url LIKE ${`https://%.${targetHostname}/%`}
       OR url LIKE ${`http://%.${targetHostname}/%`}
       OR url = ${`https://${targetHostname}`}
       OR url = ${`http://${targetHostname}`}
  `;

  const queue = new Set<string>();
  const crawled = new Set<string>();
  const toDelete = new Set<string>();

  existingPages.forEach((p) => queue.add(p.url));

  queue.add(normalizeUrl(`https://${targetHostname}/`));

  console.log(
    `[Refresh] Found ${existingPages.length} existing pages + seeds to check.`,
  );

  const limiter = new DomainLimiter(100);
  const limit = pLimit(10);

  let processed = 0;
  let updated = 0;
  let deleted = 0;
  let added = 0;

  const processing = new Set<string>();
  const waiting = Array.from(queue);
  queue.clear();

  const processUrl = async (url: string) => {
    if (crawled.has(url)) return;
    crawled.add(url);
    processed++;

    try {
      await limiter.wait(url);
      const html = await fetchPage(url);
      const parsed = parseHtml(html, url);

      await sql`
        INSERT INTO pages (url, title, description, snippet, language, content_hash, crawled_at)
        VALUES (${url}, ${parsed.title}, ${parsed.description}, ${parsed.snippet}, ${parsed.language}, ${parsed.contentHash}, NOW())
        ON CONFLICT (url) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          snippet = EXCLUDED.snippet,
          language = EXCLUDED.language,
          content_hash = EXCLUDED.content_hash,
          crawled_at = NOW()
      `;

      updated++;

      parsed.links.forEach((l) => {
        try {
          const lHostname = new URL(l).hostname;
          const isTargetDomain =
            lHostname === targetHostname ||
            lHostname.endsWith(`.${targetHostname}`);

          if (isTargetDomain && !crawled.has(l) && !processing.has(l)) {
            processing.add(l);
            added++;
            activePromises.push(limit(() => processUrl(l)));
          }
        } catch (e) {}
      });
    } catch (e: any) {
      if (
        e.message?.includes("HTTP 404") ||
        e.message?.includes("getaddrinfo ENOTFOUND") ||
        e.message?.includes("connect ECONNREFUSED")
      ) {
        console.log(`[Refresh] \x1b[31mDead/Missing:\x1b[0m ${url}`);
        await sql`DELETE FROM pages WHERE url = ${url}`;
        deleted++;
      } else {
        console.error(
          `[Refresh] \x1b[33mError crawling ${url}:\x1b[0m ${e.message}`,
        );
      }
    }

    if (processed % 10 === 0) {
      console.log(
        `[Refresh] Progrès: ${processed} traités | ${updated} mis à jour | ${deleted} supprimés | ${added} nouveaux`,
      );
    }
  };

  const activePromises: Promise<void>[] = [];

  for (const url of waiting) {
    processing.add(url);
    activePromises.push(limit(() => processUrl(url)));
  }

  let index = 0;
  while (index < activePromises.length) {
    await activePromises[index];
    index++;
  }

  console.log(`\n\x1b[1m\x1b[32m[Refresh] Terminé !\x1b[0m`);
  console.log(`- Total traités: ${processed}`);
  console.log(`- Mis à jour: ${updated}`);
  console.log(`- Supprimés (404/Mort): ${deleted}`);
  console.log(`- Nouveaux ajoutés: ${added}`);

  await sql.end();
  process.exit(0);
}

refresh().catch((err) => {
  console.error(err);
  process.exit(1);
});
