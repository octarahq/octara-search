import MiniSearch from "minisearch";
import { sql } from "./db";

const miniSearchOptions = {
  fields: ["url", "title", "description", "snippet", "language"],
  storeFields: ["url", "title", "description", "snippet", "language", "nsfw", "crawledAt"],
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
  lang: string = "auto",
  safeSearch: string = "moderate",
) {
  if (!indexLoaded) return { results: [], total: 0 };

  const filter =
    lang && lang !== "auto"
      ? (result: any) => result.language === lang
      : undefined;

  let allResults = searchIndex
    .search(query, {
      boost: { url: 10, title: 5, description: 2, snippet: 1 },
      combineWith: "AND",
      prefix: false,
      fuzzy: false,
      filter,
    })
    .slice(0, 400);

  if (allResults.length < 10) {
    allResults = searchIndex
      .search(query, {
        boost: { url: 10, title: 5, description: 2, snippet: 1 },
        combineWith: "AND",
        prefix: (term: string) => term.length > 3,
        fuzzy: false,
        filter,
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
        filter,
      })
      .slice(0, 100);
  }

  let filteredResults = allResults;
  if (safeSearch === "strict") {
    filteredResults = allResults.filter((r: any) => !r.nsfw);
  }

  const processedResults = filteredResults
    .map((r: any) => {
      let finalScore = r.score;
      const lowerQuery = query.toLowerCase();
      const lowerTitle = (r.title || "").toLowerCase();
      const urlString = r.url.toLowerCase();

      if (urlString.includes(lowerQuery)) finalScore *= 5;
      if (lowerTitle === lowerQuery) finalScore *= 2;
      if (urlString.length > 100) finalScore *= 0.8;

      r.score = finalScore;

      if (safeSearch === "moderate" && r.nsfw) {
        r.blur = true;
      }

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

  let correction: string | undefined;
  if (total < 500 && query.length >= 3) {
    let suggestions = searchIndex.autoSuggest(query, { fuzzy: 0 });

    if (suggestions.length === 0 && total < 20) {
      suggestions = searchIndex.autoSuggest(query, { fuzzy: 0.2 });
    }

    const bestSuggest = suggestions.find(
      (s: any) => s.suggestion.toLowerCase() !== query.toLowerCase(),
    );
    if (bestSuggest) {
      correction = bestSuggest.suggestion;
    }
  }

  return {
    total,
    results: groupedResults.slice(offset, offset + limit),
    totalPages: Math.ceil(total / limit),
    correction,
  };
}

export function autocomplete(query: string, limit: number = 8) {
  if (!indexLoaded || !query || query.length < 2) return [];

  const suggestions = searchIndex.autoSuggest(query, {
    fuzzy: (term: string) => (term.length > 5 ? 0.2 : 0),
    prefix: true,
    combineWith: "AND",
  });

  return suggestions.slice(0, limit).map((s: any) => s.suggestion);
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
