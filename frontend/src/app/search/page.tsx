"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Favicon } from "@/components/Favicon";

interface SearchResult {
  score: number;
  url: string;
  title: string;
  description: string;
  snippet: string;
  language: string;
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
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const page = Number(searchParams.get("page")) || 1;

  const [data, setData] = useState<ApiResponse>({
    results: [],
    timeMs: 0,
    total: 0,
    totalPages: 0,
    page: 1,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setData({ results: [], timeMs: 0, total: 0, totalPages: 0, page: 1 });
      return;
    }

    setIsLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query)}&page=${page}`)
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setData({ results: [], timeMs: 0, total: 0, totalPages: 0, page: 1 });
        setIsLoading(false);
      });
  }, [query, page]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    router.push(`/search?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
              Environ {data.total} résultats ({data.timeMs.toFixed(3)}{" "}
              milisecondes)
            </p>
            {query && (
              <h1 className="text-zinc-100 text-lg md:text-xl font-bold mt-1">
                Résultats pour{" "}
                <span className="text-emerald-500">"{query}"</span>
              </h1>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 md:gap-8">
          {isLoading ? (
            <div className="flex flex-col gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 w-1/4 bg-zinc-800 rounded mb-2"></div>
                  <div className="h-6 w-3/4 bg-zinc-800 rounded mb-2"></div>
                  <div className="h-4 w-full bg-zinc-800 rounded"></div>
                </div>
              ))}
            </div>
          ) : data.results.length > 0 ? (
            data.results.map((result, i) => {
              const hostname = new URL(result.url).hostname;
              return (
                <div
                  key={i}
                  className="group search-item transition-all duration-300"
                >
                  <Link href={result.url}>
                    <div className="flex flex-col mb-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Favicon url={result.url} />
                        <span className="text-zinc-400 text-[10px] md:text-xs truncate max-w-[200px] sm:max-w-sm">
                          {result.url}
                        </span>
                      </div>
                      <h3 className="text-emerald-500 text-lg md:text-xl font-bold search-title hover:underline decoration-emerald-500/30 transition-all">
                        {result.title}
                      </h3>
                    </div>
                    <p className="text-zinc-400 text-xs md:text-sm leading-relaxed line-clamp-2">
                      {result.description || result.snippet}
                    </p>
                  </Link>

                  {result.sitelinks && result.sitelinks.length > 0 && (
                    <div className="mt-4 ml-2 md:ml-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-12 gap-y-3 md:gap-y-4 border-l border-zinc-800/50 pl-4 md:pl-6 py-1">
                      {result.sitelinks.map((link, idx) => {
                        const mainTitle = result.title.split("|")[0].trim();
                        let displayTitle = link.title;
                        if (displayTitle.includes("|")) {
                          const parts = displayTitle.split("|");
                          if (
                            parts[0].trim().toLowerCase() ===
                            mainTitle.toLowerCase()
                          ) {
                            displayTitle = parts.slice(1).join("|").trim();
                          }
                        }

                        return (
                          <div
                            key={idx}
                            className="flex flex-col group/sitelink"
                          >
                            <Link href={link.url}>
                              <h4 className="text-emerald-500/90 text-xs md:text-[13px] font-bold hover:underline group-hover/sitelink:text-emerald-400 transition-colors truncate">
                                {displayTitle}
                              </h4>
                              <p className="text-zinc-500 text-[10px] md:text-[11px] line-clamp-1 mt-0.5">
                                {link.snippet || link.description}
                              </p>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : query ? (
            <div className="py-20 text-center">
              <span className="material-symbols-outlined text-zinc-800 text-6xl mb-4">
                search_off
              </span>
              <p className="text-zinc-500">
                Aucun résultat trouvé pour cette recherche.
              </p>
            </div>
          ) : null}
        </div>

        {data.totalPages > 1 && (
          <footer className="mt-12 md:mt-20 flex flex-col items-center gap-8 border-t border-zinc-900 pt-8 md:pt-12">
            <div className="flex items-center gap-1.5 md:gap-2">
              {page > 1 && (
                <button
                  onClick={() => handlePageChange(page - 1)}
                  className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg md:rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-xl md:text-2xl">
                    chevron_left
                  </span>
                </button>
              )}

              {(() => {
                const pages = [];
                let start = Math.max(1, page - 2);
                let end = Math.min(data.totalPages, start + 4);

                if (end - start < 4) {
                  start = Math.max(1, end - 4);
                }

                for (let i = start; i <= end; i++) {
                  if (i < 1) continue;
                  const isActive = i === page;
                  pages.push(
                    <button
                      key={`page-${i}`}
                      onClick={() => handlePageChange(i)}
                      className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg md:rounded-xl font-manrope text-sm md:text-base font-bold transition-all active:scale-95 ${
                        isActive
                          ? "bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/20"
                          : "bg-zinc-900 text-zinc-400 hover:text-emerald-400"
                      }`}
                    >
                      {i}
                    </button>,
                  );
                }
                return pages;
              })()}

              {page < data.totalPages && (
                <button
                  onClick={() => handlePageChange(page + 1)}
                  className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg md:rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-xl md:text-2xl">
                    chevron_right
                  </span>
                </button>
              )}
            </div>
            <div className="text-zinc-600 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em]">
              Octara © 2026 • Intelligent Search Engine
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
