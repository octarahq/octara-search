"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Title } from "@/components/ui/Title";
import { Link } from "@/components/ui/Link";
import { Card } from "@/components/ui/Card";
import { Navbar } from "@/components/Navbar";

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
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
      title: "Recherche Rapide",
      description:
        "Accédez instantanément aux informations dont vous avez besoin grâce à notre moteur optimisée pour la vitesse.",
    },
    {
      icon: "verified_user",
      title: "Vie Privée d'Abord",
      description:
        "Recherchez en toute confidence. Vos données sont cryptées et ne sont jamais vendues à des tiers.",
    },
    {
      icon: "dashboard",
      title: "Zéro Distraction",
      description:
        "Une interface épurée et sans publicité invasive, conçue pour se concentrer uniquement sur vos recherches.",
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
            <div className="relative bg-zinc-900/40 backdrop-blur-sm rounded-full flex items-center px-4 md:px-6 py-2.5 md:py-4 shadow-2xl ring-1 ring-white/10 hover:ring-emerald-500/40 focus-within:ring-emerald-500/60 transition-all duration-300">
              <button
                type="submit"
                className="material-symbols-outlined text-zinc-500 mr-2 md:mr-4 hover:text-emerald-400 transition-colors cursor-pointer text-xl md:text-2xl"
                data-icon="search"
              >
                search
              </button>
              <input
                className="bg-transparent border-none focus:ring-0 w-full text-base md:text-xl text-zinc-100 placeholder:text-zinc-700 font-body outline-none"
                placeholder="Rechercher sur le web..."
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="flex items-center gap-2 md:gap-3 ml-1 md:ml-2">
                <button
                  type="button"
                  className="p-1 md:p-2 text-zinc-500 hover:text-emerald-400 transition-colors"
                >
                  <span
                    className="material-symbols-outlined text-lg md:text-2xl"
                    data-icon="mic"
                  >
                    mic
                  </span>
                </button>
              </div>
            </div>
          </form>

          <div className="flex flex-wrap justify-center gap-3 md:gap-4">
            <Button
              variant="hero"
              onClick={() => handleSearch()}
              className="px-5 py-2 text-sm md:text-base md:px-8 md:py-3"
            >
              Rechercher
            </Button>
            <Button
              variant="outline"
              className="bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 text-zinc-400 px-5 py-2 text-sm md:text-base md:px-8 md:py-3"
              onClick={handleLuckySearch}
            >
              J&apos;ai de la chance
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
              Confidentialité
            </Link>
            <Link href="/terms" preserveHostLink variant="footer">
              Conditions
            </Link>
            <Link href="/status" preserveHostLink variant="footer">
              Statut
            </Link>
          </div>
          <div className="flex items-center gap-4 md:gap-6 text-[10px] md:text-sm font-medium">
            <Link href="/about" preserveHostLink variant="footer">
              À propos
            </Link>
            <Link href="/" preserveHostLink variant="footer">
              Entreprise
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
