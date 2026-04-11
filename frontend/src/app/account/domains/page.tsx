"use client";

import React, { useState, useEffect } from "react";
import { Link } from "@/components/ui/Link";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "../_components/Sidebar";
import { useTranslations } from "next-intl";

interface Domain {
  id: string;
  domain: string;
  status: "PENDING" | "VERIFIED" | "FAILED";
  createdAt: string;
  verificationTxt: string;
}

export default function DomainsPage() {
  const t = useTranslations("account_domains");
  const tAuth = useTranslations("common.auth");
  const tAcc = useTranslations("common.account");
  const { user, token, isLoading } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

  const getCloudflareLink = (domainName: string, txtValue: string) => {
    const baseUrl =
      "https://dash.cloudflare.com/domainconnect/v2/domainTemplates/providers/octara.xyz/services/verification/apply";
    const params = new URLSearchParams({
      domain: domainName,
      txt: txtValue,
      redirect_uri: typeof window !== "undefined" ? window.location.href : "",
    });
    return `${baseUrl}?${params.toString()}`;
  };

  const dnsProviders = [
    {
      name: "Cloudflare",
      icon: "cloud",
      url: (d: string, v: string) => getCloudflareLink(d, v),
      isAuto: true,
    },
    {
      name: "Google Domains",
      icon: "language",
      url: () => "https://domains.google.com",
    },
    { name: "GoDaddy", icon: "shield", url: () => "https://godaddy.com" },
    {
      name: "Namecheap",
      icon: "confirmation_number",
      url: () => "https://www.namecheap.com/myaccount",
    },
    { name: "OVHcloud", icon: "dns", url: () => "https://www.ovh.com/manager" },
  ];

  const fetchDomains = async () => {
    if (!token) return;
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/v1/me/domains", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains || []);
      }
    } catch (error) {
      console.error("Failed to fetch domains:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const addDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newDomain.trim()) return;
    setIsAdding(true);

    try {
      const res = await fetch("/api/v1/me/domains", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      if (res.ok) {
        setNewDomain("");
        await fetchDomains();
      }
    } catch (error) {
      console.error("Failed to add domain:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const deleteDomain = async (id: string) => {
    if (!token) return;
    if (!confirm(tAcc("delete_domain_confirm"))) return;
    try {
      const res = await fetch(`/api/v1/me/domains?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await fetchDomains();
      }
    } catch (error) {
      console.error("Failed to delete domain:", error);
    }
  };

  const verifyDomain = async (domain: Domain) => {
    const id = domain.id;
    if (!token || verifyingIds.has(id)) return;

    setVerifyingIds((prev) => new Set(prev).add(id));

    try {
      const res = await fetch("/api/v1/me/domains/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        await fetchDomains();
      } else {
        setSelectedDomain(domain);
        setShowModal(true);
      }
    } catch (error) {
      console.error("Failed to verify domain:", error);
      alert(tAcc("connection_error_verify"));
    } finally {
      setVerifyingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(tAcc("copied_to_clipboard"));
  };

  useEffect(() => {
    if (token) {
      fetchDomains();
    }
  }, [token]);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-manrope">
      <Navbar />

      <div className="flex pt-16">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-64 p-8 md:p-12 max-w-5xl">
          <header className="mb-12">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight text-emerald-100 mb-2">
                  {t("title")}
                </h1>
                <p className="text-slate-400 max-w-2xl">{t("description")}</p>
              </div>
              <button
                onClick={fetchDomains}
                className="p-2 bg-slate-900 rounded-xl border border-white/5 text-slate-400 hover:text-emerald-400 transition-all"
              >
                <span
                  className={`material-symbols-outlined ${isRefreshing ? "animate-spin" : ""}`}
                >
                  refresh
                </span>
              </button>
            </div>
          </header>

          <div className="space-y-8">
            <section className="bg-slate-900/40 rounded-[2rem] p-8 border border-slate-800/20 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-emerald-100 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">
                  add_circle
                </span>
                {t("add.title")}
              </h2>
              <form onSubmit={addDomain} className="flex gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="exemple.com"
                    className="w-full bg-slate-950/60 border border-white/5 rounded-2xl py-4 px-6 text-emerald-100 font-bold placeholder:text-slate-600 focus:border-emerald-500/50 outline-none transition-all shadow-inner"
                  />
                </div>
                <button
                  disabled={isAdding || !newDomain.trim()}
                  className="px-8 bg-emerald-500 text-emerald-950 font-black rounded-2xl hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {isAdding ? t("add.adding") : t("add.button")}
                </button>
              </form>
              <p className="mt-4 text-xs text-slate-500 px-2 italic">
                {t("add.hint")}
              </p>
            </section>

            <section className="bg-slate-900/40 rounded-[2rem] p-8 border border-slate-800/20 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-emerald-100 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">
                  list_alt
                </span>
                {t("list.title")}
              </h2>

              <div className="grid grid-cols-1 gap-4">
                {domains.length === 0 && !isRefreshing ? (
                  <div className="py-12 text-center bg-slate-950/20 rounded-3xl border border-dashed border-white/5">
                    <span className="material-symbols-outlined text-slate-700 text-5xl mb-4">
                      domain_disabled
                    </span>
                    <p className="text-slate-500 font-medium">
                      {t("list.empty")}
                    </p>
                  </div>
                ) : (
                  domains.map((domain) => (
                    <div
                      key={domain.id}
                      className="group flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-slate-950/40 rounded-3xl border border-white/5 hover:border-emerald-500/30 transition-all"
                    >
                      <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${domain.status === "VERIFIED" ? "bg-emerald-500/10" : "bg-amber-500/10"}`}
                        >
                          <span
                            className={`material-symbols-outlined ${domain.status === "VERIFIED" ? "text-emerald-500" : "text-amber-500"}`}
                          >
                            {domain.status === "VERIFIED"
                              ? "verified"
                              : "pending"}
                          </span>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-emerald-50">
                            {domain.domain}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-md ${domain.status === "VERIFIED" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}
                            >
                              {domain.status === "VERIFIED"
                                ? t("list.status.verified")
                                : domain.status === "PENDING"
                                  ? t("list.status.pending")
                                  : t("list.status.failed")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto">
                        {domain.status !== "VERIFIED" && (
                          <div className="flex gap-2 flex-1 md:flex-none">
                            <button
                              onClick={() => verifyDomain(domain)}
                              disabled={verifyingIds.has(domain.id)}
                              className="flex-1 md:flex-none px-5 py-2.5 bg-emerald-500 text-emerald-950 font-bold rounded-xl hover:bg-emerald-400 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {verifyingIds.has(domain.id) ? (
                                <>
                                  <span className="material-symbols-outlined animate-spin text-sm">
                                    refresh
                                  </span>
                                  {t("list.verifying")}
                                </>
                              ) : (
                                t("list.verify")
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedDomain(domain);
                                setShowModal(true);
                              }}
                              className="p-2.5 bg-slate-900 rounded-xl border border-white/10 text-slate-400 hover:text-emerald-400 transition-all"
                              title="Instructions"
                            >
                              <span className="material-symbols-outlined">
                                info
                              </span>
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => deleteDomain(domain.id)}
                          className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                        >
                          <span className="material-symbols-outlined text-lg">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <div className="p-6 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10">
              <div className="flex gap-4">
                <span className="material-symbols-outlined text-emerald-500">
                  info
                </span>
                <div className="text-sm text-slate-400 leading-relaxed">
                  <strong className="text-emerald-300 block mb-1">
                    {t("how_to.title")}
                  </strong>
                  {t("how_to.description")}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {showModal && selectedDomain && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 backdrop-blur-md bg-black/60 font-manrope">
          <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <header className="p-8 pb-4 flex items-center justify-between border-b border-white/5 bg-slate-950/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-500">
                    dns
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-emerald-50">
                    {t("modal.title", { domain: selectedDomain.domain })}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t("modal.description")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-slate-400 transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-4 block px-1">
                  {t("modal.provider_label")}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {dnsProviders.map((provider) => {
                    const txtValue = selectedDomain.verificationTxt;
                    const href = provider.url(selectedDomain.domain, txtValue);

                    return (
                      <a
                        key={provider.name}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col p-4 bg-slate-950/40 border border-white/5 rounded-2xl hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group relative overflow-hidden"
                      >
                        {provider.isAuto && (
                          <div className="absolute -right-6 top-1 bg-emerald-500 text-emerald-950 text-[8px] font-black px-6 py-0.5 rotate-45 uppercase tracking-tighter">
                            Auto
                          </div>
                        )}
                        <div className="flex items-center gap-3 mb-1">
                          <span className="material-symbols-outlined text-slate-500 group-hover:text-emerald-400 transition-colors">
                            {provider.icon}
                          </span>
                          <span className="text-sm font-bold text-slate-300 group-hover:text-emerald-100">
                            {provider.name}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-600 group-hover:text-emerald-500/50 transition-colors">
                          {provider.isAuto
                            ? "Configuration en 1 clic"
                            : "Guide manuel"}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-2 block px-1">
                  {t("modal.txt_label")}
                </label>
                <div className="bg-slate-950/60 border border-white/5 rounded-3xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-slate-400 text-[10px] uppercase tracking-wider font-black">
                      <tr>
                        <th className="px-6 py-3">{t("modal.table.type")}</th>
                        <th className="px-6 py-3">{t("modal.table.name")}</th>
                        <th className="px-6 py-3">{t("modal.table.value")}</th>
                        <th className="px-6 py-3">{t("modal.table.ttl")}</th>
                      </tr>
                    </thead>
                    <tbody className="text-emerald-100 font-medium">
                      <tr className="border-t border-white/5">
                        <td className="px-6 py-4 font-mono text-xs text-amber-400">
                          TXT
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">@</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <code className="bg-black/40 px-3 py-1.5 rounded-lg text-emerald-400 font-mono text-xs border border-white/5">
                              {selectedDomain.verificationTxt}
                            </code>
                            <button
                              onClick={() =>
                                copyToClipboard(selectedDomain.verificationTxt)
                              }
                              className="text-slate-500 hover:text-emerald-400 transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">
                                content_copy
                              </span>
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">
                          3600 (1h)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex gap-3">
                <span className="material-symbols-outlined text-amber-500 text-lg">
                  warning
                </span>
                <p className="text-xs text-amber-200/70 leading-relaxed">
                  {t("modal.warning")}
                </p>
              </div>
            </div>

            <footer className="p-8 bg-slate-950/30 border-t border-white/5 flex gap-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-4 bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-700 transition-all"
              >
                {t("modal.close")}
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  verifyDomain(selectedDomain);
                }}
                className="flex-1 py-4 bg-emerald-500 text-emerald-950 font-black rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                {t("modal.confirmed")}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
