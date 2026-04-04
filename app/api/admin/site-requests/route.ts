import { requireSuperAdminActor } from "@/lib/server/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/server/api-response";
import {
  cleanSearchTerm,
  parseLimitParam,
  parsePageParam,
  parseSortParam,
} from "@/lib/server/query-utils";
import { supabaseGet } from "@/lib/server/supabase-rest";

type SiteRequestStatus = "new" | "in_progress" | "closed";

type SiteRequestRow = {
  id: string;
  company_name: string;
  sector: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  needs: string;
  status: SiteRequestStatus;
  admin_notes: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
};

const ALLOWED_SORTS = ["newest", "oldest"] as const;
const SORT_TO_DB_ORDER: Record<(typeof ALLOWED_SORTS)[number], string> = {
  newest: "created_at.desc",
  oldest: "created_at.asc",
};

const SITE_REQUEST_STATUSES: readonly SiteRequestStatus[] = [
  "new",
  "in_progress",
  "closed",
] as const;

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actorOrResponse = await requireSuperAdminActor(
      request,
      "Only super admin accounts can access site requests."
    );
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }

    const { searchParams } = new URL(request.url);
    const page = parsePageParam(searchParams.get("page"), 1);
    const limit = parseLimitParam(searchParams.get("limit"), 20, 100);
    const sort = parseSortParam(searchParams.get("sort"), ALLOWED_SORTS, "newest");
    const statusFilter = searchParams.get("status");
    const search = cleanSearchTerm(searchParams.get("q"));

    if (
      statusFilter !== null &&
      !SITE_REQUEST_STATUSES.includes(statusFilter as SiteRequestStatus)
    ) {
      return apiError(
        400,
        "INVALID_STATUS",
        "status must be one of: new, in_progress, closed."
      );
    }

    const offset = (page - 1) * limit;

    const params = new URLSearchParams({
      select:
        "id,company_name,sector,contact_name,email,phone,needs,status,admin_notes,handled_by,handled_at,created_at,updated_at",
      order: SORT_TO_DB_ORDER[sort],
      limit: String(limit),
      offset: String(offset),
    });

    if (statusFilter) {
      params.append("status", `eq.${statusFilter}`);
    }

    if (search) {
      params.append(
        "or",
        `(company_name.ilike.*${search}*,contact_name.ilike.*${search}*,email.ilike.*${search}*,needs.ilike.*${search}*)`
      );
    }

    const result = await supabaseGet<SiteRequestRow[]>(
      `website_creation_requests?${params.toString()}`,
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
      status: statusFilter,
      q: search,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
