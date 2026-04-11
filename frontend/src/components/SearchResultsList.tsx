"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Favicon } from "@/components/Favicon";
import { useTranslations } from "next-intl";

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

interface SearchResultsListProps {
  initialResults: SearchResult[];
  openInNewTab: boolean;
}

export const SearchResultsList = ({
  initialResults,
  openInNewTab,
}: SearchResultsListProps) => {
  const t = useTranslations("search");
  const [unblurredUrls, setUnblurredUrls] = useState<Set<string>>(new Set());

  const toggleBlur = (url: string) => {
    setUnblurredUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  if (initialResults.length === 0) return null;

  return (
    <>
      {initialResults.map((result, i) => {
        const isContentVisible = !result.blur || unblurredUrls.has(result.url);

        return (
          <div
            key={i}
            className="group/searchitem search-item transition-all duration-300 relative"
          >
            <div className="absolute right-0 top-0 flex items-center gap-2 opacity-0 group-hover/searchitem:opacity-100 transition-opacity p-2 z-30">
              <div className="relative group/tooltip">
                <span className="material-symbols-outlined text-zinc-600 hover:text-emerald-500 cursor-help text-lg transition-colors">
                  help
                </span>
                <div className="absolute right-0 top-full mt-2 w-64 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 backdrop-blur-xl">
                  <div className="flex items-center gap-2 mb-3 border-b border-zinc-800 pb-2">
                    <span className="material-symbols-outlined text-emerald-500 text-sm">
                      analytics
                    </span>
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">
                      {t("score_analysis")}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                      <span className="text-zinc-500 text-[11px]">
                        {t("relevance_score")}
                      </span>
                      <span className="text-emerald-400 font-mono text-xs font-bold">
                        {result.score.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                      <span className="text-zinc-500 text-[11px]">
                        {t("detected_lang")}
                      </span>
                      <span className="text-zinc-300 font-mono text-xs font-bold uppercase">
                        {result.language}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              {!isContentVisible && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/40 backdrop-blur-md rounded-2xl border border-white/5 transition-all group-hover:bg-zinc-950/60">
                  <span className="material-symbols-outlined text-zinc-500 text-3xl mb-2">
                    visibility_off
                  </span>
                  <p className="text-zinc-300 text-sm font-bold mb-3">
                    {t("sensitive_content")}
                  </p>
                  <button
                    onClick={() => toggleBlur(result.url)}
                    className="px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold transition-all active:scale-95"
                  >
                    {t("show_content")}
                  </button>
                </div>
              )}

              <div
                className={
                  !isContentVisible
                    ? "blur-xl pointer-events-none select-none opacity-40"
                    : ""
                }
              >
                <Link
                  href={result.url}
                  target={openInNewTab ? "_blank" : "_self"}
                  rel={openInNewTab ? "noopener noreferrer" : undefined}
                >
                  <div className="flex flex-col mb-1 pr-10">
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
                        <div key={idx} className="flex flex-col group/sitelink">
                          <Link
                            href={link.url}
                            target={openInNewTab ? "_blank" : "_self"}
                            rel={
                              openInNewTab ? "noopener noreferrer" : undefined
                            }
                          >
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
            </div>
          </div>
        );
      })}
    </>
  );
};
