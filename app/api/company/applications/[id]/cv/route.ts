import { requireEntrepriseActor } from "@/lib/server/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/server/api-response";
import { isUuid } from "@/lib/server/query-utils";
import { supabaseGet } from "@/lib/server/supabase-rest";
import { createSupabaseStorageSignedUrl } from "@/lib/server/supabase-storage";

type ApplicationCvRow = {
  id: string;
  company_id: string;
  cv_path: string;
  cv_file_name: string | null;
};

const APPLICATION_CV_SELECT = "id,company_id,cv_path,cv_file_name";

export const runtime = "nodejs";

function getCvDownloadExpirationSeconds(): number {
  const raw = Number.parseInt(process.env.CV_DOWNLOAD_URL_EXP_SECONDS ?? "300", 10);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 300;
  }

  return Math.min(raw, 3600);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actorOrResponse = await requireEntrepriseActor(
      request,
      "Only entreprise accounts can download CV files."
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

    const applicationResult = await supabaseGet<ApplicationCvRow[]>(
      `applications?select=${APPLICATION_CV_SELECT}&id=eq.${id}&limit=1`
    );

    const application = applicationResult.data[0];
    if (!application) {
      return apiError(404, "NOT_FOUND", "Application not found.");
    }

    if (application.company_id !== actor.companyId) {
      return apiError(403, "FORBIDDEN", "You cannot access this CV file.");
    }

    const bucket = process.env.SUPABASE_STORAGE_CV_BUCKET || "candidate-cv";
    const expiresInSeconds = getCvDownloadExpirationSeconds();

    const downloadUrl = await createSupabaseStorageSignedUrl(
      bucket,
      application.cv_path,
      expiresInSeconds
    );

    return apiSuccess({
      application_id: application.id,
      cv_file_name: application.cv_file_name,
      cv_path: application.cv_path,
      download_url: downloadUrl,
      expires_in_seconds: expiresInSeconds,
    });
  } catch (error) {
    return handleApiError(error);
  }
}