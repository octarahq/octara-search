"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Title } from "@/components/ui/Title";
import { Link } from "@/components/ui/Link";
import { Card } from "@/components/ui/Card";
import { Navbar } from "@/components/Navbar";

import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function Home() {
  const t = useTranslations("home");
  const tf = useTranslations("common.footer");
  const tn = useTranslations("common.navbar");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { user, history, addToHistory, searchSuggestions } = useAuth();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      if (user) {
        addToHistory(query.trim());
      }
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setIsFocused(false);
    }
  };

  useEffect(() => {
    if (!searchSuggestions || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/autocomplete?q=${encodeURIComponent(query)}`,
        );
        if (res.ok) {
          const data = await res.json();
          const newSuggestions = (data.results || []).filter(
            (s: string) => s.toLowerCase() !== query.toLowerCase(),
          );
          setSuggestions(newSuggestions);
        }
      } catch (err) {
        console.error("Autocomplete fetch error:", err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, searchSuggestions]);

  const handleDropdownClick = (q: string) => {
    setQuery(q);
    if (user) {
      addToHistory(q);
    }
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setIsFocused(false);
  };

  const handleLuckySearch = async () => {
    if (!query.trim()) return;

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query.trim())}&limit=1`,
      );
      const data = await res.json();

      if (data.results && data.results.length > 0) {
        window.location.href = data.results[0].url;
      } else {
        handleSearch();
      }
    } catch (error) {
      console.error("Lucky search failed:", error);
      handleSearch();
    }
  };

  const features = [
    {
      icon: "speed",
      title: t("features.speed.title"),
      description: t("features.speed.description"),
    },
    {
      icon: "verified_user",
      title: t("features.privacy.title"),
      description: t("features.privacy.description"),
    },
    {
      icon: "dashboard",
      title: t("features.zdistraction.title"),
      description: t("features.zdistraction.description"),
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-50">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 py-20 md:py-12">
        <div className="w-full max-w-4xl flex flex-col items-center text-center gap-6 md:gap-10">
          <div className="select-none h-fit">
            <Title
              variant="h1"
              className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl drop-shadow-2xl"
            >
              Octara Search
            </Title>
          </div>

          <form
            onSubmit={handleSearch}
            className="w-full relative group max-w-3xl"
          >
            <div className="absolute inset-0 bg-emerald-500/10 blur-[100px] rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000"></div>
            <div className="relative bg-zinc-900/40 backdrop-blur-sm rounded-[2rem] flex items-center px-4 md:px-6 shadow-2xl ring-1 ring-white/10 hover:ring-emerald-500/40 focus-within:ring-emerald-500/60 transition-all duration-300">
              <button
                type="submit"
                className="material-symbols-outlined text-zinc-500 mr-2 md:mr-4 hover:text-emerald-400 transition-colors cursor-pointer text-xl md:text-2xl"
              >
                search
              </button>
              <input
                className="bg-transparent border-none focus:ring-0 w-full text-base md:text-xl text-zinc-100 placeholder:text-zinc-700 font-body py-4 md:py-6 outline-none"
                placeholder={t("placeholder")}
                type="text"
                autoComplete="off"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="flex items-center gap-2 md:gap-3 ml-1 md:ml-2">
                <button
                  type="button"
                  className="p-1 md:p-2 text-zinc-500 hover:text-emerald-400 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg md:text-2xl">
                    mic
                  </span>
                </button>
              </div>
            </div>

            {isFocused &&
              (query.length >= 2
                ? suggestions.length > 0
                : history.length > 0) && (
                <div className="absolute top-full left-4 right-4 mt-4 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-y-auto max-h-80 z-20 py-4 text-left custom-scrollbar">
                  {query.length >= 2 && suggestions.length > 0 && (
                    <div className="mb-2 px-6">
                      <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest">
                        {tn("suggestions")}
                      </span>
                    </div>
                  )}
                  {query.length >= 2 &&
                    suggestions.map((s, i) => (
                      <button
                        key={`suggest-${i}`}
                        onClick={() => handleDropdownClick(s)}
                        className="w-full text-left px-6 py-3 hover:bg-emerald-500/10 text-emerald-50 hover:text-emerald-400 transition-all flex items-center gap-4 group/item"
                      >
                        <span className="material-symbols-outlined text-emerald-500/40 group-hover/item:text-emerald-400 transition-colors">
                          search
                        </span>
                        <span className="text-lg font-bold">{s}</span>
                      </button>
                    ))}

                  {query.length < 2 && history.length > 0 && (
                    <>
                      <div className="mb-2 px-6">
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                          {tn("history")}
                        </span>
                      </div>
                      {history.map((h, i) => (
                        <button
                          key={`hist-${i}`}
                          onClick={() => handleDropdownClick(h)}
                          className="w-full text-left px-6 py-3 hover:bg-white/5 text-zinc-400 hover:text-white transition-all flex items-center gap-4 group/item"
                        >
                          <span className="material-symbols-outlined text-zinc-600 group-hover/item:text-emerald-400 transition-colors">
                            history
                          </span>
                          <span className="text-lg font-medium">{h}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
          </form>

          <div className="flex flex-wrap justify-center gap-3 md:gap-4">
            <Button
              variant="hero"
              onClick={() => handleSearch()}
              className="px-5 py-2 text-sm md:text-base md:px-8 md:py-3"
            >
              {t("search_button")}
            </Button>
            <Button
              variant="outline"
              className="bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 text-zinc-400 px-5 py-2 text-sm md:text-base md:px-8 md:py-3"
              onClick={handleLuckySearch}
            >
              {t("lucky_button")}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 w-full mt-4 md:mt-0">
            {features.map((feature, i) => (
              <Card
                key={i}
                title={feature.title}
                icon={feature.icon}
                className="p-4 md:p-5 bg-zinc-900/30 border-white/5 hover:bg-zinc-900/50 transition-colors"
              >
                <span className="text-zinc-500 text-xs md:text-sm">
                  {feature.description}
                </span>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <footer className="mt-auto py-4 md:py-6 px-6 md:px-12 bg-zinc-900/50 border-t border-white/5 shrink-0">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-500">
          <div className="flex items-center gap-4 md:gap-6 text-[10px] md:text-sm font-medium">
            <Link href="/privacy" preserveHostLink variant="footer">
              {tf("privacy")}
            </Link>
            <Link href="/terms" preserveHostLink variant="footer">
              {tf("terms")}
            </Link>
            <Link href="/status" preserveHostLink variant="footer">
              {tf("status")}
            </Link>
          </div>
          <div className="flex items-center gap-4 md:gap-6 text-[10px] md:text-sm font-medium">
            <Link href="/about" preserveHostLink variant="footer">
              {tf("about")}
            </Link>
            <Link href="/" preserveHostLink variant="footer">
              {tf("company")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
