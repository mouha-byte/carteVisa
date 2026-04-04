export const JOB_STATUSES = ["draft", "published", "closed"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobWriteData = {
  title?: string;
  description?: string;
  contract_type?: string | null;
  location_city?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  is_remote?: boolean;
  status?: JobStatus;
};

type ParseResult = {
  data: Partial<JobWriteData>;
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseOptionalText(
  body: Record<string, unknown>,
  key: string,
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
    errors.push(`${key} must be a string or null.`);
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    errors.push(`${key} must be at most ${maxLength} characters.`);
    return undefined;
  }

  return trimmed;
}

function parseOptionalNonNegativeNumber(
  body: Record<string, unknown>,
  key: "salary_min" | "salary_max",
  errors: string[]
): number | null | undefined {
  if (!(key in body)) {
    return undefined;
  }

  const raw = body[key];
  if (raw === null) {
    return null;
  }

  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    errors.push(`${key} must be a number or null.`);
    return undefined;
  }

  if (raw < 0) {
    errors.push(`${key} must be greater than or equal to 0.`);
    return undefined;
  }

  return raw;
}

export function parseJobPayload(
  body: unknown,
  mode: "create" | "update"
): ParseResult {
  if (!isRecord(body)) {
    return {
      data: {},
      errors: ["Request body must be a JSON object."],
    };
  }

  const data: Partial<JobWriteData> = {};
  const errors: string[] = [];

  const title = parseOptionalText(body, "title", 160, errors);
  if (title !== undefined) {
    if (title === null || title.length < 3) {
      errors.push("title must be at least 3 characters.");
    } else {
      data.title = title;
    }
  }

  const description = parseOptionalText(body, "description", 8000, errors);
  if (description !== undefined) {
    if (description === null || description.length < 20) {
      errors.push("description must be at least 20 characters.");
    } else {
      data.description = description;
    }
  }

  const contractType = parseOptionalText(body, "contract_type", 50, errors);
  if (contractType !== undefined) {
    data.contract_type = contractType;
  }

  const locationCity = parseOptionalText(body, "location_city", 120, errors);
  if (locationCity !== undefined) {
    data.location_city = locationCity;
  }

  const salaryMin = parseOptionalNonNegativeNumber(body, "salary_min", errors);
  if (salaryMin !== undefined) {
    data.salary_min = salaryMin;
  }

  const salaryMax = parseOptionalNonNegativeNumber(body, "salary_max", errors);
  if (salaryMax !== undefined) {
    data.salary_max = salaryMax;
  }

  if ("is_remote" in body) {
    if (typeof body.is_remote !== "boolean") {
      errors.push("is_remote must be a boolean.");
    } else {
      data.is_remote = body.is_remote;
    }
  }

  if ("status" in body) {
    const rawStatus = body.status;
    if (
      typeof rawStatus !== "string" ||
      !JOB_STATUSES.includes(rawStatus as JobStatus)
    ) {
      errors.push("status must be one of: draft, published, closed.");
    } else {
      data.status = rawStatus as JobStatus;
    }
  }

  if (mode === "create") {
    if (!data.title) {
      errors.push("title is required.");
    }
    if (!data.description) {
      errors.push("description is required.");
    }
  }

  if (
    data.salary_min !== undefined &&
    data.salary_max !== undefined &&
    data.salary_min !== null &&
    data.salary_max !== null &&
    data.salary_min > data.salary_max
  ) {
    errors.push("salary_min must be lower than or equal to salary_max.");
  }

  return { data, errors };
}
