import { requireSuperAdminActor } from "@/lib/server/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/server/api-response";
import {
  cleanSearchTerm,
  parseLimitParam,
  parsePageParam,
  parseSortParam,
} from "@/lib/server/query-utils";
import { supabaseGet } from "@/lib/server/supabase-rest";

type ContactMessageRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  message: string;
  is_handled: boolean;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
};

const ALLOWED_SORTS = ["newest", "oldest"] as const;
const SORT_TO_DB_ORDER: Record<(typeof ALLOWED_SORTS)[number], string> = {
  newest: "created_at.desc",
  oldest: "created_at.asc",
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actorOrResponse = await requireSuperAdminActor(
      request,
      "Only super admin accounts can access contact messages."
    );
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }

    const { searchParams } = new URL(request.url);
    const page = parsePageParam(searchParams.get("page"), 1);
    const limit = parseLimitParam(searchParams.get("limit"), 20, 100);
    const sort = parseSortParam(searchParams.get("sort"), ALLOWED_SORTS, "newest");
    const handled = searchParams.get("handled");
    const search = cleanSearchTerm(searchParams.get("q"));

    if (handled !== null && handled !== "true" && handled !== "false") {
      return apiError(
        400,
        "INVALID_FILTER",
        "handled must be either true or false when provided."
      );
    }

    const offset = (page - 1) * limit;

    const params = new URLSearchParams({
      select:
        "id,full_name,email,phone,message,is_handled,handled_by,handled_at,created_at",
      order: SORT_TO_DB_ORDER[sort],
      limit: String(limit),
      offset: String(offset),
    });

    if (handled !== null) {
      params.append("is_handled", `eq.${handled}`);
    }

    if (search) {
      params.append(
        "or",
        `(full_name.ilike.*${search}*,email.ilike.*${search}*,message.ilike.*${search}*)`
      );
    }

    const result = await supabaseGet<ContactMessageRow[]>(
      `contact_messages?${params.toString()}`,
      {
        count: true,
      }
    );

    const total = result.count ?? result.data.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return apiSuccess(result.data, {
      page,
      limit,
      total,
      totalPages,
      sort,
      handled,
      q: search,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
