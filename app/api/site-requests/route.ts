import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonRequestBody,
} from "@/lib/server/api-response";
import { applyRateLimit } from "@/lib/server/rate-limit";
import { supabasePost } from "@/lib/server/supabase-rest";
import { sendSiteRequestAdminNotification } from "@/lib/server/transactional-email";

type SiteRequestInsertRow = {
  id: string;
  company_name: string;
  sector: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  needs: string;
  status: "new" | "in_progress" | "closed";
  created_at: string;
  updated_at: string;
};

type SiteRequestPayload = {
  companyName: string;
  sector: string | null;
  contactName: string;
  email: string;
  phone: string | null;
  needs: string;
};

const SITE_REQUEST_RATE_LIMIT = {
  keyPrefix: "site-request",
  limit: 5,
  windowMs: 60_000,
};

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readTrimmedString(
  body: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    if (!(key in body)) {
      continue;
    }

    const value = body[key];
    if (typeof value !== "string") {
      return null;
    }

    return value.trim();
  }

  return null;
}

function parseSiteRequestPayload(body: unknown): {
  data?: SiteRequestPayload;
  errors: string[];
} {
  if (!isRecord(body)) {
    return {
      errors: ["Request body must be a JSON object."],
    };
  }

  const errors: string[] = [];

  const companyName = readTrimmedString(body, ["company_name", "companyName"]);
  if (!companyName || companyName.length < 2 || companyName.length > 160) {
    errors.push("company_name must be between 2 and 160 characters.");
  }

  const contactName = readTrimmedString(body, ["contact_name", "contactName"]);
  if (!contactName || contactName.length < 2 || contactName.length > 120) {
    errors.push("contact_name must be between 2 and 120 characters.");
  }

  const email = readTrimmedString(body, ["email"]);
  if (!email || !isValidEmail(email)) {
    errors.push("email must be a valid email address.");
  }

  const needs = readTrimmedString(body, ["needs"]);
  if (!needs || needs.length < 10 || needs.length > 5000) {
    errors.push("needs must be between 10 and 5000 characters.");
  }

  let sector: string | null = null;
  if ("sector" in body) {
    const sectorValue = readTrimmedString(body, ["sector"]);
    if (sectorValue === null) {
      errors.push("sector must be a string when provided.");
    } else if (sectorValue.length > 120) {
      errors.push("sector must be at most 120 characters.");
    } else {
      sector = sectorValue || null;
    }
  }

  let phone: string | null = null;
  if ("phone" in body || "phone_number" in body || "phoneNumber" in body) {
    const phoneValue = readTrimmedString(body, [
      "phone",
      "phone_number",
      "phoneNumber",
    ]);

    if (phoneValue === null) {
      errors.push("phone must be a string when provided.");
    } else if (phoneValue.length > 40) {
      errors.push("phone must be at most 40 characters.");
    } else {
      phone = phoneValue || null;
    }
  }

  if (errors.length > 0 || !companyName || !contactName || !email || !needs) {
    return { errors };
  }

  return {
    data: {
      companyName,
      sector,
      contactName,
      email,
      phone,
      needs,
    },
    errors,
  };
}

export async function POST(request: Request) {
  try {
    const rateLimit = applyRateLimit(request, SITE_REQUEST_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return apiError(
        429,
        "RATE_LIMITED",
        "Too many site requests. Please try again later.",
        {
          retry_after_seconds: rateLimit.retryAfterSeconds,
        }
      );
    }

    const parsedBody = await parseJsonRequestBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const payload = parseSiteRequestPayload(parsedBody.data);
    if (payload.errors.length > 0 || !payload.data) {
      return apiError(400, "INVALID_PAYLOAD", "Invalid site request payload.", {
        errors: payload.errors,
      });
    }

    const insertResult = await supabasePost<SiteRequestInsertRow[]>(
      "website_creation_requests?select=id,company_name,sector,contact_name,email,phone,needs,status,created_at,updated_at",
      {
        company_name: payload.data.companyName,
        sector: payload.data.sector,
        contact_name: payload.data.contactName,
        email: payload.data.email,
        phone: payload.data.phone,
        needs: payload.data.needs,
        status: "new",
      }
    );

    const siteRequest = insertResult.data[0];
    if (!siteRequest) {
      return apiError(
        500,
        "CREATE_FAILED",
        "Failed to create site request."
      );
    }

    await sendSiteRequestAdminNotification({
      siteRequestId: siteRequest.id,
      companyName: siteRequest.company_name,
      contactName: siteRequest.contact_name,
      email: siteRequest.email,
      phone: siteRequest.phone,
      sector: siteRequest.sector,
      needs: siteRequest.needs,
    });

    return apiSuccess(siteRequest, undefined, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
