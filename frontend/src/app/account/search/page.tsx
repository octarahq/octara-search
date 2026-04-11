"use client";

import React from "react";
import { Link } from "@/components/ui/Link";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "../_components/Sidebar";
import { useTranslations } from "next-intl";

export default function SearchSettingsPage() {
  const t = useTranslations("account_search");
  const tAuth = useTranslations("common.auth");
  const {
    user,
    isLoading,
    safeSearch,
    searchLanguage,
    resultsPerPage,
    openInNewTab,
    searchSuggestions,
    updateSettings,
  } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl font-black text-white mb-6">
          {tAuth("restricted_access")}
        </h1>
        <p className="text-zinc-400 mb-8 max-w-md">{tAuth("login_required")}</p>
        <Link
          href="/"
          className="px-8 py-3 bg-emerald-500 text-emerald-950 font-bold rounded-xl hover:bg-emerald-400 transition-all"
        >
          {tAuth("back_home")}
        </Link>
      </div>
    );
  }

  const safeSearchLevels = [
    {
      id: "off",
      name: t("safesearch.off.name"),
      icon: "no_adult_content",
      description: t("safesearch.off.description"),
    },
    {
      id: "moderate",
      name: t("safesearch.moderate.name"),
      icon: "verified_user",
      description: t("safesearch.moderate.description"),
    },
    {
      id: "strict",
      name: t("safesearch.strict.name"),
      icon: "lock_person",
      description: t("safesearch.strict.description"),
    },
  ];

  const languages = [
    { code: "auto", name: t("language_options.auto") },
    { code: "fr", name: t("language_options.fr") },
    { code: "en", name: t("language_options.en") },
  ];

  const resultsOptions = [10, 20, 50, 100];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-manrope">
      <Navbar />

      <div className="flex pt-16">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-64 p-8 md:p-12 max-w-5xl">
          <header className="mb-12">
            <h1 className="text-4xl font-extrabold tracking-tight text-emerald-100 mb-2 font-headline">
              {t("title")}
            </h1>
            <p className="text-slate-400 max-w-2xl">{t("description")}</p>
          </header>

          <div className="grid grid-cols-1 gap-12">
            <section>
              <h3 className="text-white text-xl font-bold mb-6 font-headline flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">
                  shield
                </span>
                {t("safesearch.title")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {safeSearchLevels.map((level) => (
                  <label key={level.id} className="cursor-pointer group">
                    <input
                      className="hidden peer"
                      name="safesearch"
                      type="radio"
                      checked={safeSearch === level.id}
                      onChange={() => updateSettings({ safeSearch: level.id })}
                    />
                    <div className="p-6 h-full rounded-2xl bg-slate-900/40 border border-slate-800/50 peer-checked:border-emerald-500 peer-checked:bg-emerald-900/10 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <span className="material-symbols-outlined text-slate-500 group-hover:text-emerald-400 transition-colors">
                          {level.icon}
                        </span>
                        <div className="w-4 h-4 rounded-full border-2 border-slate-700 peer-checked:border-emerald-500 peer-checked:bg-emerald-500 flex items-center justify-center">
                          <div
                            className={`w-1.5 h-1.5 rounded-full bg-white transition-opacity ${safeSearch === level.id ? "opacity-100" : "opacity-0"}`}
                          />
                        </div>
                      </div>
                      <h4 className="text-white font-bold mb-2">
                        {level.name}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {level.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex items-center justify-between p-6 bg-slate-900/30 rounded-2xl border border-slate-800/20">
                <div>
                  <h4 className="text-white font-bold mb-1">
                    {t("toggles.new_tab.title")}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {t("toggles.new_tab.description")}
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateSettings({ openInNewTab: !openInNewTab })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${openInNewTab ? "bg-emerald-600" : "bg-slate-700"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${openInNewTab ? "translate-x-6" : "translate-x-1"}`}
                  ></span>
                </button>
              </div>
              <div className="flex items-center justify-between p-6 bg-slate-900/30 rounded-2xl border border-slate-800/20">
                <div>
                  <h4 className="text-white font-bold mb-1">
                    {t("toggles.suggestions.title")}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {t("toggles.suggestions.description")}
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateSettings({ searchSuggestions: !searchSuggestions })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${searchSuggestions ? "bg-emerald-600" : "bg-slate-700"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${searchSuggestions ? "translate-x-6" : "translate-x-1"}`}
                  ></span>
                </button>
              </div>
            </section>

            <section className="bg-slate-900/40 rounded-[2rem] p-8 border border-slate-800/20 backdrop-blur-sm space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <span className="material-symbols-outlined text-emerald-400 text-sm">
                      language
                    </span>
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      {t("language")}
                    </label>
                  </div>
                  <div className="relative">
                    <select
                      value={searchLanguage}
                      onChange={(e) =>
                        updateSettings({ language: e.target.value })
                      }
                      className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-4 px-5 text-emerald-100 font-bold appearance-none hover:border-white/10 transition-all outline-none cursor-pointer focus:border-emerald-500/50"
                    >
                      {languages.map((lang) => (
                        <option
                          key={lang.code}
                          value={lang.code}
                          className="bg-slate-900"
                        >
                          {lang.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                      <span className="material-symbols-outlined">
                        expand_more
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <span className="material-symbols-outlined text-emerald-400 text-sm">
                      list
                    </span>
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      {t("results_per_page")}
                    </label>
                  </div>
                  <div className="flex gap-3">
                    {resultsOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => updateSettings({ resultsPerPage: opt })}
                        className={`flex-1 py-4 bg-slate-950/40 rounded-2xl border transition-all font-bold ${
                          resultsPerPage === opt
                            ? "border-emerald-500 text-emerald-400 bg-emerald-600/10"
                            : "border-white/5 text-slate-400 hover:border-white/10"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
