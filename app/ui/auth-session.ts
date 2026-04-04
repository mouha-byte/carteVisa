type SupabasePublicConfig = {
  supabaseUrl: string;
  anonKey: string;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
};

type SupabaseProfileRow = {
  id: string;
  role: string | null;
  company_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export type StoredAuthSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
};

export type AppRole = "visitor" | "entreprise" | "super_admin";

export type AuthenticatedActor = {
  userId: string;
  email: string | null;
  role: AppRole;
  companyId: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  accessToken: string;
};

export const AUTH_SESSION_STORAGE_KEY = "cartevisite.auth.session.v1";

function normalizeRole(role: string | null): AppRole {
  if (role === "entreprise" || role === "super_admin") {
    return role;
  }

  return "visitor";
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
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

export function loadStoredSession(): StoredAuthSession | null {
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

export function clearStoredSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

export async function fetchActorFromSession(
  session: StoredAuthSession
): Promise<AuthenticatedActor | null> {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  const authResponse = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
    },
    cache: "no-store",
  });

  if (!authResponse.ok) {
    return null;
  }

  const authUser = (await authResponse.json()) as SupabaseAuthUser;
  if (!authUser || typeof authUser.id !== "string") {
    return null;
  }

  const profileParams = new URLSearchParams({
    select: "id,role,company_id,full_name,avatar_url",
    id: `eq.${authUser.id}`,
    limit: "1",
  });

  const profileResponse = await fetch(
    `${config.supabaseUrl}/rest/v1/profiles?${profileParams.toString()}`,
    {
      method: "GET",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    }
  );

  const profilePayload = profileResponse.ok
    ? ((await profileResponse.json()) as SupabaseProfileRow[])
    : [];

  const profile = Array.isArray(profilePayload) ? profilePayload[0] ?? null : null;

  return {
    userId: authUser.id,
    email: authUser.email ?? null,
    role: normalizeRole(profile?.role ?? null),
    companyId: profile?.company_id ?? null,
    fullName: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    accessToken: session.accessToken,
  };
}

export function toAuthHeader(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
