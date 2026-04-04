import { apiError, apiSuccess } from "@/lib/server/api-response";
import { supabaseGet } from "@/lib/server/supabase-rest";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();

  try {
    await supabaseGet<unknown[]>("categories?select=id&limit=1");

    return apiSuccess(
      {
        status: "ok",
        services: {
          api: true,
          supabase: true,
        },
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

    return apiError(503, "SERVICE_UNAVAILABLE", message);
  }
}
