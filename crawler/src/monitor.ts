import net from "node:net";
import readline from "node:readline";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const args = process.argv.slice(2);
const getArg = (name: string) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
};

const MONITOR_HOST = getArg("--host") || "127.0.0.1";
const MONITOR_PORT =
  Number(getArg("--port")) || Number(process.env.CRAWLER_MONITOR_PORT) || 3005;
const AUTH_KEY = getArg("--key") || process.env.CRAWLER_AUTH_KEY;

async function runMonitor() {
  console.log(`Tentative de connexion à ${MONITOR_HOST}:${MONITOR_PORT}...`);
  let authenticated = !AUTH_KEY;

  const client = net.connect(MONITOR_PORT, MONITOR_HOST, () => {
    console.log("Connecté au Crawler Octara.");
    if (AUTH_KEY) {
      client.write(AUTH_KEY + "\n");
    }
  });

  let isAsking = false;

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.on("keypress", (str, key) => {
      if (isAsking) return;

      try {
        const kn = key ? key.name : str;
        const kc = key ? key.ctrl : false;

        if (kc && kn === "c") {
          console.log("\nDéconnexion du moniteur (le crawler continue).");
          client.destroy();
          process.exit(0);
        } else if (kn === "p") {
          client.write("p");
          process.stdout.write("\n\x1b[33m(Commande PAUSE envoyée)\x1b[0m\n");
        } else if (kn === "s") {
          client.write("s");
          process.stdout.write("\n\x1b[31m(Commande STOP envoyée)\x1b[0m\n");
        } else if (kn === "c") {
          isAsking = true;
          process.stdin.setRawMode(false);
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          process.stdout.write(
            "\n\x1b[1m\x1b[35m--- AJOUTER UN SEED URL ---\x1b[0m\n",
          );
          process.stdout.write("\x1b[1mEntrez l'URL:\x1b[0m ");

          rl.question("", (url) => {
            if (url.trim()) {
              client.write(`crawl ${url.trim()}\n`);
              process.stdout.write(
                `\x1b[32m✔ OK. Crawl lancé pour: ${url.trim()}\x1b[0m\n`,
              );
            }
            rl.close();
            isAsking = false;
            process.stdin.setRawMode(true);
            process.stdout.write("\x1b[2m(Reprise des stats...)\x1b[0m\n");
          });
        }
      } catch (e) {}
    });
  }

  client.on("data", (data) => {
    if (isAsking) return;

    const raw = data.toString();
    if (!authenticated) {
      if (raw.includes("AUTH_OK")) {
        authenticated = true;
        console.log("Authentification réussie !");

        const remaining = raw.split("AUTH_OK")[1];
        if (remaining) process.stdout.write(remaining);
      } else if (raw.includes("AUTH_FAILED")) {
        console.error("Authentification échouée. Clé incorrecte.");
        process.exit(1);
      }
      return;
    }
    process.stdout.write(data);
  });

  client.on("end", () => {
    console.log("\n[Monitor] Le crawler a fermé la connexion.");
    process.exit(0);
  });

  client.on("error", (err) => {
    console.error(
      "\n[Monitor] Erreur de connexion au crawler (est-il lancé ?)",
    );
    process.exit(1);
  });
}

runMonitor();
