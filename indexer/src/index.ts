import MiniSearch from "minisearch";
import {
  sql,
  countPages,
  fetchPages,
  saveIndex,
  loadIndex,
  fetchSpecificPages,
} from "./db";

const BATCH_SIZE = 5000;

const miniSearchOptions = {
  fields: ["url", "title", "description", "snippet", "language"],
  storeFields: ["url", "title", "description", "snippet", "language", "nsfw"],
  idField: "url",
};

async function buildIndex() {
  const args = process.argv.slice(2);
  const targetUrls = args
    .find((a) => a.startsWith("--urls="))
    ?.split("=")[1]
    ?.split(",");

  const shouldDelete = args.includes("--delete");

  if (targetUrls && targetUrls.length > 0) {
    console.log(
      `[Indexer] ${shouldDelete ? "Suppression" : "Mise à jour"} incrémentielle pour ${targetUrls.length} pages...`,
    );
    try {
      const rawIndex = await loadIndex();
      let miniSearch: MiniSearch;

      if (rawIndex) {
        miniSearch = MiniSearch.loadJSON(rawIndex, miniSearchOptions);
      } else {
        miniSearch = new MiniSearch(miniSearchOptions);
      }

      if (shouldDelete) {
        targetUrls.forEach((url) => {
          if (miniSearch.has(url)) {
            miniSearch.discard(url);
          }
        });
      } else {
        const rows = await fetchSpecificPages(targetUrls);
        rows.forEach((row: any) => {
          if (miniSearch.has(row.url)) {
            miniSearch.discard(row.url);
          }
          miniSearch.add(row);
        });
      }

      miniSearch.vacuum();
      await saveIndex(JSON.stringify(miniSearch));
      console.log("[Indexer] Opération terminée.");

      // Notify the API to reload the index
      try {
        const apiPort = process.env.API_PORT || 3001;
        await fetch(`http://localhost:${apiPort}/api/search/reload`, {
          method: "POST",
        });
        console.log("[Indexer] API notified of index change.");
      } catch (err) {
        console.error(
          "[Indexer] Failed to notify API of index change:",
          (err as any).message,
        );
      }
    } catch (error) {
      console.error("[Indexer] Erreur incrémentielle:", error);
    } finally {
      await sql.end();
    }
    return;
  }

  console.log("[Indexer] Démarrage de la reconstruction complète...");
  try {
    const totalPages = await countPages();
    console.log(`[Indexer] ${totalPages} pages à indexer.`);

    const miniSearch = new MiniSearch(miniSearchOptions);
    const indexedIds = new Set<string>();

    let offset = 0;
    while (offset < totalPages) {
      const rows = await fetchPages(BATCH_SIZE, offset);
      if (rows.length === 0) break;

      const uniqueRows = rows.filter((row: any) => {
        if (indexedIds.has(row.url)) return false;
        indexedIds.add(row.url);
        return true;
      });

      miniSearch.addAll(uniqueRows);

      offset += rows.length;
      console.log(`[Indexer] Indexé ${offset}/${totalPages} pages`);
    }

    console.log("[Indexer] Sérialisation en JSON...");
    const indexJson = JSON.stringify(miniSearch);

    console.log("[Indexer] Sauvegarde de l'index dans PostgreSQL...");
    await saveIndex(indexJson);

    console.log("[Indexer] Terminé !");

    // Notify the API to reload the index
    try {
      const apiPort = process.env.API_PORT || 3001;
      await fetch(`http://localhost:${apiPort}/api/search/reload`, {
        method: "POST",
      });
      console.log("[Indexer] API notified of index change (Full).");
    } catch (err) {
      console.error(
        "[Indexer] Failed to notify API (Full):",
        (err as any).message,
      );
    }
  } catch (error) {
    console.error("[Indexer] Erreur:", error);
  } finally {
    await sql.end();
  }
}

buildIndex();
