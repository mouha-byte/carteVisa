import { requireEntrepriseActor } from "@/lib/server/auth";
import {
  JOB_STATUSES,
  JobStatus,
  parseJobPayload,
} from "@/lib/server/company-job-validation";
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonRequestBody,
} from "@/lib/server/api-response";
import {
  parseLimitParam,
  parsePageParam,
  parseSortParam,
} from "@/lib/server/query-utils";
import { supabaseGet, supabasePost } from "@/lib/server/supabase-rest";

type JobRow = {
  id: string;
  company_id: string;
  title: string;
  description: string;
  contract_type: string | null;
  location_city: string | null;
  salary_min: number | null;
  salary_max: number | null;
  is_remote: boolean;
  status: JobStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const ALLOWED_SORTS = ["newest", "oldest"] as const;
const SORT_TO_DB_ORDER: Record<(typeof ALLOWED_SORTS)[number], string> = {
  newest: "created_at.desc",
  oldest: "created_at.asc",
};

const JOB_SELECT =
  "id,company_id,title,description,contract_type,location_city,salary_min,salary_max,is_remote,status,published_at,created_at,updated_at";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actorOrResponse = await requireEntrepriseActor(
      request,
      "Only entreprise accounts can access company jobs."
    );
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }
    const actor = actorOrResponse;

    const { searchParams } = new URL(request.url);
    const page = parsePageParam(searchParams.get("page"), 1);
    const limit = parseLimitParam(searchParams.get("limit"), 20, 100);
    const sort = parseSortParam(searchParams.get("sort"), ALLOWED_SORTS, "newest");

    const statusParam = searchParams.get("status");
    if (statusParam && !JOB_STATUSES.includes(statusParam as JobStatus)) {
      return apiError(
        400,
        "INVALID_STATUS",
        "status must be one of: draft, published, closed."
      );
    }

    const offset = (page - 1) * limit;

    const params = new URLSearchParams({
      select: JOB_SELECT,
      company_id: `eq.${actor.companyId}`,
      order: SORT_TO_DB_ORDER[sort],
      limit: String(limit),
      offset: String(offset),
    });

    if (statusParam) {
      params.append("status", `eq.${statusParam}`);
    }

    const result = await supabaseGet<JobRow[]>(`job_offers?${params.toString()}`, {
      count: true,
    });

    const total = result.count ?? result.data.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return apiSuccess(result.data, {
      page,
      limit,
      total,
      totalPages,
      sort,
      status: statusParam,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actorOrResponse = await requireEntrepriseActor(
      request,
      "Only entreprise accounts can create jobs."
    );
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }
    const actor = actorOrResponse;

    const parsedBody = await parseJsonRequestBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const payload = parseJobPayload(parsedBody.data, "create");
    if (payload.errors.length > 0) {
      return apiError(400, "INVALID_PAYLOAD", "Invalid job payload.", {
        errors: payload.errors,
      });
    }

    const status = payload.data.status ?? "draft";

    const createBody = {
      company_id: actor.companyId,
      created_by: actor.userId,
      title: payload.data.title,
      description: payload.data.description,
      contract_type: payload.data.contract_type ?? null,
      location_city: payload.data.location_city ?? null,
      salary_min: payload.data.salary_min ?? null,
      salary_max: payload.data.salary_max ?? null,
      is_remote: payload.data.is_remote ?? false,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    };

    const result = await supabasePost<JobRow[]>(
      `job_offers?select=${JOB_SELECT}`,
      createBody
    );

    const job = result.data[0];
    if (!job) {
      return apiError(500, "CREATE_FAILED", "Failed to create job offer.");
    }

    return apiSuccess(job, undefined, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
