import { requireEntrepriseActor } from "@/lib/server/auth";
import {
  isApplicationStatus,
  ApplicationStatus,
} from "@/lib/server/company-application-validation";
import { apiError, apiSuccess, handleApiError } from "@/lib/server/api-response";
import {
  cleanSearchTerm,
  isUuid,
  parseLimitParam,
  parsePageParam,
  parseSortParam,
} from "@/lib/server/query-utils";
import { supabaseGet } from "@/lib/server/supabase-rest";

type ApplicationRow = {
  id: string;
  job_offer_id: string;
  company_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  cover_letter: string | null;
  cv_path: string;
  cv_file_name: string | null;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type JobSummaryRow = {
  id: string;
  title: string;
  contract_type: string | null;
  location_city: string | null;
  status: string;
};

const APPLICATION_SELECT =
  "id,job_offer_id,company_id,candidate_name,candidate_email,candidate_phone,cover_letter,cv_path,cv_file_name,status,reviewed_by,reviewed_at,created_at,updated_at";

const ALLOWED_SORTS = ["newest", "oldest"] as const;
const SORT_TO_DB_ORDER: Record<(typeof ALLOWED_SORTS)[number], string> = {
  newest: "created_at.desc",
  oldest: "created_at.asc",
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actorOrResponse = await requireEntrepriseActor(
      request,
      "Only entreprise accounts can access company applications."
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
    if (statusParam && !isApplicationStatus(statusParam)) {
      return apiError(
        400,
        "INVALID_STATUS",
        "status must be one of: pending, shortlisted, rejected, hired."
      );
    }

    const jobIdParam = searchParams.get("jobId");
    if (jobIdParam && !isUuid(jobIdParam)) {
      return apiError(400, "INVALID_JOB_ID", "jobId must be a valid UUID.");
    }

    const search = cleanSearchTerm(searchParams.get("q"));
    const offset = (page - 1) * limit;

    const params = new URLSearchParams({
      select: APPLICATION_SELECT,
      company_id: `eq.${actor.companyId}`,
      order: SORT_TO_DB_ORDER[sort],
      limit: String(limit),
      offset: String(offset),
    });

    if (statusParam) {
      params.append("status", `eq.${statusParam}`);
    }

    if (jobIdParam) {
      params.append("job_offer_id", `eq.${jobIdParam}`);
    }

    if (search) {
      params.append(
        "or",
        `(candidate_name.ilike.*${search}*,candidate_email.ilike.*${search}*)`
      );
    }

    const result = await supabaseGet<ApplicationRow[]>(
      `applications?${params.toString()}`,
      {
        count: true,
      }
    );

    const applications = result.data;
    const total = result.count ?? applications.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    const jobIds = [...new Set(applications.map((item) => item.job_offer_id))];
    const jobsById = new Map<string, JobSummaryRow>();

    if (jobIds.length > 0) {
      const jobsParams = new URLSearchParams({
        select: "id,title,contract_type,location_city,status",
      });
      jobsParams.append("id", `in.(${jobIds.join(",")})`);

      const jobsResult = await supabaseGet<JobSummaryRow[]>(
        `job_offers?${jobsParams.toString()}`
      );

      for (const job of jobsResult.data) {
        jobsById.set(job.id, job);
      }
    }

    const data = applications.map((application) => ({
      ...application,
      job: jobsById.get(application.job_offer_id) ?? null,
    }));

    return apiSuccess(data, {
      page,
      limit,
      total,
      totalPages,
      sort,
      status: statusParam,
      jobId: jobIdParam,
      q: search,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
