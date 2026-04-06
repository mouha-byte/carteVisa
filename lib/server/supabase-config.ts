type EnvResolution = {
  value: string | null;
  key: string | null;
};

export type SupabaseServerConfig = {
  supabaseUrl: string | null;
  anonKey: string | null;
  serviceRoleKey: string | null;
  sourceKeys: {
    supabaseUrl: string | null;
    anonKey: string | null;
    serviceRoleKey: string | null;
  };
};

const SUPABASE_URL_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
] as const;

const SUPABASE_ANON_KEY_KEYS = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
] as const;

const SUPABASE_SERVICE_ROLE_KEY_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
] as const;

function normalizeEnvValue(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }

  let value = raw.trim();
  if (!value) {
    return null;
  }

  const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"');
  const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");

  if ((hasDoubleQuotes || hasSingleQuotes) && value.length > 1) {
    value = value.slice(1, -1).trim();
  }

  return value || null;
}

function resolveFirstEnvValue(keys: readonly string[]): EnvResolution {
  for (const key of keys) {
    const value = normalizeEnvValue(process.env[key]);
    if (value) {
      return { value, key };
    }
  }

  return { value: null, key: null };
}

export function getSupabaseServerConfig(): SupabaseServerConfig {
  const supabaseUrl = resolveFirstEnvValue(SUPABASE_URL_KEYS);
  const anonKey = resolveFirstEnvValue(SUPABASE_ANON_KEY_KEYS);
  const serviceRoleKey = resolveFirstEnvValue(SUPABASE_SERVICE_ROLE_KEY_KEYS);

  const normalizedUrl = supabaseUrl.value
    ? supabaseUrl.value.replace(/\/+$/, "")
    : null;

  return {
    supabaseUrl: normalizedUrl,
    anonKey: anonKey.value,
    serviceRoleKey: serviceRoleKey.value,
    sourceKeys: {
      supabaseUrl: supabaseUrl.key,
      anonKey: anonKey.key,
      serviceRoleKey: serviceRoleKey.key,
    },
  };
}

export function getSupabaseEnvHints(): string {
  return "Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY), and SUPABASE_SERVICE_ROLE_KEY in Vercel project settings.";
}
