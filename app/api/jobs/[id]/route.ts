import { apiError, apiSuccess, handleApiError } from "@/lib/server/api-response";
import { isUuid } from "@/lib/server/query-utils";
import { supabaseGet } from "@/lib/server/supabase-rest";

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
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type CompanySummaryRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  city: string | null;
  sector: string | null;
};

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!isUuid(id)) {
      return apiError(400, "INVALID_ID", "Job id must be a valid UUID.");
    }

    const jobParams = new URLSearchParams({
      select:
        "id,company_id,title,description,contract_type,location_city,salary_min,salary_max,is_remote,status,published_at,created_at,updated_at",
      id: `eq.${id}`,
      status: "eq.published",
      limit: "1",
    });

    const jobResult = await supabaseGet<JobRow[]>(`job_offers?${jobParams.toString()}`);
    const job = jobResult.data[0];

    if (!job) {
      return apiError(404, "NOT_FOUND", "Job not found.");
    }

    const companyParams = new URLSearchParams({
      select: "id,name,slug,logo_url,city,sector",
      id: `eq.${job.company_id}`,
      status: "eq.active",
      limit: "1",
    });

    const companyResult = await supabaseGet<CompanySummaryRow[]>(
      `companies?${companyParams.toString()}`
    );

    const company = companyResult.data[0] ?? null;
    if (!company) {
      return apiError(404, "NOT_FOUND", "Company for this job was not found.");
    }

    return apiSuccess({
      ...job,
      company,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
