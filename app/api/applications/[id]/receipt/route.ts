import { apiError, apiSuccess, handleApiError } from "@/lib/server/api-response";
import { isUuid } from "@/lib/server/query-utils";
import { supabaseGet } from "@/lib/server/supabase-rest";

type ApplicationRow = {
  id: string;
  job_offer_id: string;
  company_id: string;
  candidate_name: string;
  candidate_email: string;
  status: string;
  created_at: string;
};

type JobRow = {
  id: string;
  title: string;
  contract_type: string | null;
  location_city: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
};

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!isUuid(id)) {
      return apiError(
        400,
        "INVALID_ID",
        "Application id must be a valid UUID."
      );
    }

    const applicationResult = await supabaseGet<ApplicationRow[]>(
      "applications?select=id,job_offer_id,company_id,candidate_name,candidate_email,status,created_at" +
        `&id=eq.${id}&limit=1`
    );

    const application = applicationResult.data[0];
    if (!application) {
      return apiError(404, "NOT_FOUND", "Application receipt not found.");
    }

    const [jobResult, companyResult] = await Promise.all([
      supabaseGet<JobRow[]>(
        `job_offers?select=id,title,contract_type,location_city&id=eq.${application.job_offer_id}&limit=1`
      ),
      supabaseGet<CompanyRow[]>(
        `companies?select=id,name,slug&id=eq.${application.company_id}&limit=1`
      ),
    ]);

    return apiSuccess({
      id: application.id,
      status: application.status,
      submitted_at: application.created_at,
      candidate: {
        name: application.candidate_name,
        email: application.candidate_email,
      },
      job: jobResult.data[0] ?? null,
      company: companyResult.data[0] ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
