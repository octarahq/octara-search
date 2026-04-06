import { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Compte Client",
  description:
    "Gérez votre compte Octara, vos recherches sauvegardées et vos préférences.",
};

export default function AccountPage() {
  return (
    <div className="dark min-h-screen bg-black font-manrope selection:bg-emerald-500/30">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .font-manrope { font-family: 'Manrope', sans-serif; }
        .glass-card {
            background: rgba(9, 9, 11, 0.7);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .emerald-glow {
            box-shadow: 0 0 80px -10px rgba(16, 185, 129, 0.15);
        }
        @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0px); }
        }
        .float-animation {
            animation: float 6s ease-in-out infinite;
        }
        `,
        }}
      />

      <Navbar />

      <main className="relative pt-32 pb-20 px-6 flex flex-col items-center justify-center min-h-[90vh] overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-2xl w-full text-center">
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Accès Utilisateur
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6">
            Espace Compte <br />
            <span className="text-emerald-500">Bientôt Disponible</span>
          </h1>

          <p className="text-zinc-400 text-lg md:text-xl mb-12 max-w-lg mx-auto leading-relaxed">
            Nous préparons une expérience personnalisée pour vous permettre de
            sauvegarder vos recherches, gérer vos alertes et personnaliser votre
            flux d'actualités.
          </p>

          <div className="mt-12 flex items-center justify-center gap-6">
            <Link
              href="/"
              className="text-zinc-500 hover:text-white transition-colors text-sm font-medium flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">
                arrow_back
              </span>
              Retour à la recherche
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
