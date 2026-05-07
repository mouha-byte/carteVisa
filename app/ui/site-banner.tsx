"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { label: "Accueil", href: "/" },
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const pathname = usePathname();

  const languageAnimTimeoutRef = useRef<number | null>(null);
  const themeAnimTimeoutRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (pathname !== "/") {
      const resetTimer = window.setTimeout(() => {
        setShowIntro(false);
      }, 0);

      return () => {
        window.clearTimeout(resetTimer);
      };
    }

    const startTimer = window.setTimeout(() => {
      setShowIntro(true);
    }, 0);

    const timer = window.setTimeout(() => {
      setShowIntro(false);
    }, 2000);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      const lastY = lastScrollYRef.current;

      if (currentY > 120 && currentY > lastY + 8) {
        setIsHeaderHidden(true);
        setIsMobileNavOpen(false);
      } else if (currentY < lastY - 8 || currentY < 40) {
        setIsHeaderHidden(false);
      }

      lastScrollYRef.current = currentY;
    };

    lastScrollYRef.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
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

  const closeMenu = () => {
    setIsMobileNavOpen(false);
  };

  const navPills = (
    <div className="topbar-scroll overflow-x-auto pb-1">
      <div className="flex min-w-max items-center gap-1.5 sm:gap-2 lg:justify-end">
        {MAIN_NAV_LINKS.map((item) => (
          <Link key={item.label} href={item.href} className="nav-pill" onClick={closeMenu}>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );

  const introOverlay = showIntro ? (
    <div className="intro-overlay" aria-hidden="true">
      <div className="intro-card">
        <div className="brand-logo-shell">
          <Image
            src="/cartevisite-logo.png"
            alt="Logo CarteVisite"
            width={110}
            height={110}
            className="brand-logo-img h-[88px] w-[88px] rounded-xl p-2"
          />
        </div>
        <p className="headline-script mt-4 text-4xl text-white">CarteVisite</p>
      </div>
    </div>
  ) : null;

  const brandBlock = (
    <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
      <div className="brand-logo-shell">
        <Image
          src="/cartevisite-logo.png"
          alt="Logo CarteVisite"
          width={72}
          height={72}
          className="brand-logo-img h-9 w-9 rounded-lg p-1 sm:h-11 sm:w-11"
        />
      </div>
      <div className="min-w-0">
        <span className="headline-script block truncate text-[1.15rem] leading-none text-white sm:text-[1.55rem]">
          CarteVisite
        </span>
        <span className="site-subtitle mt-0.5 hidden text-[10px] uppercase tracking-[0.14em] text-slate-400 lg:block">
          Publications et visibilite d entreprises
        </span>
      </div>
    </Link>
  );

  const languageButton = (
    <button
      type="button"
      onClick={handleLanguageToggle}
      data-i18n-skip
      title="Changer la langue"
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#2a3a68] bg-[#0b1222]/90 px-2.5 text-[11px] font-semibold text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300 active:scale-[0.98] sm:h-10 sm:px-3"
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
      <span className="min-w-[1.7rem] text-center text-[10px] font-black tracking-[0.12em] sm:text-[11px]">
        {LANGUAGE_SHORT_LABELS[activeLanguage]}
      </span>
    </button>
  );

  const themeButton = (
    <button
      type="button"
      onClick={handleToggleTheme}
      data-i18n-skip
      title="Basculer le theme clair/sombre"
      aria-label="Basculer le theme clair/sombre"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2a3a68] bg-[#0b1222]/90 text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300 active:scale-[0.96] sm:h-10 sm:w-10"
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
  );

  const authControl = authUser ? (
    <button
      type="button"
      onClick={handleLogout}
      title="Cliquez pour deconnecter"
      className="flex h-9 items-center rounded-full border border-[#2a3a68] bg-[#0b1222]/90 p-1 text-slate-100 transition hover:border-yellow-500 sm:h-10"
    >
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-yellow-500/70 bg-[#121d38] text-[11px] font-black text-yellow-300 shadow-[0_0_0_2px_rgba(8,13,25,0.45)] sm:h-8 sm:w-8"
        aria-label={authUser.fullName || authUser.email || "Utilisateur"}
      >
        {avatarLetter}
      </span>
    </button>
  ) : (
    <Link
      href="/login"
      className="inline-flex h-9 items-center rounded-full border border-[#2a3a68] bg-[#0b1222]/90 px-3 text-[11px] font-semibold text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300 sm:h-10 sm:px-4 sm:text-xs"
    >
      {authLoading ? "Chargement..." : "Connexion"}
    </Link>
  );

  const createSiteLink = (
    <Link
      href="/create-site"
      className="nav-pill nav-pill-primary inline-flex h-11 items-center justify-center gap-2 px-4 text-xs sm:px-5"
    >
      <span>Creer mon site</span>
      <span className="text-lg leading-none">+</span>
    </Link>
  );

  const trainingLink = (
    <a
      href="https://youtube.com"
      target="_blank"
      rel="noreferrer"
      className="nav-pill nav-pill-primary inline-flex h-11 items-center justify-center px-4 text-xs sm:px-5"
    >
      Formation
    </a>
  );

  return (
    <>
      {introOverlay}
      <header
        className={`site-header sticky top-0 z-50 border-b border-white/8 bg-[#05070d]/88 shadow-[0_8px_28px_rgba(2,6,23,0.24)] backdrop-blur-xl transition-transform duration-300 ease-out ${
          isHeaderHidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <nav className="page-frame py-2.5 sm:py-3.5">
          <div className="hidden gap-3 lg:grid lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-center gap-3">
              {authControl}
              {createSiteLink}
              {trainingLink}
              <span className="h-6 w-px bg-[#233154]" />
              {languageButton}
              {themeButton}
            </div>
            <div className="justify-self-end">{brandBlock}</div>
          </div>

          <div className="mt-4 hidden rounded-lg border border-[#233154] bg-[#0b1222]/72 px-3 py-2 lg:block">
            <div className="flex justify-end">{navPills}</div>
          </div>

          <div className="grid gap-3 lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {themeButton}
                {languageButton}
              </div>

              <div className="min-w-0 scale-90">{brandBlock}</div>

            <button
              type="button"
              onClick={() => {
                setIsMobileNavOpen((current) => !current);
              }}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#2a3a68] bg-[#0b1222]/90 text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300"
              aria-label={isMobileNavOpen ? "Masquer la navigation" : "Afficher la navigation"}
              title={isMobileNavOpen ? "Masquer la navigation" : "Afficher la navigation"}
            >
              <span className="flex h-4 w-4 flex-col justify-center gap-1">
                <span className="h-0.5 rounded-full bg-current" />
                <span className="h-0.5 rounded-full bg-current" />
                <span className="h-0.5 rounded-full bg-current" />
              </span>
            </button>
            </div>

            <div className="flex items-center justify-center gap-3">
              {authControl}
              {createSiteLink}
              {trainingLink}
            </div>

            <div
              className={`overflow-hidden rounded-lg border border-[#233154] bg-[#0b1222]/72 transition-all duration-300 ease-out ${
                isMobileNavOpen ? "max-h-32 p-2 opacity-100" : "max-h-0 p-0 opacity-0"
              }`}
            >
              {navPills}
            </div>
          </div>
        </nav>
      </header>
    </>
  );
}
