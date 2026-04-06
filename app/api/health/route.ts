import { apiError, apiSuccess } from "@/lib/server/api-response";
import { getSupabaseServerConfig } from "@/lib/server/supabase-config";
import { supabaseGet } from "@/lib/server/supabase-rest";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  const config = getSupabaseServerConfig();

  const diagnostics = {
    supabaseUrlConfigured: Boolean(config.supabaseUrl),
    anonKeyConfigured: Boolean(config.anonKey),
    serviceRoleConfigured: Boolean(config.serviceRoleKey),
    sourceKeys: config.sourceKeys,
    supabaseHost: config.supabaseUrl
      ? (() => {
          try {
            return new URL(config.supabaseUrl).host;
          } catch {
            return "invalid-url";
          }
        })()
      : null,
  };

  try {
    await supabaseGet<unknown[]>("categories?select=id&limit=1");

    return apiSuccess(
      {
        status: "ok",
        services: {
          api: true,
          supabase: true,
        },
        env: diagnostics,
        timestamp: new Date().toISOString(),
      },
      {
        responseTimeMs: Date.now() - startedAt,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Supabase is currently unreachable.";

    return apiError(503, "SERVICE_UNAVAILABLE", message, diagnostics);
  }
}
