import { apiSuccess, handleApiError } from "@/lib/server/api-response";
import { supabaseGet } from "@/lib/server/supabase-rest";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const params = new URLSearchParams({
      select: "id,name,slug,is_active",
      order: "name.asc",
    });

    if (!includeInactive) {
      params.append("is_active", "eq.true");
    }

    const result = await supabaseGet<CategoryRow[]>(`categories?${params.toString()}`);

    return apiSuccess(result.data, {
      total: result.data.length,
      includeInactive,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
