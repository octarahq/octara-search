"use client";

import React, { useState, useEffect } from "react";
import { Link } from "@/components/ui/Link";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "../../_components/Sidebar";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";

interface Subdomain {
  id: number;
  subdomain: string;
  created_at: string;
  has_sitemap?: boolean;
}

export default function DomainDetailsPage() {
  const t = useTranslations("account_domains");
  const tAuth = useTranslations("common.auth");
  const tAcc = useTranslations("common.account");
  const params = useParams();
  const router = useRouter();
  const domain = params.domain as string;

  const { user, token, isLoading } = useAuth();
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [newSubdomain, setNewSubdomain] = useState("");
  const [subdomainSearch, setSubdomainSearch] = useState("");
  const [isAddingSubdomain, setIsAddingSubdomain] = useState(false);
  const [isLoadingSubdomains, setIsLoadingSubdomains] = useState(true);
  const [deletingSubdomain, setDeletingSubdomain] = useState<Subdomain | null>(
    null,
  );

  const fetchSubdomains = async (rootDomain: string) => {
    setIsLoadingSubdomains(true);
    try {
      const res = await fetch(`/api/subdomains?root_domain=${rootDomain}`);
      if (res.ok) {
        const data = await res.json();
        setSubdomains(data.subdomains || []);
      }
    } catch (error) {
      console.error("Failed to fetch subdomains:", error);
    } finally {
      setIsLoadingSubdomains(false);
    }
  };

  const deleteSubdomain = async (id: number, removePages: boolean) => {
    try {
      const res = await fetch(
        `/api/subdomains?id=${id}&remove_pages=${removePages}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        setSubdomains(subdomains.filter((s) => s.id !== id));
        setDeletingSubdomain(null);
      }
    } catch (error) {
      console.error("Failed to delete subdomain:", error);
    }
  };

  const addSubdomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain || !newSubdomain.trim()) return;

    const finalSubdomain = newSubdomain.trim().toLowerCase();
    if (!finalSubdomain.endsWith(domain)) {
      alert("Le sous-domaine doit se terminer par " + domain);
      return;
    }

    setIsAddingSubdomain(true);
    try {
      const res = await fetch("/api/subdomains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootDomain: domain,
          subdomain: finalSubdomain,
        }),
      });
      if (res.ok) {
        setNewSubdomain("");
        await fetchSubdomains(domain);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to add subdomain");
      }
    } catch (error) {
      console.error("Failed to add subdomain:", error);
    } finally {
      setIsAddingSubdomain(false);
    }
  };

  useEffect(() => {
    if (domain) {
      fetchSubdomains(domain);
    }
  }, [domain]);

  if (isLoading || (isLoadingSubdomains && subdomains.length === 0)) {
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-manrope">
      <Navbar />

      <div className="flex pt-16">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-64 p-8 md:p-12 max-w-5xl">
          <header className="mb-12">
            <div className="flex items-center gap-6">
              <button
                onClick={() => router.push("/account/domains")}
                className="w-12 h-12 bg-slate-900 rounded-2xl border border-white/5 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all flex items-center justify-center group"
              >
                <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">
                  arrow_back
                </span>
              </button>
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight text-emerald-100 mb-1">
                  {t("details.title", { domain })}
                </h1>
                <p className="text-slate-400">{t("details.description")}</p>
              </div>
            </div>
          </header>

          <div className="space-y-8">
            <section className="bg-slate-900/40 rounded-[2rem] p-8 border border-slate-800/20 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-emerald-100 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">
                  add_circle
                </span>
                {t("details.add_title")}
              </h2>
              <form onSubmit={addSubdomain} className="flex gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newSubdomain}
                    onChange={(e) => setNewSubdomain(e.target.value)}
                    placeholder={t("details.add_placeholder", { domain })}
                    className="w-full bg-slate-950/60 border border-white/5 rounded-2xl py-4 px-6 text-emerald-100 font-bold placeholder:text-slate-600 focus:border-emerald-500/50 outline-none transition-all shadow-inner"
                  />
                </div>
                <button
                  disabled={isAddingSubdomain || !newSubdomain.trim()}
                  className="px-8 bg-emerald-500 text-emerald-950 font-black rounded-2xl hover:bg-emerald-400 transition-all disabled:opacity-50"
                >
                  {isAddingSubdomain ? "..." : t("details.add_button")}
                </button>
              </form>
            </section>

            <section className="bg-slate-900/40 rounded-[2rem] p-8 border border-slate-800/20 backdrop-blur-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <h2 className="text-xl font-bold text-emerald-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500">
                    account_tree
                  </span>
                  {t("details.list_title")}
                </h2>
                <div className="relative w-full md:w-80">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">
                    search
                  </span>
                  <input
                    type="text"
                    value={subdomainSearch}
                    onChange={(e) => setSubdomainSearch(e.target.value)}
                    placeholder={t("details.search_placeholder")}
                    className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-emerald-100 focus:border-emerald-500/30 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {isLoadingSubdomains ? (
                  <div className="py-20 text-center">
                    <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                  </div>
                ) : subdomains.filter((s) =>
                    s.subdomain.includes(subdomainSearch),
                  ).length === 0 ? (
                  <div className="py-20 text-center bg-slate-950/20 rounded-[2rem] border border-dashed border-white/5">
                    <span className="material-symbols-outlined text-slate-700 text-5xl mb-4">
                      domain_disabled
                    </span>
                    <p className="text-slate-500 font-medium">
                      {t("details.empty")}
                    </p>
                  </div>
                ) : (
                  subdomains
                    .filter((s) => s.subdomain.includes(subdomainSearch))
                    .map((sub) => {
                      const isRoot = sub.subdomain === domain;
                      const host = isRoot
                        ? "@"
                        : sub.subdomain.replace(`.${domain}`, "");

                      return (
                        <Link
                          key={sub.id}
                          href={`/account/domains/${domain}/${encodeURIComponent(host)}`}
                          className="group p-6 bg-slate-950/40 rounded-[1.5rem] border border-white/5 flex items-center justify-between hover:border-emerald-500/30 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <span
                                  className={`material-symbols-outlined text-xl ${
                                    sub.has_sitemap
                                      ? "text-emerald-500"
                                      : "text-red-500"
                                  }`}
                                >
                                  {sub.has_sitemap ? "language" : "warning"}
                                </span>
                              </div>
                            </div>
                            <span className="text-lg font-bold text-emerald-50 font-mono tracking-tight">
                              {sub.subdomain}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            {sub.has_sitemap === false && (
                              <span className="hidden md:inline text-[10px] font-bold uppercase tracking-wider text-red-500/80 bg-red-500/5 px-2 py-1 rounded border border-red-500/10">
                                No Sitemap
                              </span>
                            )}
                            <span className="text-xs font-medium text-slate-500 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-white/5">
                              {new Date(sub.created_at).toLocaleDateString()}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setDeletingSubdomain(sub);
                              }}
                              className="w-10 h-10 rounded-xl bg-red-500/5 text-red-500/40 hover:bg-red-500/10 hover:text-red-500 border border-transparent hover:border-red-500/20 transition-all flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                delete
                              </span>
                            </button>
                            <span className="material-symbols-outlined text-slate-600 group-hover:text-emerald-500 transition-colors">
                              chevron_right
                            </span>
                          </div>
                        </Link>
                      );
                    })
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingSubdomain && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 sm:p-0">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setDeletingSubdomain(null)}
          />
          <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
            <header className="p-8 pb-0 flex items-center justify-between">
              <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500 text-3xl">
                  delete_forever
                </span>
              </div>
              <button
                onClick={() => setDeletingSubdomain(null)}
                className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-slate-400 transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="p-8 pt-6">
              <h2 className="text-2xl font-black text-white mb-2 leading-tight">
                {t("details.delete_modal.title", {
                  subdomain: deletingSubdomain.subdomain,
                })}
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                {t("details.delete_modal.description")}
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => deleteSubdomain(deletingSubdomain.id, true)}
                  className="w-full p-6 bg-red-500/10 border border-red-500/20 rounded-3xl hover:bg-red-500/20 transition-all group flex items-start gap-4 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-red-400">
                      auto_delete
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-red-400 group-hover:text-red-300 transition-colors">
                      {t("details.delete_modal.full_clean")}
                    </div>
                    <div className="text-[11px] text-red-500/60 font-medium">
                      {t("details.delete_modal.full_clean_desc")}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => deleteSubdomain(deletingSubdomain.id, false)}
                  className="w-full p-6 bg-slate-800/40 border border-white/5 rounded-3xl hover:border-white/10 transition-all group flex items-start gap-4 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-slate-400">
                    <span className="material-symbols-outlined">link_off</span>
                  </div>
                  <div>
                    <div className="font-bold text-slate-200 group-hover:text-white transition-colors">
                      {t("details.delete_modal.simple_remove")}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {t("details.delete_modal.simple_remove_desc")}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <footer className="p-8 bg-slate-950/30 border-t border-white/5">
              <button
                onClick={() => setDeletingSubdomain(null)}
                className="w-full py-4 text-slate-400 font-bold hover:text-white transition-colors"
              >
                {t("details.delete_modal.cancel")}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
