import { apiError, apiSuccess, handleApiError } from "@/lib/server/api-response";
import { isUuid } from "@/lib/server/query-utils";
import { supabaseGet, supabasePost } from "@/lib/server/supabase-rest";
import { uploadToSupabaseStorage } from "@/lib/server/supabase-storage";
import { sendApplicationEmails } from "@/lib/server/transactional-email";

type JobOfferRow = {
  id: string;
  company_id: string;
  title: string;
  status: string;
};

type CompanyRow = {
  id: string;
  name: string;
  email: string | null;
};

type ApplicationInsertRow = {
  id: string;
  job_offer_id: string;
  company_id: string;
  candidate_name: string;
  candidate_email: string;
  status: string;
  created_at: string;
};

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const runtime = "nodejs";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getDocumentMaxSizeBytes(envVarName: string, fallbackMb: number): number {
  const raw = Number.parseInt(process.env[envVarName] ?? String(fallbackMb), 10);
  const maxMb = Number.isFinite(raw) && raw > 0 ? raw : fallbackMb;
  return maxMb * 1024 * 1024;
}

function getCvMaxSizeBytes(): number {
  return getDocumentMaxSizeBytes("CV_MAX_SIZE_MB", 8);
}

function getMotivationLetterMaxSizeBytes(): number {
  return getDocumentMaxSizeBytes("MOTIVATION_LETTER_MAX_SIZE_MB", 8);
}

function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return "cv-file";
  }

  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized.slice(0, 120) || "cv-file";
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return apiError(
        400,
        "INVALID_CONTENT_TYPE",
        "Content-Type must be multipart/form-data."
      );
    }

    const formData = await request.formData();

    const jobOfferId = String(formData.get("job_offer_id") ?? "").trim();
    const candidateName = String(formData.get("candidate_name") ?? "").trim();
    const candidateEmail = String(formData.get("candidate_email") ?? "").trim();
    const candidatePhone = String(formData.get("candidate_phone") ?? "").trim();
    const coverLetter = String(formData.get("cover_letter") ?? "").trim();

    const cv = formData.get("cv");
    const motivationLetterRaw = formData.get("motivation_letter");
    const motivationLetter =
      motivationLetterRaw instanceof File &&
      motivationLetterRaw.name.trim().length > 0 &&
      motivationLetterRaw.size > 0
        ? motivationLetterRaw
        : null;

    const errors: string[] = [];

    if (!isUuid(jobOfferId)) {
      errors.push("job_offer_id must be a valid UUID.");
    }

    if (candidateName.length < 2) {
      errors.push("candidate_name must be at least 2 characters.");
    }

    if (!isValidEmail(candidateEmail)) {
      errors.push("candidate_email must be a valid email address.");
    }

    if (!(cv instanceof File)) {
      errors.push("cv is required and must be a file.");
    }

    if (cv instanceof File) {
      if (!ALLOWED_DOCUMENT_MIME_TYPES.has(cv.type)) {
        errors.push("cv must be PDF, DOC, or DOCX.");
      }

      if (cv.size > getCvMaxSizeBytes()) {
        errors.push("cv exceeds the maximum allowed size.");
      }
    }

    if (motivationLetterRaw !== null && !(motivationLetterRaw instanceof File)) {
      errors.push("motivation_letter must be a file.");
    }

    if (motivationLetter instanceof File) {
      if (!ALLOWED_DOCUMENT_MIME_TYPES.has(motivationLetter.type)) {
        errors.push("motivation_letter must be PDF, DOC, or DOCX.");
      }

      if (motivationLetter.size > getMotivationLetterMaxSizeBytes()) {
        errors.push("motivation_letter exceeds the maximum allowed size.");
      }
    }

    if (errors.length > 0) {
      return apiError(400, "INVALID_PAYLOAD", "Invalid application payload.", {
        errors,
      });
    }

    const jobResult = await supabaseGet<JobOfferRow[]>(
      `job_offers?select=id,company_id,title,status&id=eq.${jobOfferId}&status=eq.published&limit=1`
    );

    const job = jobResult.data[0];
    if (!job) {
      return apiError(404, "JOB_NOT_FOUND", "Published job offer was not found.");
    }

    const companyResult = await supabaseGet<CompanyRow[]>(
      `companies?select=id,name,email&id=eq.${job.company_id}&limit=1`
    );

    const company = companyResult.data[0] ?? null;

    const applicationId = crypto.randomUUID();
    const cvFile = cv as File;
    const sanitizedFileName = sanitizeFileName(cvFile.name);

    const bucket = process.env.SUPABASE_STORAGE_CV_BUCKET || "candidate-cv";
    const storagePath = `company/${job.company_id}/applications/${applicationId}/${sanitizedFileName}`;

    const fileBytes = await cvFile.arrayBuffer();
    await uploadToSupabaseStorage(bucket, storagePath, fileBytes, cvFile.type);

    let normalizedCoverLetter: string | null = coverLetter || null;

    if (motivationLetter instanceof File) {
      const motivationFileName = sanitizeFileName(motivationLetter.name);
      const motivationStoragePath =
        `company/${job.company_id}/applications/${applicationId}/` +
        `motivation-letter-${motivationFileName}`;

      const motivationBytes = await motivationLetter.arrayBuffer();
      await uploadToSupabaseStorage(
        bucket,
        motivationStoragePath,
        motivationBytes,
        motivationLetter.type
      );

      const motivationReference = `[motivation_letter_file] ${motivationStoragePath}`;
      normalizedCoverLetter = normalizedCoverLetter
        ? `${normalizedCoverLetter}\n\n${motivationReference}`
        : motivationReference;
    }

    const insertBody = {
      id: applicationId,
      job_offer_id: jobOfferId,
      company_id: job.company_id,
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      candidate_phone: candidatePhone || null,
      cover_letter: normalizedCoverLetter,
      cv_path: storagePath,
      cv_file_name: sanitizedFileName,
      status: "pending",
    };

    const insertResult = await supabasePost<ApplicationInsertRow[]>(
      "applications?select=id,job_offer_id,company_id,candidate_name,candidate_email,status,created_at",
      insertBody
    );

    const application = insertResult.data[0];
    if (!application) {
      return apiError(500, "CREATE_FAILED", "Failed to create application.");
    }

    await sendApplicationEmails({
      applicationId: application.id,
      candidateName,
      candidateEmail,
      companyName: company?.name ?? null,
      companyEmail: company?.email ?? null,
      jobTitle: job.title,
    });

    return apiSuccess(
      {
        ...application,
        receipt_url: `/api/applications/${application.id}/receipt`,
      },
      undefined,
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
