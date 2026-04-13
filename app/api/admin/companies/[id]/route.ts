import { requireSuperAdminActor } from "@/lib/server/auth";
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonRequestBody,
} from "@/lib/server/api-response";
import { isUuid } from "@/lib/server/query-utils";
import { supabaseDelete, supabaseGet, supabasePatch } from "@/lib/server/supabase-rest";

type CompanyStatus = "pending" | "active" | "inactive" | "rejected";
type CompanyLegalType = "sarl" | "startup";

type CompanyRow = {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  company_type: CompanyLegalType;
  sector: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  status: CompanyStatus;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

type CompanyPatchPayload = {
  owner_user_id?: string;
  name?: string;
  slug?: string;
  company_type?: CompanyLegalType;
  sector?: string | null;
  description?: string | null;
  city?: string | null;
  country?: string | null;
  status?: CompanyStatus;
  is_featured?: boolean;
};

const COMPANY_SELECT =
  "id,owner_user_id,name,slug,company_type,sector,description,city,country,status,is_featured,created_at,updated_at";

const COMPANY_STATUSES: readonly CompanyStatus[] = [
  "pending",
  "active",
  "inactive",
  "rejected",
] as const;

const COMPANY_TYPES: readonly CompanyLegalType[] = ["sarl", "startup"] as const;

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function parseOptionalText(
  body: Record<string, unknown>,
  key: keyof CompanyPatchPayload,
  maxLength: number,
  errors: string[]
): string | null | undefined {
  if (!(key in body)) {
    return undefined;
  }

  const raw = body[key];
  if (raw === null) {
    return null;
  }

  if (typeof raw !== "string") {
    errors.push(`${String(key)} must be a string or null.`);
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    errors.push(`${String(key)} must be at most ${maxLength} characters.`);
    return undefined;
  }

  return trimmed;
}

function parseCompanyPatchPayload(body: unknown): {
  data: Partial<CompanyPatchPayload>;
  errors: string[];
} {
  if (!isRecord(body)) {
    return {
      data: {},
      errors: ["Request body must be a JSON object."],
    };
  }

  const data: Partial<CompanyPatchPayload> = {};
  const errors: string[] = [];

  const ownerUserId = parseOptionalText(body, "owner_user_id", 36, errors);
  if (ownerUserId !== undefined) {
    if (ownerUserId === null || !isUuid(ownerUserId)) {
      errors.push("owner_user_id must be a valid UUID.");
    } else {
      data.owner_user_id = ownerUserId;
    }
  }

  const name = parseOptionalText(body, "name", 120, errors);
  if (name !== undefined) {
    if (name === null || name.length < 2) {
      errors.push("name must be at least 2 characters.");
    } else {
      data.name = name;
    }
  }

  const slug = parseOptionalText(body, "slug", 120, errors);
  if (slug !== undefined) {
    if (slug === null || !isValidSlug(slug)) {
      errors.push(
        "slug must only contain lowercase letters, numbers, and hyphens."
      );
    } else {
      data.slug = slug;
    }
  }

  if ("company_type" in body) {
    const rawType = body.company_type;
    if (
      typeof rawType !== "string" ||
      !COMPANY_TYPES.includes(rawType as CompanyLegalType)
    ) {
      errors.push("company_type must be one of: sarl, startup.");
    } else {
      data.company_type = rawType as CompanyLegalType;
    }
  }

  const sector = parseOptionalText(body, "sector", 120, errors);
  if (sector !== undefined) {
    data.sector = sector;
  }

  const description = parseOptionalText(body, "description", 5000, errors);
  if (description !== undefined) {
    data.description = description;
  }

  const city = parseOptionalText(body, "city", 120, errors);
  if (city !== undefined) {
    data.city = city;
  }

  const country = parseOptionalText(body, "country", 120, errors);
  if (country !== undefined) {
    data.country = country;
  }

  if ("status" in body) {
    const rawStatus = body.status;
    if (
      typeof rawStatus !== "string" ||
      !COMPANY_STATUSES.includes(rawStatus as CompanyStatus)
    ) {
      errors.push("status must be one of: pending, active, inactive, rejected.");
    } else {
      data.status = rawStatus as CompanyStatus;
    }
  }

  if ("is_featured" in body) {
    if (typeof body.is_featured !== "boolean") {
      errors.push("is_featured must be a boolean.");
    } else {
      data.is_featured = body.is_featured;
    }
  }

  return { data, errors };
}

async function getCompanyById(id: string): Promise<CompanyRow | null> {
  const result = await supabaseGet<CompanyRow[]>(
    `companies?select=${COMPANY_SELECT}&id=eq.${id}&limit=1`
  );

  return result.data[0] ?? null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actorOrResponse = await requireSuperAdminActor(
      request,
      "Only super admin accounts can update companies."
    );
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }

    const { id } = await context.params;
    if (!isUuid(id)) {
      return apiError(400, "INVALID_ID", "Company id must be a valid UUID.");
    }

    const existingCompany = await getCompanyById(id);
    if (!existingCompany) {
      return apiError(404, "NOT_FOUND", "Company not found.");
    }

    const parsedBody = await parseJsonRequestBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const payload = parseCompanyPatchPayload(parsedBody.data);
    if (payload.errors.length > 0) {
      return apiError(400, "INVALID_PAYLOAD", "Invalid company payload.", {
        errors: payload.errors,
      });
    }

    if (Object.keys(payload.data).length === 0) {
      return apiError(400, "INVALID_PAYLOAD", "No fields to update.");
    }

    const result = await supabasePatch<CompanyRow[]>(
      `companies?id=eq.${id}&select=${COMPANY_SELECT}`,
      payload.data
    );

    const updatedCompany = result.data[0];
    if (!updatedCompany) {
      return apiError(404, "NOT_FOUND", "Company not found.");
    }

    return apiSuccess(updatedCompany);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actorOrResponse = await requireSuperAdminActor(
      request,
      "Only super admin accounts can delete companies."
    );
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }

    const { id } = await context.params;
    if (!isUuid(id)) {
      return apiError(400, "INVALID_ID", "Company id must be a valid UUID.");
    }

    const existingCompany = await getCompanyById(id);
    if (!existingCompany) {
      return apiError(404, "NOT_FOUND", "Company not found.");
    }

    await supabaseDelete<null>(`companies?id=eq.${id}`, {
      prefer: "return=minimal",
    });

    return apiSuccess({
      id,
      deleted: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}