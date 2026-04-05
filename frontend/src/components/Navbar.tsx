"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

interface NavbarProps {
  initialQuery?: string;
}

export const Navbar = ({ initialQuery = "" }: NavbarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isNewsPage = pathname === "/news";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const target = isNewsPage ? "/news" : "/search";
    router.push(
      `${target}${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
    );
    setIsSidebarOpen(false);
  };

  const navLinks = [
    { href: "/news", label: "Actualités", active: isNewsPage },
    { href: "/", label: "Recherche", active: pathname === "/" },
  ];

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
            <form
              onSubmit={handleSearch}
              className="flex flex-1 max-w-2xl relative group min-w-0"
            >
              <div className="absolute inset-y-0 left-3 md:left-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-emerald-400/60 text-base md:text-xl">
                  search
                </span>
              </div>
              <input
                className="w-full bg-zinc-900/50 border-none text-zinc-100 pl-9 md:pl-12 pr-4 md:pr-12 py-1.5 md:py-2.5 rounded-full ring-1 ring-white/10 focus:ring-emerald-500/50 focus:bg-zinc-900 transition-all font-body text-[13px] md:text-sm outline-none truncate"
                placeholder={isNewsPage ? "Actualités..." : "Rechercher..."}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </form>
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
          <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-emerald-500/20 bg-zinc-800 flex items-center justify-center cursor-pointer hover:ring-emerald-500/40 transition-all">
            <span className="material-symbols-outlined text-zinc-400 text-xl md:text-2xl">
              account_circle
            </span>
          </div>
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
