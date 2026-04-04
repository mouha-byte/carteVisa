import { apiError } from "@/lib/server/api-response";
import { SupabaseRestError, supabaseGet } from "@/lib/server/supabase-rest";

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
};

type ProfileRow = {
  id: string;
  role: string;
  company_id: string | null;
};

export type UserRole = "visitor" | "entreprise" | "super_admin";

export type AuthenticatedActor = {
  userId: string;
  email: string | null;
  role: UserRole;
  companyId: string | null;
};

function getPublicSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new SupabaseRestError("Missing NEXT_PUBLIC_SUPABASE_URL.", 500);
  }

  if (!anonKey) {
    throw new SupabaseRestError("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.", 500);
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    anonKey,
  };
}

function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.trim().split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

async function getAuthenticatedUser(
  request: Request
): Promise<SupabaseAuthUser | null> {
  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return null;
  }

  const { supabaseUrl, anonKey } = getPublicSupabaseConfig();

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as SupabaseAuthUser;
  if (!data || typeof data.id !== "string") {
    return null;
  }

  return data;
}

function normalizeRole(role: string): UserRole {
  if (role === "entreprise" || role === "super_admin") {
    return role;
  }

  return "visitor";
}

export async function getAuthenticatedActor(
  request: Request
): Promise<AuthenticatedActor | null> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return null;
  }

  const profileResult = await supabaseGet<ProfileRow[]>(
    `profiles?select=id,role,company_id&id=eq.${user.id}&limit=1`
  );

  const profile = profileResult.data[0];
  if (!profile) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: normalizeRole(profile.role),
    companyId: profile.company_id,
  };
}

export function isEntrepriseActor(
  actor: AuthenticatedActor | null
): actor is AuthenticatedActor & { role: "entreprise"; companyId: string } {
  return Boolean(actor && actor.role === "entreprise" && actor.companyId);
}

export function isEntrepriseRoleActor(
  actor: AuthenticatedActor | null
): actor is AuthenticatedActor & { role: "entreprise" } {
  return Boolean(actor && actor.role === "entreprise");
}

export function isSuperAdminActor(
  actor: AuthenticatedActor | null
): actor is AuthenticatedActor & { role: "super_admin" } {
  return Boolean(actor && actor.role === "super_admin");
}

export async function requireAuthenticatedActor(
  request: Request
): Promise<AuthenticatedActor | Response> {
  const actor = await getAuthenticatedActor(request);
  if (!actor) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  return actor;
}

export async function requireEntrepriseActor(
  request: Request,
  forbiddenMessage = "Only entreprise accounts can access this endpoint."
): Promise<(AuthenticatedActor & { role: "entreprise"; companyId: string }) | Response> {
  const actor = await getAuthenticatedActor(request);
  if (!actor) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  if (!isEntrepriseActor(actor)) {
    return apiError(403, "FORBIDDEN", forbiddenMessage);
  }

  return actor;
}

export async function requireSuperAdminActor(
  request: Request,
  forbiddenMessage = "Only super admin accounts can access this endpoint."
): Promise<(AuthenticatedActor & { role: "super_admin" }) | Response> {
  const actor = await getAuthenticatedActor(request);
  if (!actor) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  if (!isSuperAdminActor(actor)) {
    return apiError(403, "FORBIDDEN", forbiddenMessage);
  }

  return actor;
}
