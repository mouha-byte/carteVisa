"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  { label: "Contact", href: "/contact" },
];

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

function buildAvatarInitials(user: BannerAuthUser | null): string {
  const source = (user?.fullName || user?.email || "CV").trim();
  if (!source) {
    return "CV";
  }

  const chunks = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase() ?? "");

  return chunks.join("") || "CV";
}

export function SiteBanner() {
  const [authUser, setAuthUser] = useState<BannerAuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  const avatarInitials = useMemo(() => buildAvatarInitials(authUser), [authUser]);

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
      <nav className="mx-auto flex w-full max-w-[92rem] items-center justify-between gap-4 px-[var(--page-gutter)] py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/cartevisite-logo.png"
              alt="Logo CarteVisite"
              width={72}
              height={72}
              className="h-16 w-16 rounded-lg border border-[#2a3a68] bg-[#0b1222] p-1"
            />
            <div>
              <span className="headline-script text-2xl text-white md:text-3xl">CarteVisite</span>
              <span className="hidden text-xs uppercase tracking-[0.15em] text-slate-400 md:block">
                Publications et visibilite d entreprises
              </span>
            </div>
          </Link>
        </div>

        <div className="hidden items-center gap-5 text-sm font-medium text-slate-300 md:flex">
          {MAIN_NAV_LINKS.map((item) => (
            <Link key={item.label} href={item.href} className="hover:text-yellow-300">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/create-site"
            className="cta-yellow-anim rounded-full border border-yellow-500 bg-yellow-500 px-4 py-2 text-sm font-semibold text-[#05070d] transition hover:bg-yellow-400"
          >
            Creer mon site web
          </Link>
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noreferrer"
            className="cta-yellow-anim rounded-full border border-yellow-500 bg-yellow-500 px-4 py-2 text-sm font-semibold text-[#05070d] transition hover:bg-yellow-400"
          >
            Formation
          </a>

          {authUser ? (
            <button
              type="button"
              onClick={handleLogout}
              title="Cliquez pour deconnecter"
              className="flex items-center gap-2 rounded-full border border-[#2a3a68] bg-[#0b1222] px-2 py-1.5 text-slate-100"
            >
              {authUser.avatarUrl ? (
                <img
                  src={authUser.avatarUrl}
                  alt={`Avatar ${authUser.fullName || authUser.email || "utilisateur"}`}
                  className="h-8 w-8 rounded-full border border-[#2a3a68] object-cover"
                />
              ) : (
                <span className="max-w-[180px] truncate rounded-full border border-[#2a3a68] bg-[#121d38] px-3 py-1 text-xs font-semibold text-slate-100">
                  {authUser.fullName || authUser.email || avatarInitials}
                </span>
              )}
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-[#2a3a68] bg-[#0b1222] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300"
            >
              {authLoading ? "Chargement..." : "Connexion"}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
