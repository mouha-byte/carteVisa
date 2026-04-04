import {
  isEntrepriseRoleActor,
  requireAuthenticatedActor,
} from "@/lib/server/auth";
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonRequestBody,
} from "@/lib/server/api-response";
import { supabasePatch, supabasePost } from "@/lib/server/supabase-rest";

type CompanyRow = {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  sector: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  logo_url: string | null;
  cover_url: string | null;
  status: string;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

type CompanyWriteData = {
  name?: string;
  slug?: string;
  sector?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
};

const COMPANY_SELECT =
  "id,owner_user_id,name,slug,sector,description,address,city,country,phone,email,website_url,logo_url,cover_url,status,is_featured,created_at,updated_at";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseOptionalText(
  body: Record<string, unknown>,
  key: keyof CompanyWriteData,
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

function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseCompanyPayload(
  body: unknown,
  mode: "create" | "update"
): { data: Partial<CompanyWriteData>; errors: string[] } {
  if (!isRecord(body)) {
    return {
      data: {},
      errors: ["Request body must be a JSON object."],
    };
  }

  const data: Partial<CompanyWriteData> = {};
  const errors: string[] = [];

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

  const sector = parseOptionalText(body, "sector", 120, errors);
  if (sector !== undefined) {
    data.sector = sector;
  }

  const description = parseOptionalText(body, "description", 5000, errors);
  if (description !== undefined) {
    data.description = description;
  }

  const address = parseOptionalText(body, "address", 250, errors);
  if (address !== undefined) {
    data.address = address;
  }

  const city = parseOptionalText(body, "city", 120, errors);
  if (city !== undefined) {
    data.city = city;
  }

  const country = parseOptionalText(body, "country", 120, errors);
  if (country !== undefined) {
    data.country = country;
  }

  const phone = parseOptionalText(body, "phone", 40, errors);
  if (phone !== undefined) {
    data.phone = phone;
  }

  const email = parseOptionalText(body, "email", 320, errors);
  if (email !== undefined) {
    if (email !== null && !isValidEmail(email)) {
      errors.push("email must be a valid email address.");
    } else {
      data.email = email;
    }
  }

  const websiteUrl = parseOptionalText(body, "website_url", 2000, errors);
  if (websiteUrl !== undefined) {
    if (websiteUrl !== null && !isValidHttpUrl(websiteUrl)) {
      errors.push("website_url must be a valid http/https URL.");
    } else {
      data.website_url = websiteUrl;
    }
  }

  const logoUrl = parseOptionalText(body, "logo_url", 2000, errors);
  if (logoUrl !== undefined) {
    if (logoUrl !== null && !isValidHttpUrl(logoUrl)) {
      errors.push("logo_url must be a valid http/https URL.");
    } else {
      data.logo_url = logoUrl;
    }
  }

  const coverUrl = parseOptionalText(body, "cover_url", 2000, errors);
  if (coverUrl !== undefined) {
    if (coverUrl !== null && !isValidHttpUrl(coverUrl)) {
      errors.push("cover_url must be a valid http/https URL.");
    } else {
      data.cover_url = coverUrl;
    }
  }

  if (mode === "create") {
    if (!data.name) {
      errors.push("name is required.");
    }
    if (!data.slug) {
      errors.push("slug is required.");
    }
  }

  return { data, errors };
}

export async function POST(request: Request) {
  try {
    const actorOrResponse = await requireAuthenticatedActor(request);
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }
    const actor = actorOrResponse;

    if (!isEntrepriseRoleActor(actor)) {
      return apiError(
        403,
        "FORBIDDEN",
        "Only entreprise accounts can create a company profile."
      );
    }

    if (actor.companyId) {
      return apiError(
        409,
        "COMPANY_EXISTS",
        "Company profile already exists. Use PATCH to update it."
      );
    }

    const parsedBody = await parseJsonRequestBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const payload = parseCompanyPayload(parsedBody.data, "create");
    if (payload.errors.length > 0) {
      return apiError(400, "INVALID_PAYLOAD", "Invalid company profile data.", {
        errors: payload.errors,
      });
    }

    const createBody = {
      owner_user_id: actor.userId,
      status: "pending",
      is_featured: false,
      ...payload.data,
    };

    const createResult = await supabasePost<CompanyRow[]>(
      `companies?select=${COMPANY_SELECT}`,
      createBody
    );

    const company = createResult.data[0];
    if (!company) {
      return apiError(500, "CREATE_FAILED", "Failed to create company profile.");
    }

    await supabasePatch<null>(`profiles?id=eq.${actor.userId}`, {
      company_id: company.id,
    }, {
      prefer: "return=minimal",
    });

    return apiSuccess(company, undefined, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actorOrResponse = await requireAuthenticatedActor(request);
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }
    const actor = actorOrResponse;

    if (!isEntrepriseRoleActor(actor)) {
      return apiError(
        403,
        "FORBIDDEN",
        "Only entreprise accounts can update a company profile."
      );
    }

    if (!actor.companyId) {
      return apiError(404, "NOT_FOUND", "No company profile linked to this account.");
    }

    const parsedBody = await parseJsonRequestBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const payload = parseCompanyPayload(parsedBody.data, "update");
    if (payload.errors.length > 0) {
      return apiError(400, "INVALID_PAYLOAD", "Invalid company profile data.", {
        errors: payload.errors,
      });
    }

    if (Object.keys(payload.data).length === 0) {
      return apiError(400, "INVALID_PAYLOAD", "No fields to update.");
    }

    const updateResult = await supabasePatch<CompanyRow[]>(
      `companies?id=eq.${actor.companyId}&select=${COMPANY_SELECT}`,
      payload.data
    );

    const company = updateResult.data[0];
    if (!company) {
      return apiError(404, "NOT_FOUND", "Company profile not found.");
    }

    return apiSuccess(company);
  } catch (error) {
    return handleApiError(error);
  }
}
