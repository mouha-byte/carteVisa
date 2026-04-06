import {
  getSupabaseEnvHints,
  getSupabaseServerConfig,
} from "@/lib/server/supabase-config";

type SupabaseRequestOptions = {
  count?: boolean;
  prefer?: string;
  body?: unknown;
};

type SupabaseRequestResult<T> = {
  data: T;
  count: number | null;
  status: number;
};

type SupabaseRestMethod = "GET" | "POST" | "PATCH" | "DELETE";

export class SupabaseRestError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "SupabaseRestError";
    this.status = status;
    this.details = details;
  }
}

function getSupabaseConfig(method: SupabaseRestMethod) {
  const { supabaseUrl, serviceRoleKey, anonKey } = getSupabaseServerConfig();

  if (!supabaseUrl) {
    throw new SupabaseRestError("Missing Supabase URL. " + getSupabaseEnvHints(), 500);
  }

  // Public read routes can use the anon key when service role is not configured.
  if (method === "GET") {
    const apiKey = serviceRoleKey ?? anonKey;

    if (!apiKey) {
      throw new SupabaseRestError(
        "Missing Supabase API key. " + getSupabaseEnvHints(),
        500
      );
    }

    return {
      supabaseUrl: supabaseUrl.replace(/\/$/, ""),
      apiKey,
    };
  }

  if (!serviceRoleKey) {
    throw new SupabaseRestError("Missing service role key. " + getSupabaseEnvHints(), 500);
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    apiKey: serviceRoleKey,
  };
}

function parseCount(contentRange: string | null): number | null {
  if (!contentRange) {
    return null;
  }

  const split = contentRange.split("/");
  if (split.length !== 2) {
    return null;
  }

  const total = Number.parseInt(split[1], 10);
  return Number.isFinite(total) ? total : null;
}

async function supabaseRequest<T>(
  method: SupabaseRestMethod,
  resourcePath: string,
  options: SupabaseRequestOptions = {}
): Promise<SupabaseRequestResult<T>> {
  const { supabaseUrl, apiKey } = getSupabaseConfig(method);
  const url = `${supabaseUrl}/rest/v1/${resourcePath}`;

  const headers = new Headers({
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
  });

  const preferValues: string[] = [];
  if (options.count) {
    preferValues.push("count=exact");
  }
  if (options.prefer) {
    preferValues.push(options.prefer);
  }
  if (preferValues.length > 0) {
    headers.set("Prefer", preferValues.join(","));
  }

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const raw = await response.text();

  if (!response.ok) {
    let details: unknown = raw;
    try {
      details = raw ? JSON.parse(raw) : null;
    } catch {
      details = raw;
    }

    const message =
      typeof details === "object" &&
      details !== null &&
      "message" in details &&
      typeof (details as { message?: unknown }).message === "string"
        ? ((details as { message: string }).message ?? "Supabase request failed.")
        : "Supabase request failed.";

    throw new SupabaseRestError(message, response.status, details);
  }

  const parsed = (!raw
    ? method === "GET"
      ? []
      : null
    : JSON.parse(raw)) as T;

  return {
    data: parsed,
    count: options.count ? parseCount(response.headers.get("content-range")) : null,
    status: response.status,
  };
}

export async function supabaseGet<T>(
  resourcePath: string,
  options: Pick<SupabaseRequestOptions, "count"> = {}
): Promise<SupabaseRequestResult<T>> {
  return supabaseRequest<T>("GET", resourcePath, options);
}

export async function supabasePost<T>(
  resourcePath: string,
  body: unknown,
  options: Pick<SupabaseRequestOptions, "prefer"> = {}
): Promise<SupabaseRequestResult<T>> {
  return supabaseRequest<T>("POST", resourcePath, {
    body,
    prefer: options.prefer ?? "return=representation",
  });
}

export async function supabasePatch<T>(
  resourcePath: string,
  body: unknown,
  options: Pick<SupabaseRequestOptions, "prefer"> = {}
): Promise<SupabaseRequestResult<T>> {
  return supabaseRequest<T>("PATCH", resourcePath, {
    body,
    prefer: options.prefer ?? "return=representation",
  });
}

export async function supabaseDelete<T>(
  resourcePath: string,
  options: Pick<SupabaseRequestOptions, "prefer"> = {}
): Promise<SupabaseRequestResult<T>> {
  return supabaseRequest<T>("DELETE", resourcePath, {
    prefer: options.prefer ?? "return=representation",
  });
}
