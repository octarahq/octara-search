"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasCalled = useRef(false);

  useEffect(() => {
    if (hasCalled.current) return;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const savedState = localStorage.getItem("oauth_state");

    if (!code || state !== savedState) {
      console.error("Invalid OAuth state or code missing");
      router.push("/");
      return;
    }

    hasCalled.current = true;
    localStorage.removeItem("oauth_state");

    const exchangeCode = async () => {
      try {
        const redirectUri = `${window.location.protocol}//${window.location.host}/auth/callback`;
        const res = await fetch("/api/auth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });

        if (res.ok) {
          const data = await res.json();

          if (data.user) {
            const rawUser = data.user;
            const normalizedUser = {
              id: rawUser.id,
              name:
                rawUser.name || rawUser.displayName || rawUser.username || null,
              email: rawUser.email,
              avatarURL:
                rawUser.avatarURL ||
                rawUser.avatar_url ||
                rawUser.avatar ||
                rawUser.picture ||
                undefined,
            };
          }
          document.cookie = `octara_token=${data.access_token}; path=/; max-age=${3600 * 24 * 7}; samesite=lax`;

          window.location.href = "/";
        } else {
          console.error("Token exchange failed");
          router.push("/");
        }
      } catch (error) {
        console.error("Error during auth callback", error);
        router.push("/");
      }
    };

    exchangeCode();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-emerald-400">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        <p className="font-manrope font-bold animate-pulse">
          Authentification en cours...
        </p>
      </div>
    </div>
  );
}
