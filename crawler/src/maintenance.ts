import pLimit from "p-limit";
import readline from "node:readline";
import os from "node:os";
import { initDb, sql } from "./db";
import { fetchPage } from "./fetcher";
import { parseHtml } from "./parser";
import { DbBuffer } from "./buffer";
import { DomainLimiter } from "./limiter";

const CONCURRENCY = 15;
const FETCHES_PER_MIN_PER_DOMAIN = 30;

let totalToProcess = 0;
let processedCount = 0;
let updatedCount = 0;
let errorsCount = 0;
let isPaused = false;
let shouldStop = false;
let startTime = Date.now();
const lastProcessed: { url: string; domain: string }[] = [];

function setupInput() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  readline.emitKeypressEvents(process.stdin);
  process.stdin.on("keypress", (str, key) => {
    if ((key.ctrl && key.name === "c") || key.name === "s") {
      shouldStop = true;
    } else if (key.name === "p") {
      isPaused = !isPaused;
    }
  });
}

function updateDisplay() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const progress =
    totalToProcess > 0 ? (processedCount / totalToProcess) * 100 : 0;
  const barWidth = 30;
  const filledWidth = Math.floor((progress / 100) * barWidth);
  const bar = "█".repeat(filledWidth) + "░".repeat(barWidth - filledWidth);

  console.clear();
  process.stdout.write("\x1b[?25l");
  console.log("\x1b[1m\x1b[35m--- Octara Maintenance Engine ---\x1b[0m");
  console.log(
    `\x1b[1mStatut:\x1b[0m ${isPaused ? "\x1b[33mPAUSE\x1b[0m" : "\x1b[32mRE-PARSING EN COURS\x1b[0m"}`,
  );
  console.log(`\x1b[1mUptime:\x1b[0m ${uptime}s`);
  console.log(
    `\x1b[1mProgression:\x1b[0m [${bar}] \x1b[1m${progress.toFixed(1)}%\x1b[0m (${processedCount}/${totalToProcess})`,
  );
  console.log(
    `\x1b[1mSuccès:\x1b[0m \x1b[32m${updatedCount}\x1b[0m | \x1b[1mÉchecs:\x1b[0m \x1b[31m${errorsCount}\x1b[0m`,
  );

  const ramUsed = os.freemem() / 1024 / 1024 / 1024;
  console.log(`\x1b[1mRAM Dispo:\x1b[0m ${ramUsed.toFixed(2)} GB`);

  console.log("\x1b[1m\x1b[34m--- Derniers traitements ---\x1b[0m");
  lastProcessed
    .slice(0, 5)
    .forEach((p) =>
      console.log(` [\x1b[36m${p.domain}\x1b[0m] ${p.url.substring(0, 70)}...`),
    );
  console.log(
    "\n\x1b[2m[P] Pause | [S] Arrêter proprement | [CTRL+C] Quitter\x1b[0m",
  );
}

async function runMaintenance() {
  console.log("Initialisation...");
  await initDb();
  setupInput();

  const dbBuffer = new DbBuffer();
  const limiter = new DomainLimiter(FETCHES_PER_MIN_PER_DOMAIN);

  const pages = await sql`SELECT url FROM pages`;
  totalToProcess = pages.length;

  const limit = pLimit(CONCURRENCY);
  const workers = new Set<Promise<void>>();

  const displayInterval = setInterval(updateDisplay, 500);

  for (const page of pages) {
    if (shouldStop) break;

    while (isPaused) {
      await new Promise((r) => setTimeout(r, 100));
    }

    const workerPromise = limit(async () => {
      try {
        await limiter.wait(page.url);

        const html = await fetchPage(page.url);
        const parsed = parseHtml(html, page.url);

        await dbBuffer.add({
          url: page.url,
          title: parsed.title,
          description: parsed.description,
          snippet: parsed.snippet,
          language: parsed.language,
          content_hash: parsed.contentHash,
        });

        updatedCount++;
      } catch (e) {
        errorsCount++;
      } finally {
        processedCount++;
        lastProcessed.unshift({
          url: page.url,
          domain: limiter.getHostname(page.url),
        });
        if (lastProcessed.length > 5) lastProcessed.pop();
      }
    });

    workers.add(workerPromise);
    workerPromise.finally(() => workers.delete(workerPromise));

    if (workers.size >= CONCURRENCY) {
      await Promise.race(workers);
    }
  }

  await Promise.all(workers);
  await dbBuffer.flush();

  clearInterval(displayInterval);
  process.stdout.write("\x1b[?25h");
  console.log("\x1b[1m\x1b[32mMaintenance terminée !\x1b[0m");
  console.log(`Total traité: ${processedCount}/${totalToProcess}`);
  console.log(`Pages mises à jour: ${updatedCount}`);
  console.log(`Erreurs: ${errorsCount}`);

  await sql.end();
  process.exit(0);
}

runMaintenance().catch((err) => {
  console.error(err);
  process.exit(1);
});
