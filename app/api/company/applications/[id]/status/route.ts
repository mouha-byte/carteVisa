import { requireEntrepriseActor } from "@/lib/server/auth";
import { parseApplicationStatusPayload } from "@/lib/server/company-application-validation";
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonRequestBody,
} from "@/lib/server/api-response";
import { isUuid } from "@/lib/server/query-utils";
import { supabaseGet, supabasePatch } from "@/lib/server/supabase-rest";

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
  status: "pending" | "shortlisted" | "rejected" | "hired";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

const APPLICATION_SELECT =
  "id,job_offer_id,company_id,candidate_name,candidate_email,candidate_phone,cover_letter,cv_path,cv_file_name,status,reviewed_by,reviewed_at,created_at,updated_at";

export const runtime = "nodejs";

async function getApplicationById(id: string): Promise<ApplicationRow | null> {
  const result = await supabaseGet<ApplicationRow[]>(
    `applications?select=${APPLICATION_SELECT}&id=eq.${id}&limit=1`
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
      "Only entreprise accounts can update application status."
    );
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }
    const actor = actorOrResponse;

    const { id } = await context.params;
    if (!isUuid(id)) {
      return apiError(
        400,
        "INVALID_ID",
        "Application id must be a valid UUID."
      );
    }

    const existingApplication = await getApplicationById(id);
    if (!existingApplication) {
      return apiError(404, "NOT_FOUND", "Application not found.");
    }

    if (existingApplication.company_id !== actor.companyId) {
      return apiError(
        403,
        "FORBIDDEN",
        "You cannot update this application status."
      );
    }

    const parsedBody = await parseJsonRequestBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const payload = parseApplicationStatusPayload(parsedBody.data);
    if (payload.errors.length > 0 || !payload.status) {
      return apiError(400, "INVALID_PAYLOAD", "Invalid status payload.", {
        errors: payload.errors,
      });
    }

    const updateBody: Record<string, unknown> = {
      status: payload.status,
      reviewed_by: payload.status === "pending" ? null : actor.userId,
      reviewed_at:
        payload.status === "pending" ? null : new Date().toISOString(),
    };

    const result = await supabasePatch<ApplicationRow[]>(
      `applications?id=eq.${id}&select=${APPLICATION_SELECT}`,
      updateBody
    );

    const updatedApplication = result.data[0];
    if (!updatedApplication) {
      return apiError(404, "NOT_FOUND", "Application not found.");
    }

    return apiSuccess(updatedApplication);
  } catch (error) {
    return handleApiError(error);
  }
}
