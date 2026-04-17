"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadSiteLanguageFromStorage,
  setSiteLanguage,
  subscribeToSiteLanguage,
  type SiteLanguage,
} from "@/app/ui/site-language";
import {
  loadSiteThemeFromStorage,
  setSiteTheme,
  subscribeToSiteTheme,
  type SiteTheme,
} from "@/app/ui/site-theme";

type SupabasePublicConfig = {
  supabaseUrl: string;
  anonKey: string;
};

type StoredAuthSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
};

type SupabaseAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
};

type SupabaseProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

type BannerAuthUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  role: string | null;
};

const AUTH_SESSION_STORAGE_KEY = "cartevisite.auth.session.v1";

const MAIN_NAV_LINKS = [
  { label: "Publicite", href: "/#hero-media" },
  { label: "Recherche", href: "/#search" },
  { label: "Offres actives", href: "/#jobs" },
  { label: "Categories", href: "/#categories" },
  { label: "Nos services", href: "/services" },
  { label: "Contact", href: "/contact" },
];

const LANGUAGE_SEQUENCE: SiteLanguage[] = ["fr", "en", "ar"];

const LANGUAGE_SHORT_LABELS: Record<SiteLanguage, string> = {
  fr: "FR",
  en: "EN",
  ar: "AR",
};

function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    anonKey,
  };
}

function toStoredSession(
  payload: SupabaseAuthTokenResponse
): StoredAuthSession | null {
  if (!payload.access_token) {
    return null;
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt:
      typeof payload.expires_in === "number"
        ? Date.now() + payload.expires_in * 1000
        : null,
  };
}

function loadStoredSession(): StoredAuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredAuthSession;
    if (!parsed || typeof parsed.accessToken !== "string") {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken:
        typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
      expiresAt:
        typeof parsed.expiresAt === "number" ? parsed.expiresAt : null,
    };
  } catch {
    return null;
  }
}

function saveStoredSession(session: StoredAuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

async function requestAuthToken(
  config: SupabasePublicConfig,
  grantType: "password" | "refresh_token",
  body: Record<string, string>
): Promise<SupabaseAuthTokenResponse | null> {
  const response = await fetch(
    `${config.supabaseUrl}/auth/v1/token?grant_type=${grantType}`,
    {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as SupabaseAuthTokenResponse;
  return payload && typeof payload.access_token === "string" ? payload : null;
}

async function fetchAuthenticatedUser(
  config: SupabasePublicConfig,
  accessToken: string
): Promise<SupabaseAuthUser | null> {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as SupabaseAuthUser;
  return payload && typeof payload.id === "string" ? payload : null;
}

async function fetchProfileRow(
  config: SupabasePublicConfig,
  accessToken: string,
  userId: string
): Promise<SupabaseProfileRow | null> {
  const params = new URLSearchParams({
    select: "id,full_name,avatar_url,role",
    id: `eq.${userId}`,
    limit: "1",
  });

  const response = await fetch(`${config.supabaseUrl}/rest/v1/profiles?${params.toString()}`, {
    method: "GET",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as SupabaseProfileRow[];
  return Array.isArray(payload) ? payload[0] ?? null : null;
}

async function hydrateBannerUser(
  config: SupabasePublicConfig,
  accessToken: string
): Promise<BannerAuthUser | null> {
  const authUser = await fetchAuthenticatedUser(config, accessToken);
  if (!authUser) {
    return null;
  }

  const profile = await fetchProfileRow(config, accessToken, authUser.id);

  return {
    id: authUser.id,
    email: authUser.email ?? null,
    fullName: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    role: profile?.role ?? null,
  };
}

async function logoutFromSupabase(
  config: SupabasePublicConfig,
  accessToken: string
): Promise<void> {
  await fetch(`${config.supabaseUrl}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
}

function buildAvatarLetter(user: BannerAuthUser | null): string {
  const source = (user?.fullName || user?.email || "C").trim();
  if (!source) {
    return "C";
  }

  const firstCharacter = [...source][0];
  return (firstCharacter || "C").toUpperCase();
}

export function SiteBanner() {
  const [authUser, setAuthUser] = useState<BannerAuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeLanguage, setActiveLanguage] = useState<SiteLanguage>("fr");
  const [activeTheme, setActiveTheme] = useState<SiteTheme>("dark");
  const [isLanguageAnimating, setIsLanguageAnimating] = useState(false);
  const [isThemeAnimating, setIsThemeAnimating] = useState(false);

  const languageAnimTimeoutRef = useRef<number | null>(null);
  const themeAnimTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (languageAnimTimeoutRef.current !== null) {
        window.clearTimeout(languageAnimTimeoutRef.current);
      }

      if (themeAnimTimeoutRef.current !== null) {
        window.clearTimeout(themeAnimTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setActiveLanguage(loadSiteLanguageFromStorage());
    });

    const unsubscribe = subscribeToSiteLanguage((language) => {
      setActiveLanguage(language);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setActiveTheme(loadSiteThemeFromStorage());
    });

    const unsubscribe = subscribeToSiteTheme((theme) => {
      setActiveTheme(theme);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapAuth() {
      const config = getSupabasePublicConfig();
      if (!config) {
        if (active) {
          setAuthLoading(false);
        }
        return;
      }

      let session = loadStoredSession();
      if (!session) {
        if (active) {
          setAuthLoading(false);
        }
        return;
      }

      if (
        session.expiresAt &&
        session.expiresAt <= Date.now() + 30_000 &&
        session.refreshToken
      ) {
        const refreshed = await requestAuthToken(config, "refresh_token", {
          refresh_token: session.refreshToken,
        });

        const refreshedSession = refreshed ? toStoredSession(refreshed) : null;
        if (refreshedSession) {
          saveStoredSession(refreshedSession);
          session = refreshedSession;
        } else {
          clearStoredSession();
          if (active) {
            setAuthLoading(false);
          }
          return;
        }
      }

      const hydratedUser = await hydrateBannerUser(config, session.accessToken);

      if (!active) {
        return;
      }

      if (hydratedUser) {
        setAuthUser(hydratedUser);
      } else {
        clearStoredSession();
        setAuthUser(null);
      }

      setAuthLoading(false);
    }

    void bootstrapAuth();

    return () => {
      active = false;
    };
  }, []);

  const avatarLetter = useMemo(() => buildAvatarLetter(authUser), [authUser]);

  const isDarkTheme = activeTheme === "dark";

  const handleToggleTheme = () => {
    const nextTheme: SiteTheme = activeTheme === "light" ? "dark" : "light";

    setActiveTheme(nextTheme);
    setSiteTheme(nextTheme);

    setIsThemeAnimating(true);
    if (themeAnimTimeoutRef.current !== null) {
      window.clearTimeout(themeAnimTimeoutRef.current);
    }

    themeAnimTimeoutRef.current = window.setTimeout(() => {
      setIsThemeAnimating(false);
      themeAnimTimeoutRef.current = null;
    }, 280);
  };

  const handleLanguageToggle = () => {
    const currentIndex = LANGUAGE_SEQUENCE.indexOf(activeLanguage);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextLanguage = LANGUAGE_SEQUENCE[(safeIndex + 1) % LANGUAGE_SEQUENCE.length];

    setActiveLanguage(nextLanguage);
    setSiteLanguage(nextLanguage);

    setIsLanguageAnimating(true);
    if (languageAnimTimeoutRef.current !== null) {
      window.clearTimeout(languageAnimTimeoutRef.current);
    }

    languageAnimTimeoutRef.current = window.setTimeout(() => {
      setIsLanguageAnimating(false);
      languageAnimTimeoutRef.current = null;
    }, 280);
  };

  const handleLogout = async () => {
    const config = getSupabasePublicConfig();
    const session = loadStoredSession();

    try {
      if (config && session?.accessToken) {
        await logoutFromSupabase(config, session.accessToken);
      }
    } catch {
      // Ignore remote logout failures and clear local session anyway.
    }

    clearStoredSession();
    setAuthUser(null);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#16203a] bg-[#05070d]/95 backdrop-blur">
      <nav className="mx-auto w-full max-w-[92rem] px-[var(--page-gutter)] py-3 sm:py-4 md:py-5">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <Link href="/" className="flex items-center gap-3 sm:gap-4">
            <Image
              src="/cartevisite-logo.png"
              alt="Logo CarteVisite"
              width={72}
              height={72}
              className="h-12 w-12 rounded-xl border border-[#2a3a68] bg-[#0b1222] p-1 sm:h-16 sm:w-16"
            />
            <div>
              <span className="headline-script block text-[1.6rem] leading-none text-white sm:text-[2rem]">
                CarteVisite
              </span>
              <span className="mt-1 hidden text-[11px] uppercase tracking-[0.15em] text-slate-400 sm:mt-2 sm:block sm:text-xs">
                Publications et visibilite d entreprises
              </span>
            </div>
          </Link>

          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={handleLanguageToggle}
              data-i18n-skip
              title="Changer la langue"
              className="inline-flex items-center gap-2 rounded-full border border-[#2a3a68] bg-[#0b1222] px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300 active:scale-[0.98]"
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#121d38] transition-transform duration-300 ${
                  isLanguageAnimating ? "rotate-180 scale-110" : ""
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-3.5 w-3.5"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18" />
                  <path d="M12 3a14 14 0 0 1 0 18" />
                  <path d="M12 3a14 14 0 0 0 0 18" />
                </svg>
              </span>
              <span className="min-w-[1.9rem] text-center text-[11px] font-black tracking-[0.12em] sm:text-xs">
                {LANGUAGE_SHORT_LABELS[activeLanguage]}
              </span>
            </button>

            <button
              type="button"
              onClick={handleToggleTheme}
              data-i18n-skip
              title="Basculer le theme clair/sombre"
              aria-label="Basculer le theme clair/sombre"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2a3a68] bg-[#0b1222] text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300 active:scale-[0.96]"
            >
              <span
                className={`relative inline-flex h-5 w-5 items-center justify-center transition-transform duration-300 ${
                  isThemeAnimating ? "rotate-[35deg] scale-110" : ""
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`absolute h-5 w-5 transition-all duration-300 ${
                    isDarkTheme ? "scale-0 opacity-0 rotate-90" : "scale-100 opacity-100 rotate-0"
                  }`}
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>

                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`absolute h-5 w-5 transition-all duration-300 ${
                    isDarkTheme ? "scale-100 opacity-100 rotate-0" : "scale-0 opacity-0 -rotate-90"
                  }`}
                >
                  <path d="M12 3a7 7 0 1 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              </span>
            </button>

            <Link
              href="/create-site"
              className="rounded-full border border-yellow-500 bg-yellow-500 px-4 py-2 text-xs font-semibold text-[#05070d] transition hover:bg-yellow-400 sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Creer mon site
            </Link>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-yellow-500 bg-yellow-500 px-4 py-2 text-xs font-semibold text-[#05070d] transition hover:bg-yellow-400 sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Formation
            </a>

            {authUser?.role === "entreprise" ? (
              <Link
                href="/espace-entreprise"
                className="rounded-full border border-[#2a3a68] bg-[#0b1222] px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300 sm:px-5 sm:py-2.5 sm:text-sm"
              >
                Espace entreprise
              </Link>
            ) : null}

            {authUser?.role === "super_admin" ? (
              <Link
                href="/espace-admin"
                className="rounded-full border border-[#2a3a68] bg-[#0b1222] px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300 sm:px-5 sm:py-2.5 sm:text-sm"
              >
                Espace admin
              </Link>
            ) : null}

            {authUser ? (
              <button
                type="button"
                onClick={handleLogout}
                title="Cliquez pour deconnecter"
                className="flex items-center rounded-full border border-[#2a3a68] bg-[#0b1222] p-1 text-slate-100 transition hover:border-yellow-500"
              >
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-yellow-500/70 bg-[#121d38] text-xs font-black text-yellow-300 shadow-[0_0_0_2px_rgba(8,13,25,0.45)]"
                  aria-label={authUser.fullName || authUser.email || "Utilisateur"}
                >
                  {avatarLetter}
                </span>
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-full border border-[#2a3a68] bg-[#0b1222] px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300 sm:px-5 sm:py-2.5 sm:text-sm"
              >
                {authLoading ? "Chargement..." : "Connexion"}
              </Link>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-[#16203a] pt-4">
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max items-center gap-x-5 gap-y-3 text-sm font-medium text-slate-300 sm:gap-x-7 sm:text-[15px]">
            {MAIN_NAV_LINKS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="transition hover:text-yellow-300"
              >
                {item.label}
              </Link>
            ))}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
