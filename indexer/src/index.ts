import MiniSearch from "minisearch";
import { sql, countPages, fetchPages, saveIndex } from "./db";

const BATCH_SIZE = 5000;

const miniSearchOptions = {
  fields: ["url", "title", "description", "snippet", "language"],
  storeFields: ["url", "title", "description", "snippet", "language"],
  idField: "url",
};

async function buildIndex() {
  console.log("[Indexer] Démarrage...");

  try {
    const totalPages = await countPages();
    console.log(`[Indexer] ${totalPages} pages à indexer.`);

    const miniSearch = new MiniSearch(miniSearchOptions);
    const indexedIds = new Set<string>();

    let offset = 0;
    while (offset < totalPages) {
      const rows = await fetchPages(BATCH_SIZE, offset);
      if (rows.length === 0) break;

      const uniqueRows = rows.filter((row) => {
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
  } catch (error) {
    console.error("[Indexer] Erreur:", error);
  } finally {
    await sql.end();
  }
}

buildIndex();
