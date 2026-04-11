"use client";

import React, { useState, useEffect } from "react";
import { Link } from "@/components/ui/Link";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "../../../_components/Sidebar";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";

interface PageData {
  url: string;
  title: string;
  description: string;
  crawled_at: string;
}

interface TreeNode {
  name: string;
  url?: string;
  title?: string;
  children: Map<string, TreeNode>;
  crawled_at?: string;
}

const TreeItem = ({
  node,
  depth = 0,
  isLast = false,
  isRoot = false,
  onRecrawl,
  onDelete,
}: {
  node: TreeNode;
  depth?: number;
  isLast?: boolean;
  isRoot?: boolean;
  onRecrawl?: (url: string, recursive: boolean) => void;
  onDelete?: (url: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isCrawlRequested, setIsCrawlRequested] = useState(false);
  const hasChildren = node.children.size > 0;

  const handleRecrawl = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.url && onRecrawl) {
      onRecrawl(node.url, false);
      setIsCrawlRequested(true);
      setTimeout(() => setIsCrawlRequested(false), 3000);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.url && onDelete) {
      onDelete(node.url);
    }
  };

  return (
    <div className="relative">
      <div
        className={`group flex items-center gap-2 py-1.5 px-3 rounded-lg transition-all relative ${node.url ? "hover:bg-emerald-500/10 cursor-pointer" : "text-slate-500"} ${isRoot ? "mb-2" : ""}`}
        onClick={() => {
          if (node.url) {
            if (onRecrawl) {
              // In sitemap (where onRecrawl is provided), row click triggers recrawl
              handleRecrawl(null as any);
            } else {
              // In index, row click opens URL
              window.open(node.url, "_blank");
            }
          }
        }}
      >
        {/* Connection Lines (L-shape) */}
        {!isRoot && (
          <>
            {/* Vertical line from parent */}
            <div className="absolute -left-[18px] top-0 w-px h-full border-l border-white/5" />
            {/* Horizontal connector to child */}
            <div className="absolute -left-[18px] top-[18px] w-4 h-px border-t border-white/10" />
            {/* Hide vertical line part if it's the last child */}
            {isLast && (
              <div
                className="absolute -left-[18px] top-[18px] w-px h-full bg-slate-950/40"
                style={{ backgroundColor: "#020617" }}
              />
            )}
          </>
        )}

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="flex items-center justify-center w-5 h-5 rounded hover:bg-white/5 transition-colors cursor-pointer z-10"
            onClick={(e) => {
              if (hasChildren) {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }
            }}
          >
            {hasChildren ? (
              <span
                className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${isOpen ? "rotate-90" : ""} text-slate-500`}
              >
                chevron_right
              </span>
            ) : (
              <div className="w-1 h-1 rounded-full bg-slate-800" />
            )}
          </div>

          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${hasChildren ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-900 text-slate-500 group-hover:text-emerald-400"}`}
          >
            <span className="material-symbols-outlined text-lg">
              {hasChildren
                ? isOpen
                  ? "folder_open"
                  : "folder"
                : "description"}
            </span>
          </div>

          <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-baseline gap-1 md:gap-3">
            <span
              className={`truncate font-mono text-sm tracking-tight ${isRoot ? "text-lg font-black text-emerald-100" : "font-bold text-slate-200 group-hover:text-white"}`}
            >
              {node.name}
            </span>
            {node.title && (
              <span className="text-[11px] text-slate-500 truncate font-medium opacity-60 group-hover:opacity-100 transition-opacity">
                {node.title}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onRecrawl ? (
            node.url && (
              <button
                onClick={handleRecrawl}
                disabled={isCrawlRequested}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${isCrawlRequested ? "text-emerald-500 bg-emerald-500/10" : "text-slate-500 hover:text-emerald-400 hover:bg-white/10 opacity-100"}`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${isCrawlRequested ? "animate-pulse" : ""}`}
                >
                  {isCrawlRequested ? "done" : "sync"}
                </span>
              </button>
            )
          ) : (
            <>
              {node.crawled_at && (
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap opacity-40">
                  {new Date(node.crawled_at).toLocaleDateString()}{" "}
                  {new Date(node.crawled_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
              {node.url && onDelete && (
                <button
                  onClick={handleDelete}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all"
                  title="Supprimer de l'index"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    delete
                  </span>
                </button>
              )}
              {node.url && (
                <span className="material-symbols-outlined text-sm text-emerald-500/50">
                  open_in_new
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {hasChildren && isOpen && (
        <div className="ml-[26px] mt-0.5 space-y-0.5">
          {Array.from(node.children.values())
            .sort((a, b) => {
              // Folders first, then alphabetically
              const aHas = a.children.size > 0;
              const bHas = b.children.size > 0;
              if (aHas && !bHas) return -1;
              if (!aHas && bHas) return 1;
              return a.name.localeCompare(b.name);
            })
            .map((child, i, arr) => (
              <TreeItem
                key={i}
                node={child}
                depth={depth + 1}
                isLast={i === arr.length - 1}
                onRecrawl={onRecrawl}
                onDelete={onDelete}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export default function HostDetailsPage() {
  const t = useTranslations("account_domains");
  const tAuth = useTranslations("common.auth");
  const params = useParams();
  const router = useRouter();
  const domain = params.domain as string;
  const host = decodeURIComponent(params.host as string);

  // Calculate full hostname
  const fullHost = host === "@" ? domain : `${host}.${domain}`;

  const { user, isLoading } = useAuth();
  const [pages, setPages] = useState<PageData[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(true);

  const [sitemapPages, setSitemapPages] = useState<string[]>([]);
  const [isFetchingSitemap, setIsFetchingSitemap] = useState(false);
  const [sitemapError, setSitemapError] = useState("");
  const [hasSitemap, setHasSitemap] = useState<boolean | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch(`/api/subdomains/info?host=${fullHost}`);
        if (res.ok) {
          const data = await res.json();
          setHasSitemap(data.info.has_sitemap);
        }
      } catch (e) {}
    };
    fetchInfo();
  }, [fullHost]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchPages = async () => {
    setIsLoadingPages(true);
    try {
      const res = await fetch(`/api/subdomains/pages?host=${fullHost}`);
      if (res.ok) {
        const data = await res.json();
        const seen = new Set();
        const uniquePages = (data.pages || []).filter((p: PageData) => {
          try {
            const norm = new URL(p.url).toString().replace(/\/$/, "");
            if (seen.has(norm)) return false;
            seen.add(norm);
            return true;
          } catch (e) {
            return true;
          }
        });
        setPages(uniquePages);
      }
    } catch (error) {
      console.error("Failed to fetch pages:", error);
    } finally {
      setIsLoadingPages(false);
    }
  };

  const deletePage = async (url: string) => {
    if (
      !window.confirm(t("details.notifications.delete_page_confirm", { url }))
    )
      return;

    try {
      const res = await fetch(
        `/api/subdomains/pages?url=${encodeURIComponent(url)}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        setPages(pages.filter((p) => p.url !== url));
        setNotification({
          message: t("details.notifications.delete_page_success"),
          type: "success",
        });
      }
    } catch (error) {
      console.error("Failed to delete page:", error);
      setNotification({
        message: t("details.notifications.delete_page_error"),
        type: "error",
      });
    }
  };

  const fetchSitemap = async () => {
    setIsFetchingSitemap(true);
    setSitemapError("");
    try {
      const res = await fetch(`/api/subdomains/sitemap?host=${fullHost}`);
      if (res.ok) {
        const data = await res.json();
        const urls = data.urls || [];
        setSitemapPages(urls);
        setHasSitemap(true);
      } else {
        setHasSitemap(false);
        setSitemapError("Sitemap introuvable ou inaccessible.");
      }
    } catch (error) {
      setHasSitemap(false);
      setSitemapError("Erreur lors de la récupération du sitemap.");
    } finally {
      setIsFetchingSitemap(false);
    }
  };

  const buildTree = (pagesList: (PageData | string)[], rootName: string) => {
    const rootNode: TreeNode = { name: rootName, children: new Map() };

    pagesList.forEach((item) => {
      try {
        const urlStr = typeof item === "string" ? item : item.url;
        const url = new URL(urlStr);
        const paths = url.pathname.split("/").filter((p) => p !== "");

        let current = rootNode;

        if (paths.length === 0) {
          if (typeof item !== "string") {
            current.url = item.url;
            current.title = item.title;
            current.crawled_at = item.crawled_at;
          } else {
            current.url = item;
          }
          return;
        }

        paths.forEach((segment, index) => {
          if (!current.children.has(segment)) {
            current.children.set(segment, {
              name: segment,
              children: new Map(),
            });
          }
          current = current.children.get(segment)!;

          if (index === paths.length - 1) {
            if (typeof item !== "string") {
              current.url = item.url;
              current.title = item.title;
              current.crawled_at = item.crawled_at;
            } else {
              current.url = item;
            }
          }
        });
      } catch (e) {
        // Skip invalid URLs
      }
    });

    return rootNode;
  };

  const handleRecrawl = async (url: string | string[], recursive: boolean) => {
    try {
      const urls = Array.isArray(url) ? url : [url];
      setNotification({
        message: t("details.notifications.recrawl_start", {
          count: urls.length,
        }),
        type: "info",
      });
      const res = await fetch("/api/subdomains/recrawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, recursive }),
      });
      if (res.ok) {
        setNotification({
          message:
            urls.length > 1
              ? t("details.notifications.recrawl_sitemap_success")
              : t("details.notifications.recrawl_success"),
          type: "success",
        });
      } else {
        throw new Error();
      }
    } catch (error) {
      console.error("Failed to request recrawl:", error);
      setNotification({
        message: t("details.notifications.recrawl_error"),
        type: "error",
      });
    }
  };

  useEffect(() => {
    if (fullHost) {
      fetchPages();
    }
  }, [fullHost]);

  const siteTree = buildTree(pages, fullHost);
  const sitemapTree = buildTree(sitemapPages, "Sitemap");

  if (!user) return null;

  return (
    <main className="p-8 md:p-12 max-w-6xl ml-0 md:ml-64">
      <header className="mb-12">
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.back()}
            className="w-12 h-12 bg-slate-900 rounded-2xl border border-white/5 text-slate-400 hover:text-emerald-400 transition-all flex items-center justify-center group"
          >
            <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">
              arrow_back
            </span>
          </button>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-extrabold tracking-tight text-emerald-100 uppercase">
              {fullHost}
            </h1>
            {hasSitemap === false && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full text-red-100">
                <span className="material-symbols-outlined text-lg">
                  warning
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest">
                  No Sitemap
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <div className="bg-slate-900/40 rounded-[2.5rem] p-8 border border-slate-800/20 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
            <h2 className="text-xl font-bold text-emerald-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-500">
                  account_tree
                </span>
              </div>
              {t("details.index.pages_count", { count: pages.length })}
            </h2>
          </div>

          <div className="bg-slate-950/40 rounded-3xl p-6 border border-white/5">
            {pages.length === 0 ? (
              <div className="py-20 text-center">
                <span className="material-symbols-outlined text-slate-700 text-5xl mb-4">
                  find_in_page
                </span>
                <p className="text-slate-500 font-medium">
                  {t("details.index.no_pages")}
                </p>
              </div>
            ) : (
              <TreeItem node={siteTree} isRoot={true} onDelete={deletePage} />
            )}
          </div>
        </div>

        <div className="bg-slate-900/40 rounded-[2.5rem] p-8 border border-slate-800/20 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-4 border-b border-white/5">
            <h2 className="text-xl font-bold text-emerald-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-500">
                  account_tree
                </span>
              </div>
              Sitemap
            </h2>
            <div className="flex items-center gap-3">
              {sitemapPages.length > 0 && (
                <button
                  onClick={() => handleRecrawl(sitemapPages, false)}
                  className="px-6 py-2.5 bg-emerald-500/10 text-emerald-400 font-bold rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">
                    rocket_launch
                  </span>
                  {t("details.sitemap.recrawl_all")}
                </button>
              )}
              <button
                onClick={fetchSitemap}
                disabled={isFetchingSitemap}
                className="px-6 py-2.5 bg-slate-900 text-emerald-400 font-bold rounded-xl border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isFetchingSitemap ? (
                  <div className="w-4 h-4 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-sm">
                    sync
                  </span>
                )}
                {sitemapPages.length > 0
                  ? t("details.sitemap.refresh")
                  : t("details.sitemap.explore")}
              </button>
            </div>
          </div>

          <div className="bg-slate-950/40 rounded-3xl p-6 border border-white/5">
            {isFetchingSitemap ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500 font-medium">
                  {t("details.sitemap.analyzing")}
                </p>
              </div>
            ) : sitemapError ? (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined text-amber-500/50 text-4xl mb-3">
                  warning
                </span>
                <p className="text-slate-500">{sitemapError}</p>
              </div>
            ) : sitemapPages.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-slate-600 font-medium max-w-sm mx-auto">
                  {t("details.sitemap.hint")}
                </p>
              </div>
            ) : (
              <TreeItem
                node={sitemapTree}
                isRoot={true}
                onRecrawl={handleRecrawl}
              />
            )}
          </div>
        </div>
      </div>

      {notification && (
        <div className="fixed bottom-8 right-8 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div
            className={`flex items-center gap-4 px-6 py-4 rounded-[2rem] border backdrop-blur-xl shadow-2xl ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : notification.type === "error"
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-blue-500/10 border-blue-500/20 text-blue-400"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                notification.type === "success"
                  ? "bg-emerald-500/20"
                  : notification.type === "error"
                    ? "bg-red-500/20"
                    : "bg-blue-500/20"
              }`}
            >
              <span className="material-symbols-outlined text-xl">
                {notification.type === "success"
                  ? "check_circle"
                  : notification.type === "error"
                    ? "error"
                    : "info"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-white">
                {notification.type === "success"
                  ? t("details.notifications.success_status")
                  : notification.type === "error"
                    ? t("details.notifications.error_status")
                    : t("details.notifications.mission_status")}
              </span>
              <span className="text-xs font-medium opacity-80">
                {notification.message}
              </span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 hover:opacity-50 transition-opacity"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
