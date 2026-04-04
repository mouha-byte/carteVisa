import { requireSuperAdminActor } from "@/lib/server/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/server/api-response";
import {
  cleanSearchTerm,
  parseLimitParam,
  parsePageParam,
  parseSortParam,
} from "@/lib/server/query-utils";
import { parseCoverLetterContent } from "@/lib/server/application-cover-letter";
import { supabaseGet } from "@/lib/server/supabase-rest";

type ApplicationStatus = "pending" | "shortlisted" | "rejected" | "hired";

type AdminApplicationRow = {
  id: string;
  job_offer_id: string;
  company_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  cover_letter: string | null;
  cv_path: string | null;
  cv_file_name: string | null;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type CompanySummaryRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
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

const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "pending",
  "shortlisted",
  "rejected",
  "hired",
] as const;

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actorOrResponse = await requireSuperAdminActor(
      request,
      "Only super admin accounts can access admin applications."
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
      !APPLICATION_STATUSES.includes(statusFilter as ApplicationStatus)
    ) {
      return apiError(
        400,
        "INVALID_STATUS",
        "status must be one of: pending, shortlisted, rejected, hired."
      );
    }

    const offset = (page - 1) * limit;

    const params = new URLSearchParams({
      select: APPLICATION_SELECT,
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
        `(candidate_name.ilike.*${search}*,candidate_email.ilike.*${search}*,cover_letter.ilike.*${search}*)`
      );
    }

    const result = await supabaseGet<AdminApplicationRow[]>(
      `applications?${params.toString()}`,
      {
        count: true,
      }
    );

    const applications = result.data;
    const total = result.count ?? applications.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    const companyIds = [...new Set(applications.map((item) => item.company_id))];
    const jobIds = [...new Set(applications.map((item) => item.job_offer_id))];

    const companiesById = new Map<string, CompanySummaryRow>();
    const jobsById = new Map<string, JobSummaryRow>();

    if (companyIds.length > 0) {
      const companyParams = new URLSearchParams({
        select: "id,name,slug,status",
      });
      companyParams.append("id", `in.(${companyIds.join(",")})`);

      const companiesResult = await supabaseGet<CompanySummaryRow[]>(
        `companies?${companyParams.toString()}`
      );

      for (const company of companiesResult.data) {
        companiesById.set(company.id, company);
      }
    }

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
      ...parseCoverLetterContent(application.cover_letter),
      company: companiesById.get(application.company_id) ?? null,
      job: jobsById.get(application.job_offer_id) ?? null,
    }));

    return apiSuccess(data, {
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
