import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Favicon } from "@/components/Favicon";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

interface SearchResult {
  score: number;
  url: string;
  title: string;
  description: string;
  snippet: string;
  language: string;
  blur?: boolean;
  sitelinks?: {
    url: string;
    title: string;
    description: string;
    snippet: string;
  }[];
}

interface ApiResponse {
  results: SearchResult[];
  timeMs: number;
  total: number;
  totalPages: number;
  page: number;
  correction?: string;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const t = await getTranslations("search");
  const resolvedParams = await searchParams;
  const query = typeof resolvedParams.q === "string" ? resolvedParams.q : "";
  return {
    title: query ? `${query}` : t("metadata.title_default"),
    description: query
      ? t("metadata.description_query", { query })
      : t("metadata.description_default"),
  };
}

import { SearchResultsList } from "@/components/SearchResultsList";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const t = await getTranslations("search");
  const resolvedParams = await searchParams;
  const query = typeof resolvedParams.q === "string" ? resolvedParams.q : "";
  const page =
    typeof resolvedParams.page === "string" ? Number(resolvedParams.page) : 1;
  const limitParam =
    typeof resolvedParams.limit === "string"
      ? Number(resolvedParams.limit)
      : null;

  let userSettings = {
    language: "auto",
    resultsPerPage: 10,
    openInNewTab: true,
    safeSearch: "moderate",
  };
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("octara_token")?.value;
    if (token) {
      const baseUrl = process.env.ACCOUNT_API_BASE_URL || "https://octara.xyz";
      const settingsRes = await fetch(`${baseUrl}/api/v1/search/settings`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data.settings) {
          userSettings = {
            language: data.settings.language || userSettings.language,
            resultsPerPage:
              data.settings.resultsPerPage || userSettings.resultsPerPage,
            openInNewTab:
              data.settings.openInNewTab !== undefined
                ? data.settings.openInNewTab
                : true,
            safeSearch: data.settings.safeSearch || userSettings.safeSearch,
          };
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch user settings in SSR:", err);
  }

  const limit = limitParam || userSettings.resultsPerPage || 10;

  let data: ApiResponse = {
    results: [],
    timeMs: 0,
    total: 0,
    totalPages: 0,
    page: 1,
  };

  if (query) {
    try {
      const baseUrl = process.env.API_URL || "http://localhost:3001";
      const searchUrl = new URL(`${baseUrl}/api/search`);
      searchUrl.searchParams.append("q", query);
      searchUrl.searchParams.append("page", page.toString());
      searchUrl.searchParams.append("limit", limit.toString());
      searchUrl.searchParams.append("lang", userSettings.language || "auto");
      searchUrl.searchParams.append("safesearch", userSettings.safeSearch);

      const res = await fetch(searchUrl.toString(), { cache: "no-store" });
      if (res.ok) {
        data = await res.json();
      }
    } catch (err) {
      console.error("SSR Fetch error:", err);
    }
  }

  const getPageUrl = (p: number) =>
    `/search?q=${encodeURIComponent(query)}&page=${p}`;

  return (
    <div className="dark h-full bg-black min-h-screen">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .font-manrope { font-family: 'Manrope', sans-serif; }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .search-item:hover .search-title { color: #10b981; }
        `,
        }}
      />

      <Navbar initialQuery={query} />

      <main className="pt-24 pb-12 px-4 md:px-6 max-w-7xl mx-auto font-manrope">
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <p className="text-zinc-500 text-xs md:text-sm">
              {t("results_stats", {
                total: data.total,
                time: data.timeMs.toFixed(3),
              })}
            </p>
            {query && (
              <h1 className="text-zinc-100 text-lg md:text-xl font-bold mt-1">
                {t("results_for")}{" "}
                <span className="text-emerald-500">&quot;{query}&quot;</span>
              </h1>
            )}
            {data.correction && (
              <p className="text-zinc-400 text-sm mt-2">
                {t("did_you_mean")}{" "}
                <Link
                  href={`/search?q=${encodeURIComponent(data.correction)}`}
                  className="text-emerald-400 font-bold hover:underline"
                >
                  {data.correction}
                </Link>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 md:gap-8">
          {data.results.length > 0 ? (
            <SearchResultsList
              initialResults={data.results}
              openInNewTab={userSettings.openInNewTab}
            />
          ) : query ? (
            <div className="py-20 text-center">
              <span className="material-symbols-outlined text-zinc-800 text-6xl mb-4">
                search_off
              </span>
              <p className="text-zinc-500">{t("no_results")}</p>
            </div>
          ) : null}
        </div>

        {data.totalPages > 1 && (
          <footer className="mt-12 md:mt-20 flex flex-col items-center gap-8 border-t border-zinc-900 pt-8 md:pt-12">
            <div className="flex items-center gap-1.5 md:gap-2">
              {page > 1 && (
                <Link
                  href={getPageUrl(page - 1)}
                  className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg md:rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-xl md:text-2xl">
                    chevron_left
                  </span>
                </Link>
              )}

              {(() => {
                const pages = [];
                let start = Math.max(1, page - 2);
                const end = Math.min(data.totalPages, start + 4);

                if (end - start < 4) {
                  start = Math.max(1, end - 4);
                }

                for (let i = start; i <= end; i++) {
                  if (i < 1) continue;
                  const isActive = i === page;
                  pages.push(
                    <Link
                      key={`page-${i}`}
                      href={getPageUrl(i)}
                      className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg md:rounded-xl font-manrope text-sm md:text-base font-bold transition-all active:scale-95 ${
                        isActive
                          ? "bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/20"
                          : "bg-zinc-900 text-zinc-400 hover:text-emerald-400"
                      }`}
                    >
                      {i}
                    </Link>,
                  );
                }
                return pages;
              })()}

              {page < data.totalPages && (
                <Link
                  href={getPageUrl(page + 1)}
                  className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg md:rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-xl md:text-2xl">
                    chevron_right
                  </span>
                </Link>
              )}
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}
