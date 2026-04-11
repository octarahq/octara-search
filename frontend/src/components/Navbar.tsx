"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { useEffect } from "react";

import { useTranslations } from "next-intl";

interface NavbarProps {
  initialQuery?: string;
}

export const Navbar = ({ initialQuery = "" }: NavbarProps) => {
  const t = useTranslations("common.navbar");
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, login, logout, history, addToHistory, searchSuggestions } =
    useAuth();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  const isNewsPage = pathname === "/news";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (!isNewsPage && user) {
      addToHistory(query.trim());
    }

    const target = isNewsPage ? "/news" : "/search";
    router.push(`${target}?q=${encodeURIComponent(query.trim())}`);
    setIsSidebarOpen(false);
    setIsFocused(false);
  };

  useEffect(() => {
    if (!searchSuggestions || isNewsPage || query.length < 2) {
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
  }, [query, searchSuggestions, isNewsPage]);

  const navLinks = [
    { href: "/news", label: t("news"), active: isNewsPage },
    { href: "/", label: t("search"), active: pathname === "/" },
  ];

  const handleDropdownClick = (q: string) => {
    setQuery(q);
    if (!isNewsPage && user) {
      addToHistory(q);
    }
    const target = isNewsPage ? "/news" : "/search";
    router.push(`${target}?q=${encodeURIComponent(q)}`);
    setIsFocused(false);
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 shadow-xl shadow-black/20 flex items-center justify-between px-4 md:px-6 py-2 md:py-3 gap-2 md:gap-8">
        <div className="flex items-center gap-2 md:gap-8 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-1 text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          <Link
            href="/"
            className="text-xl md:text-2xl font-bold tracking-tighter text-emerald-50 font-manrope shrink-0"
          >
            <span className="md:hidden">Octara</span>
            <span className="hidden md:inline">Octara Search</span>
          </Link>
          {(pathname.startsWith("/search") || pathname.startsWith("/news")) && (
            <div className="flex-1 max-w-2xl relative group min-w-0">
              <form onSubmit={handleSearch} className="relative">
                <div className="absolute inset-y-0 left-3 md:left-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-emerald-400/60 text-base md:text-xl">
                    search
                  </span>
                </div>
                <input
                  className="w-full bg-zinc-900/50 border-none text-zinc-100 pl-9 md:pl-12 pr-4 md:pr-12 py-1.5 md:py-2.5 rounded-full ring-1 ring-white/10 focus:ring-emerald-500/50 focus:bg-zinc-900 transition-all font-body text-[13px] md:text-sm outline-none truncate"
                  placeholder={
                    isNewsPage ? `${t("news")}...` : t("placeholder")
                  }
                  type="text"
                  value={query}
                  autoComplete="off"
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => {
                    setTimeout(() => setIsFocused(false), 200);
                  }}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </form>

              {!isNewsPage &&
                isFocused &&
                (query.length >= 2
                  ? suggestions.length > 0
                  : history.length > 0) && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-y-auto max-h-64 z-50 py-2 custom-scrollbar">
                    {query.length >= 2 && suggestions.length > 0 && (
                      <div className="mb-1 pointer-events-none px-4 py-1">
                        <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest">
                          {t("suggestions")}
                        </span>
                      </div>
                    )}
                    {query.length >= 2 &&
                      suggestions.map((s, i) => (
                        <button
                          key={`suggest-${i}`}
                          onClick={() => handleDropdownClick(s)}
                          className="w-full text-left px-4 py-2 hover:bg-emerald-500/10 text-emerald-50 hover:text-emerald-400 transition-all flex items-center gap-3 text-sm font-bold"
                        >
                          <span className="material-symbols-outlined text-lg text-emerald-500/40">
                            search
                          </span>
                          {s}
                        </button>
                      ))}

                    {query.length < 2 && history.length > 0 && (
                      <>
                        <div className="mb-1 pointer-events-none px-4 py-1">
                          <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                            {t("history")}
                          </span>
                        </div>
                        {history.map((h, i) => (
                          <button
                            key={`hist-${i}`}
                            onClick={() => handleDropdownClick(h)}
                            className="w-full text-left px-4 py-2 hover:bg-white/5 text-zinc-400 hover:text-white transition-all flex items-center gap-3 text-sm"
                          >
                            <span className="material-symbols-outlined text-lg text-zinc-600">
                              history
                            </span>
                            {h}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <nav className="hidden md:flex items-center gap-4 lg:gap-6 mr-2 md:mr-6 text-xs md:text-sm font-medium">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${link.active ? "text-emerald-400 border-b border-emerald-400/50" : "text-zinc-400"} hover:text-emerald-400 transition-colors whitespace-nowrap`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/account"
                className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-emerald-500/20 bg-zinc-800 flex items-center justify-center cursor-pointer hover:ring-emerald-500/40 transition-all focus:outline-none focus:ring-emerald-500"
              >
                <UserAvatar avatarURL={user.avatarURL} name={user.name} />
              </Link>
              <button
                onClick={logout}
                className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors hidden sm:flex"
                title={t("logout")}
              >
                <span className="material-symbols-outlined text-xl">
                  logout
                </span>
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-bold"
            >
              <span className="material-symbols-outlined text-lg">login</span>
              <span className="hidden sm:inline">{t("login")}</span>
            </button>
          )}
        </div>
      </nav>

      <div
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsSidebarOpen(false)}
      />
      <aside
        className={`fixed top-0 left-0 z-[70] h-full w-72 bg-zinc-950 border-r border-white/5 p-6 transform transition-transform duration-300 ease-out md:hidden ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between mb-10">
          <span className="text-2xl font-black text-emerald-50 tracking-tighter">
            Octara
          </span>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 text-zinc-500 hover:text-emerald-400"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {user && (
          <div className="mb-10 p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-emerald-500/20">
              <UserAvatar avatarURL={user.avatarURL} name={user.name} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold truncate">
                {user.name || t("user")}
              </div>
              <div className="text-zinc-500 text-xs truncate">{user.email}</div>
            </div>
            <button
              onClick={() => {
                logout();
                setIsSidebarOpen(false);
              }}
              className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
              title="Déconnexion"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        )}

        <div className="flex flex-col gap-6">
          <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2">
            Navigation
          </div>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-4 text-lg font-bold transition-all ${link.active ? "text-emerald-400" : "text-zinc-400 hover:text-white"}`}
            >
              <span className="material-symbols-outlined text-xl">
                {link.href === "/news" ? "newspaper" : "search"}
              </span>
              {link.label}
            </Link>
          ))}
        </div>
      </aside>
    </>
  );
};
