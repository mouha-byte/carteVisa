import { requireSuperAdminActor } from "@/lib/server/auth";
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonRequestBody,
} from "@/lib/server/api-response";
import {
  cleanSearchTerm,
  isUuid,
  parseLimitParam,
  parsePageParam,
  parseSortParam,
} from "@/lib/server/query-utils";
import { supabaseGet, supabasePost } from "@/lib/server/supabase-rest";

type CompanyStatus = "pending" | "active" | "inactive" | "rejected";

type CompanyRow = {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  sector: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  status: CompanyStatus;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

type CompanyCreatePayload = {
  owner_user_id?: string;
  name?: string;
  slug?: string;
  sector?: string | null;
  description?: string | null;
  city?: string | null;
  country?: string | null;
  status?: CompanyStatus;
  is_featured?: boolean;
};

const COMPANY_SELECT =
  "id,owner_user_id,name,slug,sector,description,city,country,status,is_featured,created_at,updated_at";

const ALLOWED_SORTS = ["newest", "oldest", "name_asc", "name_desc"] as const;
const SORT_TO_DB_ORDER: Record<(typeof ALLOWED_SORTS)[number], string> = {
  newest: "created_at.desc",
  oldest: "created_at.asc",
  name_asc: "name.asc",
  name_desc: "name.desc",
};

const COMPANY_STATUSES: readonly CompanyStatus[] = [
  "pending",
  "active",
  "inactive",
  "rejected",
] as const;

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function parseOptionalText(
  body: Record<string, unknown>,
  key: keyof CompanyCreatePayload,
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

function parseCompanyCreatePayload(body: unknown): {
  data: Partial<CompanyCreatePayload>;
  errors: string[];
} {
  if (!isRecord(body)) {
    return {
      data: {},
      errors: ["Request body must be a JSON object."],
    };
  }

  const data: Partial<CompanyCreatePayload> = {};
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

  if (!data.owner_user_id) {
    errors.push("owner_user_id is required.");
  }
  if (!data.name) {
    errors.push("name is required.");
  }
  if (!data.slug) {
    errors.push("slug is required.");
  }

  return { data, errors };
}

export async function GET(request: Request) {
  try {
    const actorOrResponse = await requireSuperAdminActor(
      request,
      "Only super admin accounts can access companies admin endpoints."
    );
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }

    const { searchParams } = new URL(request.url);
    const page = parsePageParam(searchParams.get("page"), 1);
    const limit = parseLimitParam(searchParams.get("limit"), 20, 100);
    const sort = parseSortParam(searchParams.get("sort"), ALLOWED_SORTS, "newest");
    const statusFilter = searchParams.get("status");
    const cityFilter = cleanSearchTerm(searchParams.get("city"));
    const search = cleanSearchTerm(searchParams.get("q"));

    if (
      statusFilter !== null &&
      !COMPANY_STATUSES.includes(statusFilter as CompanyStatus)
    ) {
      return apiError(
        400,
        "INVALID_STATUS",
        "status must be one of: pending, active, inactive, rejected."
      );
    }

    const offset = (page - 1) * limit;

    const params = new URLSearchParams({
      select: COMPANY_SELECT,
      order: SORT_TO_DB_ORDER[sort],
      limit: String(limit),
      offset: String(offset),
    });

    if (statusFilter) {
      params.append("status", `eq.${statusFilter}`);
    }

    if (cityFilter) {
      params.append("city", `ilike.*${cityFilter}*`);
    }

    if (search) {
      params.append(
        "or",
        `(name.ilike.*${search}*,slug.ilike.*${search}*,sector.ilike.*${search}*)`
      );
    }

    const result = await supabaseGet<CompanyRow[]>(`companies?${params.toString()}`, {
      count: true,
    });

    const total = result.count ?? result.data.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return apiSuccess(result.data, {
      page,
      limit,
      total,
      totalPages,
      sort,
      status: statusFilter,
      city: cityFilter,
      q: search,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actorOrResponse = await requireSuperAdminActor(
      request,
      "Only super admin accounts can create companies."
    );
    if (actorOrResponse instanceof Response) {
      return actorOrResponse;
    }

    const parsedBody = await parseJsonRequestBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const payload = parseCompanyCreatePayload(parsedBody.data);
    if (payload.errors.length > 0) {
      return apiError(400, "INVALID_PAYLOAD", "Invalid company payload.", {
        errors: payload.errors,
      });
    }

    const createBody = {
      owner_user_id: payload.data.owner_user_id,
      name: payload.data.name,
      slug: payload.data.slug,
      sector: payload.data.sector ?? null,
      description: payload.data.description ?? null,
      city: payload.data.city ?? null,
      country: payload.data.country ?? null,
      status: payload.data.status ?? "pending",
      is_featured: payload.data.is_featured ?? false,
    };

    const result = await supabasePost<CompanyRow[]>(
      `companies?select=${COMPANY_SELECT}`,
      createBody
    );

    const createdCompany = result.data[0];
    if (!createdCompany) {
      return apiError(500, "CREATE_FAILED", "Failed to create company.");
    }

    return apiSuccess(createdCompany, undefined, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}