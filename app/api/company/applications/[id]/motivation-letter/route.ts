import { requireEntrepriseActor } from "@/lib/server/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/server/api-response";
import { parseCoverLetterContent } from "@/lib/server/application-cover-letter";
import { isUuid } from "@/lib/server/query-utils";
import { supabaseGet } from "@/lib/server/supabase-rest";
import { createSupabaseStorageSignedUrl } from "@/lib/server/supabase-storage";

type ApplicationMotivationRow = {
  id: string;
  company_id: string;
  cover_letter: string | null;
};

const APPLICATION_MOTIVATION_SELECT = "id,company_id,cover_letter";

export const runtime = "nodejs";

function getDownloadExpirationSeconds(): number {
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
      "Only entreprise accounts can download motivation letters."
    );
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }
    const actor = actorOrResponse;

    const { id } = await context.params;
    if (!isUuid(id)) {
      return apiError(400, "INVALID_ID", "Application id must be a valid UUID.");
    }

    const applicationResult = await supabaseGet<ApplicationMotivationRow[]>(
      `applications?select=${APPLICATION_MOTIVATION_SELECT}&id=eq.${id}&limit=1`
    );

    const application = applicationResult.data[0];
    if (!application) {
      return apiError(404, "NOT_FOUND", "Application not found.");
    }

    if (application.company_id !== actor.companyId) {
      return apiError(
        403,
        "FORBIDDEN",
        "You cannot access this motivation letter file."
      );
    }

    const parsed = parseCoverLetterContent(application.cover_letter);
    if (!parsed.motivationLetterPath) {
      return apiError(
        404,
        "NOT_FOUND",
        "No motivation letter file found for this application."
      );
    }

    const bucket = process.env.SUPABASE_STORAGE_CV_BUCKET || "candidate-cv";
    const expiresInSeconds = getDownloadExpirationSeconds();

    const downloadUrl = await createSupabaseStorageSignedUrl(
      bucket,
      parsed.motivationLetterPath,
      expiresInSeconds
    );

    return apiSuccess({
      application_id: application.id,
      motivation_letter_path: parsed.motivationLetterPath,
      download_url: downloadUrl,
      expires_in_seconds: expiresInSeconds,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
