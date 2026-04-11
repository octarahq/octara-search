import pLimit from "p-limit";
import readline from "node:readline";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import { execSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
import { initDb, sql } from "./db";
import { BloomManager } from "./bloom";
import { QueueManager } from "./queue";
import { fetchPage } from "./fetcher";
import { parseHtml, normalizeUrl, parseSitemap } from "./parser";
import { DbBuffer } from "./buffer";
import { DomainLimiter } from "./limiter";
import { HostCache } from "./host-cache";

const args = process.argv.slice(2);
const WORKER_MODE = args.includes("--worker");
const WORKER_URLS =
  args
    .find((a) => a.startsWith("--urls="))
    ?.split("=")[1]
    ?.split(",") || [];
const WORKER_RECURSIVE = !args.includes("--norecurse");

const SEED_URLS: string[] = WORKER_MODE ? [] : ["https://www.allocine.fr/"];
const MAX_PAGES_TO_CRAWL = Number.MAX_SAFE_INTEGER;
const CONCURRENCY = WORKER_MODE ? 50 : 150;
const FETCHES_PER_MIN_PER_DOMAIN = 1200;

const FRESH_START = false;
const MONITOR_PORT = Number(process.env.CRAWLER_MONITOR_PORT) || 3005;
const AUTH_KEY = process.env.CRAWLER_AUTH_KEY;
const REFRESH_INTERVAL_HOURS = 24;
const ALLOWED_DOMAIN = "";

const FORCED_CRAWL_DEPTH = 5;
const IDLE_START = process.env.IDLE_START === "true" && !WORKER_MODE;

let pagesCrawled = 0;
let errorsCount = 0;
let onSeedAdded: (() => void) | null = null;
let isPaused = false;
let shouldStop = false;
let isIdling = false;
let lastPages: { url: string; domain: string }[] = [];
let startTime = Date.now();
const activeClients = new Set<net.Socket>();
const missionUrls = new Set<string>();
const activeCrawls = new Set<string>();
const activeWorkers = new Set<Promise<void>>();

function handleStop(reason: string = "Manuel") {
  console.log(`\n[Crawler] Arrêt demandé (Raison: ${reason})`);
  shouldStop = true;
  if (onSeedAdded) {
    onSeedAdded();
  }
}

const bloom = new BloomManager();
const queue = new QueueManager(WORKER_MODE);
const dbBuffer = new DbBuffer();
if (WORKER_MODE) (dbBuffer as any).limit = 1;
const limiter = new DomainLimiter(FETCHES_PER_MIN_PER_DOMAIN);
const hostCache = new HostCache();

function broadcastStats() {
  const stats = getDisplayString(queue.length());
  if (process.stdin.isTTY && process.env.QUIET !== "true") {
    process.stdout.write(stats);
  }
  activeClients.forEach((s) => s.write(stats));
}

function isUrlAllowed(url: string, allowed: string): boolean {
  try {
    const u = new URL(url);
    if (allowed) {
      const host = u.hostname;
      const isDomainAllowed = host === allowed || host.endsWith("." + allowed);
      if (!isDomainAllowed) return false;
    }

    const forbiddenExts = [
      ".pdf",
      ".zip",
      ".jpg",
      ".png",
      ".gif",
      ".docx",
      ".xlsx",
      ".pptx",
      ".mp4",
      ".mp3",
    ];
    const lowercaseUrl = url.toLowerCase();
    if (forbiddenExts.some((ext) => lowercaseUrl.endsWith(ext))) return false;

    const segments = u.pathname.split("/").filter((s) => s.length > 0);
    if (segments.length > 10) return false;

    return true;
  } catch {
    return false;
  }
}

function getDisplayString(queueLength: number) {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const avgSpeed = uptime > 0 ? (pagesCrawled / uptime).toFixed(2) : 0;
  const ramUsed = os.freemem() / 1024 / 1024 / 1024;
  const cpuLoad = os.loadavg()[0];

  let statusText = "\x1b[32mEN COURS\x1b[0m";
  if (shouldStop) statusText = "\x1b[31mARRÊT EN COURS...\x1b[0m";
  else if (isPaused) statusText = "\x1b[33mPAUSE\x1b[0m";
  else if (isIdling) statusText = "\x1b[35mEN ATTENTE\x1b[0m";

  let output = "\x1b[2J\x1b[H";
  output += "\x1b[1m\x1b[32m--- OctaraBot Crawler CLI ---\x1b[0m\n";
  output += `\x1b[1mStatut:\x1b[0m ${statusText}\n`;
  output += `\x1b[1mUptime:\x1b[0m ${uptime}s | \x1b[1mConcurrence:\x1b[0m ${CONCURRENCY}\n`;
  output += `\x1b[1mPages:\x1b[0m ${pagesCrawled} | \x1b[1mErreurs:\x1b[0m ${errorsCount}\n`;
  output += `\x1b[1mVitesse:\x1b[0m ${avgSpeed} p/s\n`;
  output += `\x1b[1mQueue:\x1b[0m ${queueLength} items\n`;
  output += `\x1b[1mCPU (1m):\x1b[0m ${cpuLoad.toFixed(2)}\n`;
  output += "\x1b[1m\x1b[34m--- Dernières pages (Diversifiées) ---\x1b[0m\n";
  lastPages.forEach((p) => {
    output += ` [\x1b[36m${p.domain}\x1b[0m] ${p.url.substring(0, 50)}...\n`;
  });
  output +=
    "\n\x1b[2m[P] Pause/Reprise | [S] Arrêter | [C] Nouveau Seed | [CTRL+C] Quitter\x1b[0m\n";
  return output;
}

function setupRemoteMonitor(queueProvider: () => number) {
  const server = net.createServer((socket) => {
    let isAuthenticated = !AUTH_KEY;

    socket.on("data", (data) => {
      const raw = data.toString().trim();

      if (!isAuthenticated) {
        if (raw === AUTH_KEY) {
          isAuthenticated = true;
          socket.write("AUTH_OK\n");
          activeClients.add(socket);
          socket.write(getDisplayString(queueProvider()));
        } else {
          socket.write("AUTH_FAILED\n");
          socket.end();
        }
        return;
      }

      const cmd = raw.toLowerCase();
      if (cmd.includes("p")) {
        isPaused = !isPaused;
        broadcastStats();
      }
      if (cmd.includes("s")) {
        handleStop("Moniteur");
        broadcastStats();

        socket.destroy();
      }

      if (cmd.startsWith("crawl ")) {
        const parts = raw.split(" ").slice(1);
        let recursive = true;
        const urlIndex = parts.findIndex((p) => !p.startsWith("--"));
        const noRecurseIndex = parts.indexOf("--norecurse");

        if (noRecurseIndex !== -1) {
          recursive = false;
        }

        const url = parts[urlIndex]?.trim();
        if (url) {
          try {
            const norm = normalizeUrl(url);
            queue.enqueue(norm, 0, false, recursive);
            if (onSeedAdded) onSeedAdded();
            socket.write(`ADDED: ${norm} (recursive: ${recursive})\n`);
            broadcastStats();
          } catch (e) {
            socket.write(`ERROR: Invalid URL\n`);
          }
        }
      }
    });

    socket.on("close", () => activeClients.delete(socket));
    socket.on("error", () => activeClients.delete(socket));
  });

  server.listen(MONITOR_PORT, "0.0.0.0", () => {
    console.log(`[Monitor] Dashboard server listening on port ${MONITOR_PORT}`);
  });
  return server;
}

function setupLocalInput() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.on("keypress", (str, key) => {
      if (key.ctrl && key.name === "c") handleStop("CTRL+C");
      else if (key.name === "p") {
        isPaused = !isPaused;
        broadcastStats();
      } else if (key.name === "s") handleStop("Touche S");
    });
  }
}

async function start() {
  await initDb();
  if (!WORKER_MODE) setupLocalInput();

  if (WORKER_MODE) {
    console.log(`[Worker] Starting mission for ${WORKER_URLS.length} URLs...`);
    WORKER_URLS.forEach((u) => queue.enqueue(u, 0, false, WORKER_RECURSIVE));
  } else if (IDLE_START) {
    console.log(
      "\x1b[35m[Crawler] Mode IDLE activé. Le crawler attend des instructions...\x1b[0m",
    );
  } else {
    bloom.load(false);
    await queue.load(SEED_URLS, FRESH_START);
  }

  const monitorServer = !WORKER_MODE
    ? setupRemoteMonitor(() => queue.length())
    : null;

  process.on("SIGINT", () => {
    console.log("\n[Crawler] Signal d'arrêt reçu (SIGINT). Arrêt propre...");
    handleStop("SIGINT");
  });

  process.on("SIGTERM", () => {
    console.log("\n[Crawler] Signal d'arrêt reçu (SIGTERM). Arrêt propre...");
    handleStop("SIGTERM");
  });

  process.on("SIGHUP", () => {
    console.log("[Crawler] Terminal fermé, continuation en arrière-plan...");
  });

  const waitForSeed = () =>
    new Promise<void>((resolve) => {
      onSeedAdded = resolve;
    });

  if (process.stdin.isTTY) process.stdout.write("\x1b[?25l");

  const displayInterval = setInterval(() => {
    const stats = getDisplayString(queue.length());
    if (process.stdin.isTTY && process.env.QUIET !== "true") {
      process.stdout.write(stats);
    }
    activeClients.forEach((s) => s.write(stats));
  }, 1000);

  while (true) {
    if (!shouldStop && queue.length() === 0 && activeWorkers.size === 0) {
      if (WORKER_MODE) {
        console.log("\n[Worker] Mission complete. Exiting.");
        process.exit(0);
      }
      if (SEED_URLS.length > 0 && !IDLE_START) {
        SEED_URLS.forEach((u) => queue.enqueue(u, 0));
        SEED_URLS.length = 0;
      } else {
        console.log(
          "\n[Crawler] Idling. En attente d'un nouveau seed via le moniteur...",
        );
        isIdling = true;
        await waitForSeed();
        isIdling = false;
        if (shouldStop) continue;
        isPaused = false;
        pagesCrawled = 0;
        errorsCount = 0;
      }
    }

    while (
      !shouldStop &&
      (pagesCrawled < MAX_PAGES_TO_CRAWL || queue.length() > 0)
    ) {
      if (isPaused) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      if (queue.length() > 0 && activeWorkers.size < CONCURRENCY) {
        const item = queue.dequeue();
        if (!item) continue;
        const { url: normUrl, depth } = item;

        const isInitialSeed =
          SEED_URLS.includes(normUrl) && pagesCrawled < SEED_URLS.length;
        const isForced = depth <= FORCED_CRAWL_DEPTH;

        if (!isForced && !isInitialSeed && bloom.has(normUrl)) {
          continue;
        }

        if (activeCrawls.has(normUrl)) continue;
        activeCrawls.add(normUrl);

        const workerPromise = (async () => {
          try {
            const domain = limiter.getHostname(normUrl);
            await limiter.wait(normUrl);

            const robots = await hostCache.getRobots(domain);
            if (robots) {
              const initialSitemaps =
                await hostCache.getSitemapsFromRobots(domain);
              hostCache.addSitemaps(domain, initialSitemaps);
            }

            const pendingSitemaps = hostCache.getSitemaps(domain);
            let sitemapsProcessedInThisTurn = 0;
            while (
              pendingSitemaps.length > 0 &&
              sitemapsProcessedInThisTurn < 500
            ) {
              const sUrl = pendingSitemaps.shift()!;
              if (!hostCache.isSitemapProcessed(sUrl)) {
                try {
                  const sXml = await fetchPage(sUrl);
                  const { urls, nestedSitemaps } = parseSitemap(sXml);

                  urls.forEach((u) => {
                    const nu = normalizeUrl(u);
                    if (
                      isUrlAllowed(nu, ALLOWED_DOMAIN) &&
                      (WORKER_MODE || !bloom.has(nu))
                    ) {
                      queue.enqueue(nu, depth + 1, false, false);
                    }
                  });

                  const limitedSitemaps = nestedSitemaps.slice(0, 50);
                  limitedSitemaps.forEach((nu) => {
                    const m = normalizeUrl(nu);

                    if (
                      isUrlAllowed(m, ALLOWED_DOMAIN) &&
                      !pendingSitemaps.includes(m)
                    ) {
                      pendingSitemaps.push(m);
                    }
                  });

                  hostCache.markSitemapProcessed(sUrl);
                  hostCache.addSitemaps(domain, [sUrl]);
                  sitemapsProcessedInThisTurn++;
                } catch (se) {}
              }
            }

            if (!isForced && !isInitialSeed) {
              const row = (
                await sql`SELECT crawled_at FROM pages WHERE url = ${normUrl}`
              ).at(0);
              if (row) {
                const lastCrawl = new Date(row.crawled_at).getTime();
                const hoursSince = (Date.now() - lastCrawl) / (1000 * 60 * 60);
                if (hoursSince < REFRESH_INTERVAL_HOURS) return;
              }
            }

            const html = await fetchPage(normUrl);
            const parsed = parseHtml(html, normUrl);

            if (item.recursive) {
              if (parsed.sitemaps.length > 0) {
                hostCache.addSitemaps(domain, parsed.sitemaps.slice(0, 50));
              }

              parsed.links.forEach((l) => {
                if (isUrlAllowed(l, ALLOWED_DOMAIN)) {
                  const linkDomain = limiter.getHostname(l);

                  if (
                    linkDomain !== domain &&
                    !hostCache.getSitemaps(linkDomain).length
                  ) {
                    queue.enqueue(`https://${linkDomain}/`, 0);
                  }

                  if (!bloom.has(l)) {
                    queue.enqueue(l, depth + 1);
                  }
                }
              });
            }

            await dbBuffer.add({
              url: normUrl,
              title: parsed.title,
              description: parsed.description,
              snippet: parsed.snippet,
              language: parsed.language,
              content_hash: parsed.contentHash,
              nsfw: parsed.nsfw,
            });
            bloom.add(normUrl);
            missionUrls.add(normUrl);
            pagesCrawled++;
            lastPages.unshift({
              url: normUrl,
              domain: limiter.getHostname(normUrl),
            });
            if (lastPages.length > 8) lastPages.pop();
          } catch (e: any) {
            console.error(`Error crawling ${normUrl}:`, e.message);
            errorsCount++;
          } finally {
            activeCrawls.delete(normUrl);
          }
        })();

        activeWorkers.add(workerPromise);
        workerPromise.finally(() => activeWorkers.delete(workerPromise));
      } else if (queue.length() === 0 && activeWorkers.size === 0) {
        break;
      } else {
        await new Promise((r) => setTimeout(r, 50));
      }

      if (pagesCrawled % 5000 === 0 && pagesCrawled > 0) {
        setTimeout(async () => {
          try {
            bloom.save();
            queue.save();
            hostCache.save();
          } catch (e) {}
        }, 0);
      }
    }

    console.log("\x1b[1m\x1b[31mCycle de crawl arrêté.\x1b[0m");

    await Promise.all(activeWorkers);
    await dbBuffer.flush();
    bloom.save();
    queue.save();
    hostCache.save();

    if (shouldStop || WORKER_MODE) {
      console.log(
        `\x1b[1m\x1b[33m[Indexer] Lancement de l'indexation ${WORKER_MODE ? "incrémentielle" : "complète"}...\x1b[0m`,
      );
      try {
        const rootDir = path.resolve(__dirname, "../../");
        const { spawn } = require("node:child_process");
        const indexerArgs = ["run", "start:indexer"];
        if (WORKER_MODE && missionUrls.size > 0) {
          indexerArgs.push("--", `--urls=${Array.from(missionUrls).join(",")}`);
        }

        spawn("npm", indexerArgs, {
          cwd: rootDir,
          stdio: "ignore",
          detached: true,
        }).unref();
        console.log(
          "\x1b[1m\x1b[32m[Indexer] Indexation lancée en arrière-plan.\x1b[0m",
        );
      } catch (ie) {
        console.error("[Indexer] Échec de l'indexation automatique:", ie);
      }

      console.log(`Crawl terminé ! Total: ${pagesCrawled} pages.`);
      if (process.stdin.isTTY) process.stdout.write("\x1b[?25h");
      process.exit(0);
    }
    console.log(`Crawl terminé ! Total: ${pagesCrawled} pages.`);
  }
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
