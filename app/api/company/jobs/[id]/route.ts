import { requireEntrepriseActor } from "@/lib/server/auth";
import { parseJobPayload } from "@/lib/server/company-job-validation";
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonRequestBody,
} from "@/lib/server/api-response";
import { isUuid } from "@/lib/server/query-utils";
import {
  supabaseDelete,
  supabaseGet,
  supabasePatch,
} from "@/lib/server/supabase-rest";

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
  status: "draft" | "published" | "closed";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const JOB_SELECT =
  "id,company_id,title,description,contract_type,location_city,salary_min,salary_max,is_remote,status,published_at,created_at,updated_at";

export const runtime = "nodejs";

async function getJobById(id: string): Promise<JobRow | null> {
  const result = await supabaseGet<JobRow[]>(
    `job_offers?select=${JOB_SELECT}&id=eq.${id}&limit=1`
  );
  return result.data[0] ?? null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actorOrResponse = await requireEntrepriseActor(
      request,
      "Only entreprise accounts can update jobs."
    );
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }
    const actor = actorOrResponse;

    const { id } = await context.params;
    if (!isUuid(id)) {
      return apiError(400, "INVALID_ID", "Job id must be a valid UUID.");
    }

    const existingJob = await getJobById(id);
    if (!existingJob) {
      return apiError(404, "NOT_FOUND", "Job offer not found.");
    }

    if (existingJob.company_id !== actor.companyId) {
      return apiError(403, "FORBIDDEN", "You cannot modify this job offer.");
    }

    const parsedBody = await parseJsonRequestBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const payload = parseJobPayload(parsedBody.data, "update");
    if (payload.errors.length > 0) {
      return apiError(400, "INVALID_PAYLOAD", "Invalid job payload.", {
        errors: payload.errors,
      });
    }

    if (Object.keys(payload.data).length === 0) {
      return apiError(400, "INVALID_PAYLOAD", "No fields to update.");
    }

    const salaryMin =
      payload.data.salary_min !== undefined
        ? payload.data.salary_min
        : existingJob.salary_min;
    const salaryMax =
      payload.data.salary_max !== undefined
        ? payload.data.salary_max
        : existingJob.salary_max;

    if (
      salaryMin !== null &&
      salaryMax !== null &&
      salaryMin !== undefined &&
      salaryMax !== undefined &&
      salaryMin > salaryMax
    ) {
      return apiError(
        400,
        "INVALID_PAYLOAD",
        "salary_min must be lower than or equal to salary_max."
      );
    }

    const updateBody: Record<string, unknown> = {
      ...payload.data,
    };

    if (payload.data.status) {
      if (payload.data.status === "published" && !existingJob.published_at) {
        updateBody.published_at = new Date().toISOString();
      }

      if (payload.data.status !== "published") {
        updateBody.published_at = null;
      }
    }

    const result = await supabasePatch<JobRow[]>(
      `job_offers?id=eq.${id}&select=${JOB_SELECT}`,
      updateBody
    );

    const updatedJob = result.data[0];
    if (!updatedJob) {
      return apiError(404, "NOT_FOUND", "Job offer not found.");
    }

    return apiSuccess(updatedJob);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actorOrResponse = await requireEntrepriseActor(
      request,
      "Only entreprise accounts can delete jobs."
    );
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }
    const actor = actorOrResponse;

    const { id } = await context.params;
    if (!isUuid(id)) {
      return apiError(400, "INVALID_ID", "Job id must be a valid UUID.");
    }

    const existingJob = await getJobById(id);
    if (!existingJob) {
      return apiError(404, "NOT_FOUND", "Job offer not found.");
    }

    if (existingJob.company_id !== actor.companyId) {
      return apiError(403, "FORBIDDEN", "You cannot delete this job offer.");
    }

    await supabaseDelete<null>(`job_offers?id=eq.${id}`, {
      prefer: "return=minimal",
    });

    return apiSuccess({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
