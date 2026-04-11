"use client";

import React from "react";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "./_components/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { useTranslations } from "next-intl";
import { Link } from "@/components/ui/Link";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const tAuth = useTranslations("common.auth");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center font-manrope">
        <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-8" />
        <h2 className="text-2xl font-black text-emerald-100 animate-pulse">
          Chargement...
        </h2>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-manrope">
        <h1 className="text-4xl font-black text-white mb-6">
          {tAuth("restricted_access")}
        </h1>
        <p className="text-zinc-400 mb-8 max-w-md">{tAuth("login_required")}</p>
        <Link
          href="/"
          className="px-8 py-3 bg-emerald-500 text-emerald-950 font-bold rounded-xl hover:bg-emerald-400 transition-all font-manrope"
        >
          {tAuth("back_home")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-manrope flex flex-col">
      <Navbar />
      <div className="flex pt-16 flex-1">
        <Sidebar />
        <div className="flex-1 w-full min-h-0">{children}</div>
      </div>
    </div>
  );
}
