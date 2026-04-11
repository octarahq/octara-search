"use client";

import React from "react";
import { Link } from "@/components/ui/Link";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { Sidebar } from "./_components/Sidebar";

export default function AccountPage() {
  const { user, logout, isLoading, historyEnabled, updateSettings } = useAuth();

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
        <h1 className="text-4xl font-black text-white mb-6">Accès Restreint</h1>
        <p className="text-zinc-400 mb-8 max-w-md">
          Veuillez vous connecter pour accéder à vos paramètres de compte.
        </p>
        <Link
          href="/"
          className="px-8 py-3 bg-emerald-500 text-emerald-950 font-bold rounded-xl hover:bg-emerald-400 transition-all"
        >
          Retour à l'accueil
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
            <h1 className="text-4xl font-extrabold tracking-tight text-emerald-100 mb-2">
              Paramètres du compte
            </h1>
            <p className="text-slate-400 max-w-2xl">
              Gérez votre compte Octara Search.
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <section className="lg:col-span-12 bg-slate-900/40 rounded-[2rem] p-8 border border-slate-800/20 backdrop-blur-sm">
              <div className="flex flex-col md:flex-row items-start gap-8">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-900/30 group-hover:border-emerald-500/50 transition-all">
                    <UserAvatar
                      avatarURL={user.avatarURL}
                      name={user.name}
                      iconSize="text-6xl"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-6 w-full text-left">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-500 px-1">
                        Nom d'affichage
                      </label>
                      <div className="w-full bg-slate-950/50 rounded-xl text-emerald-100 py-3 px-4 border border-white/5">
                        {user.name || "N/A"}
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 flex flex-col gap-4">
                    <Link
                      preserveHostLink
                      href="/account"
                      className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600/10 border border-emerald-500/20 text-white rounded-xl font-bold text-sm hover:bg-emerald-600/20 transition-all active:scale-95 w-fit"
                    >
                      <span className="material-symbols-outlined text-lg">
                        edit
                      </span>
                      Modifier le profil
                    </Link>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-950/30 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-zinc-500">
                        history
                      </span>
                      <div>
                        <div className="text-sm font-bold text-emerald-100">
                          Historique de recherche
                        </div>
                        <div className="text-xs text-slate-500">
                          Enregistrer vos requêtes pour des suggestions rapides
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateSettings({
                          historyEnabled: !historyEnabled,
                        })
                      }
                      className={`w-12 h-6 rounded-full transition-all relative ${
                        historyEnabled ? "bg-emerald-500" : "bg-slate-800"
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                          historyEnabled ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
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
