"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AUTH_CONFIG } from "@/config/auth-config";

interface User {
  id: string;
  name?: string | null;
  email?: string;
  avatarURL?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  history: string[];
  historyEnabled: boolean;
  safeSearch: string;
  searchLanguage: string;
  resultsPerPage: number;
  openInNewTab: boolean;
  searchSuggestions: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  addToHistory: (query: string) => Promise<void>;
  refreshHistory: () => Promise<void>;
  updateSettings: (settings: {
    historyEnabled?: boolean;
    safeSearch?: string;
    language?: string;
    resultsPerPage?: number;
    openInNewTab?: boolean;
    searchSuggestions?: boolean;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CLIENT_ID = AUTH_CONFIG.clientId;
const API_BASE_URL =
  process.env.NEXT_PUBLIC_ACCOUNT_API_BASE_URL || "https://octara.xyz";
const REDIRECT_URI =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}/auth/callback`
    : "";
const SCOPES = [
  "read:profile",
  "read:search_history",
  "write:search_history",
  "read:search_settings",
  "write:search_settings",
  "read:search_domains",
  "write:search_domains",
].join(" ");

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [safeSearch, setSafeSearch] = useState("moderate");
  const [searchLanguage, setSearchLanguage] = useState("fr");
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [openInNewTab, setOpenInNewTab] = useState(true);
  const [searchSuggestions, setSearchSuggestions] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchSettings = async () => {
    const currentToken = token;
    if (!currentToken) return;

    try {
      const res = await fetch(`/api/v1/search/settings`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setHistoryEnabled(data.settings.historyEnabled ?? true);
          setSafeSearch(data.settings.safeSearch || "moderate");
          setSearchLanguage(data.settings.language ?? "fr");
          setResultsPerPage(data.settings.resultsPerPage ?? 10);
          setOpenInNewTab(data.settings.openInNewTab ?? true);
          setSearchSuggestions(data.settings.searchSuggestions ?? true);
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };

  const updateSettings = async (settings: {
    historyEnabled?: boolean;
    safeSearch?: string;
    language?: string;
    resultsPerPage?: number;
    openInNewTab?: boolean;
    searchSuggestions?: boolean;
  }) => {
    if (!token) return;

    try {
      if (settings.historyEnabled !== undefined) {
        const res = await fetch(`/api/user/history/settings`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ enabled: settings.historyEnabled }),
        });
        if (res.ok) {
          setHistoryEnabled(settings.historyEnabled);
        }
      }

      const patchData: any = {};
      if (settings.safeSearch !== undefined)
        patchData.safeSearch = settings.safeSearch;
      if (settings.language !== undefined)
        patchData.language = settings.language;
      if (settings.resultsPerPage !== undefined)
        patchData.resultsPerPage = settings.resultsPerPage;
      if (settings.openInNewTab !== undefined)
        patchData.openInNewTab = settings.openInNewTab;
      if (settings.searchSuggestions !== undefined)
        patchData.searchSuggestions = settings.searchSuggestions;

      if (Object.keys(patchData).length > 0) {
        const res = await fetch(`/api/v1/search/settings`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(patchData),
        });
        if (res.ok) {
          if (settings.safeSearch !== undefined)
            setSafeSearch(settings.safeSearch);
          if (settings.language !== undefined)
            setSearchLanguage(settings.language);
          if (settings.resultsPerPage !== undefined)
            setResultsPerPage(settings.resultsPerPage);
          if (settings.openInNewTab !== undefined)
            setOpenInNewTab(settings.openInNewTab);
          if (settings.searchSuggestions !== undefined)
            setSearchSuggestions(settings.searchSuggestions);
        }
      }
    } catch (error) {
      console.error("Failed to update settings:", error);
    }
  };

  const refreshHistory = async () => {
    if (!historyEnabled) {
      setHistory([]);
      return;
    }
    const currentToken = token;
    if (!currentToken) return;

    try {
      const res = await fetch(`/api/user/history`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

  const addToHistory = async (query: string) => {
    if (!token || !query.trim() || !historyEnabled) return;

    try {
      const res = await fetch(`/api/user/history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        setHistory((prev) => {
          const filtered = prev.filter((q) => q !== query);
          return [query, ...filtered].slice(0, 10);
        });
      }
    } catch (error) {
      console.error("Failed to add to history:", error);
    }
  };

  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(";").shift();
      return null;
    };

    const initAuth = async () => {
      const savedToken = getCookie("octara_token");

      if (savedToken) {
        try {
          const res = await fetch(`/api/v1/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });

          if (res.ok) {
            const data = await res.json();
            setToken(savedToken);
            const rawUser = data.user || data;

            const normalizedUser: User = {
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

            setUser(normalizedUser);
          } else {
            console.warn("Session expirée ou token invalide");
            logout();
          }
        } catch (error) {
          console.error("Erreur d'initialisation auth:", error);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    if (token) {
      refreshHistory();
      fetchSettings();
    }
  }, [token, historyEnabled]);

  const login = () => {
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem("oauth_state", state);

    const url = new URL("https://octara.xyz/api/oauth/authorize");
    url.searchParams.append("client_id", CLIENT_ID);
    url.searchParams.append("redirect_uri", REDIRECT_URI);
    url.searchParams.append("response_type", "code");
    url.searchParams.append("scope", SCOPES);
    url.searchParams.append("state", state);

    window.location.href = url.toString();
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    document.cookie =
      "octara_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        history,
        historyEnabled,
        safeSearch,
        searchLanguage,
        resultsPerPage,
        openInNewTab,
        searchSuggestions,
        isLoading,
        login,
        logout,
        addToHistory,
        refreshHistory,
        updateSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
