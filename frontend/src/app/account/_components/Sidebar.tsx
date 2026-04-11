"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

export const Sidebar = () => {
  const t = useTranslations("common.sidebar");
  const { logout } = useAuth();
  const pathname = usePathname();

  const sideNavLinks = [
    { icon: "person", label: t("profile"), href: "/account" },
    { icon: "search", label: t("search"), href: "/account/search" },
    { icon: "domain", label: t("domains"), href: "/account/domains" },
  ];

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 border-r border-slate-800/30 bg-slate-950 flex flex-col gap-2 p-4 font-manrope text-sm hidden md:flex">
      <div className="mb-6 px-4 pt-4">
        <h2 className="text-lg font-black text-emerald-100">{t("settings")}</h2>
        <p className="text-xs text-slate-500">{t("manage")}</p>
      </div>
      <nav className="flex-1 space-y-1">
        {sideNavLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.label}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 transition-all active:translate-x-1 duration-150 rounded-xl ${
                isActive
                  ? "bg-emerald-900/30 text-emerald-300 font-bold"
                  : "text-slate-400 hover:text-emerald-200 hover:bg-emerald-900/20"
              }`}
            >
              <span className="material-symbols-outlined">{link.icon}</span>{" "}
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
