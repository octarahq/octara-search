"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";

import { useState, useEffect, Suspense } from "react";
import { useTranslations } from "next-intl";

function NewsContent() {
  const t = useTranslations("news");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [liveNews, setLiveNews] = useState<any[]>([]);
  const [financeData, setFinanceData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const query = searchParams.get("q") || "";

  const formatRelativeDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / (1000 * 60));
      const diffHour = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMin < 1) return t("date.just_now");
      if (diffMin < 60) return t("date.minutes_ago", { count: diffMin });
      if (diffHour < 24) return t("date.hours_ago", { count: diffHour });
      if (diffDay < 7) return t("date.days_ago", { count: diffDay });
      return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
    } catch (e) {
      return "";
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  useEffect(() => {
    setIsLoading(true);
    const country = searchParams.get("country") || "france";

    fetch(
      `/api/news?country=${country}&page=${currentPage}&limit=22&q=${encodeURIComponent(query)}`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.articles && Array.isArray(data.articles)) {
          setLiveNews(data.articles);
          setTotalPages(data.total_pages || 1);
        }
        if (data.finance) {
          setFinanceData(data.finance);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching news:", err);
        setLiveNews([]);
        setIsLoading(false);
      });
  }, [searchParams, currentPage]);

  const stockTicker =
    financeData.length > 0
      ? financeData
      : [
          { name: "S&P 500", value: "5,241.53", change: "+1.24%" },
          { name: "BTC", value: "$68,432.10", change: "+0.85%" },
          { name: "ETH", value: "$3,521.80", change: "-0.12%" },
          { name: "GOLD", value: "$2,175.40", change: "+0.44%" },
        ];

  const prepareGridItems = () => {
    const withImg = liveNews.filter((n) => n.image);
    const noImg = liveNews.filter((n) => !n.image);

    const batches: any[] = [];
    for (let i = 0; i < noImg.length; i += 3) {
      batches.push({ type: "batch", items: noImg.slice(i, i + 3) });
    }

    const result: any[] = [];
    let imgIdx = 0;
    let batchIdx = 0;

    while (imgIdx < withImg.length || batchIdx < batches.length) {
      if (imgIdx < withImg.length)
        result.push({ type: "article", data: withImg[imgIdx++] });
      if (imgIdx < withImg.length)
        result.push({ type: "article", data: withImg[imgIdx++] });
      if (batchIdx < batches.length) result.push(batches[batchIdx++]);
    }
    return result;
  };

  const gridItems = prepareGridItems();

  const renderArticle = (item: any, i: number, isLead = false) => (
    <Link
      href={item.url}
      target="_blank"
      key={`${item.url}-${i}`}
      className={`relative group block overflow-hidden rounded-2xl md:rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-emerald-500/30 transition-all h-full ${
        isLead
          ? "col-span-2 md:row-span-2 aspect-[16/9] md:aspect-auto"
          : "aspect-square md:aspect-auto"
      } ${isLoading ? "opacity-40" : ""}`}
    >
      <img
        src={item.image}
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-700"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-95" />
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
        <div className="flex items-center justify-between mb-1 md:mb-2">
          <span className="text-emerald-400 font-manrope text-[8px] md:text-[10px] font-black uppercase tracking-widest">
            {item.source || "News"}
          </span>
          <span className="text-zinc-500 text-[8px] md:text-[9px] font-bold uppercase">
            {formatRelativeDate(item.pubDate)}
          </span>
        </div>
        <h3
          className={`${isLead ? "text-lg md:text-3xl" : "text-[11px] md:text-sm"} text-zinc-100 font-manrope font-black leading-tight group-hover:text-emerald-400 transition-colors line-clamp-3 md:line-clamp-2`}
        >
          {item.title}
        </h3>
      </div>
    </Link>
  );

  const renderBatchCard = (batch: any, i: number) => (
    <div
      key={`batch-${i}`}
      className="h-full bg-zinc-900/30 rounded-2xl md:rounded-3xl border border-white/5 p-3 md:p-5 flex flex-col gap-1.5 md:gap-3 group hover:border-emerald-500/20 transition-all min-h-[160px]"
    >
      <div className="flex items-center justify-between mb-0.5 md:mb-1">
        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            {t("flash")}
          </span>
        </div>
      </div>
      {batch.items.map((item: any, idx: number) => (
        <Link
          key={idx}
          href={item.url}
          target="_blank"
          className="flex-1 min-h-0 group/item block"
        >
          <div className="flex items-center justify-between mb-0">
            <span className="text-emerald-500/60 font-manrope text-[7px] md:text-[8px] font-bold uppercase tracking-wider group-hover/item:text-emerald-400">
              {item.source}
            </span>
            <span className="text-zinc-600 text-[7px] md:text-[8px] font-bold uppercase whitespace-nowrap ml-2">
              {formatRelativeDate(item.pubDate)}
            </span>
          </div>
          <h4 className="text-zinc-300 text-[10px] md:text-sm font-bold leading-snug line-clamp-2 group-hover/item:text-zinc-100 transition-colors">
            {item.title}
          </h4>
          {idx < batch.items.length - 1 && (
            <div className="h-px bg-white/5 mt-1 md:mt-3 w-1/2" />
          )}
        </Link>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30">
      <Navbar initialQuery={query} />

      <div className="flex min-h-screen">
        <main className="flex-1 pt-24 pb-12 px-4 md:px-6 max-w-[1920px] mx-auto overflow-hidden">
          <div className="mb-6 md:mb-8 flex items-center gap-3 md:gap-4 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 md:mx-0 md:px-0">
            {stockTicker.map((item: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-2 md:gap-3 bg-zinc-900/40 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-white/5 whitespace-nowrap"
              >
                <span className="text-[8px] md:text-[10px] font-manrope text-zinc-500 uppercase tracking-widest">
                  {item.name}
                </span>
                <span className="text-[10px] md:text-xs font-mono text-zinc-100 font-bold">
                  {item.value}
                </span>
                <span
                  className={`text-[8px] md:text-[10px] ${item.change.startsWith("+") ? "text-emerald-500" : "text-red-500/80"}`}
                >
                  {item.change}
                </span>
              </div>
            ))}
          </div>

          {!isLoading && liveNews.length === 0 && (
            <div className="py-20 text-center">
              <span className="material-symbols-outlined text-zinc-800 text-6xl mb-4">
                search_off
              </span>
              <p className="text-zinc-500">{t("no_articles")}</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 auto-rows-fr">
            {gridItems[0] &&
              gridItems[0].type === "article" &&
              renderArticle(gridItems[0].data, 0, true)}

            {gridItems
              .slice(gridItems[0]?.type === "article" ? 1 : 0)
              .map((item, i) =>
                item.type === "article"
                  ? renderArticle(item.data, i + 1)
                  : renderBatchCard(item, i + 1),
              )}
          </div>

          {totalPages > 1 && (
            <footer className="mt-20 flex flex-col items-center gap-8">
              <div className="flex items-center gap-2">
                {currentPage > 1 && (
                  <button
                    onClick={() => {
                      setCurrentPage((p) => p - 1);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 transition-all"
                  >
                    <span className="material-symbols-outlined">
                      chevron_left
                    </span>
                  </button>
                )}
                {(() => {
                  const pages = [];
                  let start = Math.max(1, currentPage - 2);
                  let end = Math.min(totalPages, start + 4);
                  if (end - start < 4) start = Math.max(1, end - 4);
                  for (let i = start; i <= end; i++) {
                    const isActive = i === currentPage;
                    pages.push(
                      <button
                        key={i}
                        onClick={() => {
                          setCurrentPage(i);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold transition-all ${isActive ? "bg-emerald-500 text-emerald-950" : "bg-zinc-900 text-zinc-400 hover:text-emerald-400"}`}
                      >
                        {i}
                      </button>,
                    );
                  }
                  return pages;
                })()}
                {currentPage < totalPages && (
                  <button
                    onClick={() => {
                      setCurrentPage((p) => p + 1);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 transition-all"
                  >
                    <span className="material-symbols-outlined">
                      chevron_right
                    </span>
                  </button>
                )}
              </div>
              <div className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">
                Octara © 2026 • {t("engine")}
              </div>
            </footer>
          )}
        </main>
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

export default function NewsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500" />
        </div>
      }
    >
      <NewsContent />
    </Suspense>
  );
}
