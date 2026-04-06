import MiniSearch from "minisearch";
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve(__dirname, "../../../config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const sql = postgres(config.databaseUrl, {
  max: 10,
  idle_timeout: 20,
});

const miniSearchOptions = {
  fields: ["url", "title", "description", "snippet", "language"],
  storeFields: ["url", "title", "description", "snippet", "language"],
  idField: "url",
  searchOptions: {
    boost: { url: 10, title: 5, description: 2, snippet: 1 },
    fuzzy: 0.15,
    prefix: true,
  },
};

let searchIndex = new MiniSearch(miniSearchOptions);
let indexLoaded = false;

export async function loadIndex() {
  try {
    const result = await sql`SELECT index_data FROM search_index WHERE id = 1`;

    if (result.length > 0 && result[0].index_data) {
      searchIndex = MiniSearch.loadJSON(
        result[0].index_data,
        miniSearchOptions,
      );
      indexLoaded = true;
      console.log(`[SearchService] Postgress loaded`);
    }
  } catch (error) {
    console.error(`[SearchService] Error loading index:`, error);
    indexLoaded = true;
  }
}

export async function search(
  query: string,
  page: number = 1,
  limit: number = 50,
) {
  if (!indexLoaded) return { results: [], total: 0 };

  let allResults = searchIndex
    .search(query, {
      boost: { url: 10, title: 5, description: 2, snippet: 1 },
      combineWith: "AND",
      prefix: false,
      fuzzy: false,
    })
    .slice(0, 400);

  if (allResults.length < 10) {
    allResults = searchIndex
      .search(query, {
        boost: { url: 10, title: 5, description: 2, snippet: 1 },
        combineWith: "AND",
        prefix: (term: string) => term.length > 3,
        fuzzy: false,
      })
      .slice(0, 400);
  }

  if (allResults.length === 0) {
    allResults = searchIndex
      .search(query, {
        boost: { url: 10, title: 5, description: 2, snippet: 1 },
        combineWith: "OR",
        prefix: true,
        fuzzy: 0.2,
      })
      .slice(0, 100);
  }

  const processedResults = allResults
    .map((r: any) => {
      let finalScore = r.score;
      const lowerQuery = query.toLowerCase();
      const lowerTitle = (r.title || "").toLowerCase();
      const urlString = r.url.toLowerCase();

      if (urlString.includes(lowerQuery)) finalScore *= 5;
      if (lowerTitle === lowerQuery) finalScore *= 2;
      if (urlString.length > 100) finalScore *= 0.8;

      r.score = finalScore;
      return r;
    })
    .sort((a: any, b: any) => b.score - a.score);

  const groupedResults: any[] = [];
  const domainMap = new Map<string, any>();

  for (const r of processedResults) {
    try {
      const url = new URL(r.url);
      const domain = url.hostname;

      if (!domainMap.has(domain)) {
        r.sitelinks = [];
        groupedResults.push(r);
        domainMap.set(domain, r);
      } else {
        const parent = domainMap.get(domain);
        if (parent.sitelinks.length < 4) {
          parent.sitelinks.push(r);
        }
      }
    } catch (e) {
      groupedResults.push(r);
    }
  }

  const total = groupedResults.length;
  const offset = (page - 1) * limit;

  return {
    total,
    results: groupedResults.slice(offset, offset + limit),
    totalPages: Math.ceil(total / limit),
  };
}

export async function getStats() {
  try {
    const pagesCount = await sql`SELECT COUNT(*)::int AS count FROM pages`;
    const indexInfo =
      await sql`SELECT id, LENGTH(index_data)::int as size FROM search_index WHERE id = 1`;

    return {
      total_pages: pagesCount[0]?.count || 0,
      index_ready: indexLoaded,
      index_size: indexInfo[0]?.size || 0,
      total_indexed: searchIndex.documentCount,
    };
  } catch (err) {
    return null;
  }
}
