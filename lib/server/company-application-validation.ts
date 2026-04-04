export const APPLICATION_STATUSES = [
  "pending",
  "shortlisted",
  "rejected",
  "hired",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return APPLICATION_STATUSES.includes(value as ApplicationStatus);
}

export function parseApplicationStatusPayload(body: unknown): {
  status?: ApplicationStatus;
  errors: string[];
} {
  if (!isRecord(body)) {
    return {
      errors: ["Request body must be a JSON object."],
    };
  }

  if (!("status" in body)) {
    return {
      errors: ["status is required."],
    };
  }

  const rawStatus = body.status;
  if (typeof rawStatus !== "string" || !isApplicationStatus(rawStatus)) {
    return {
      errors: ["status must be one of: pending, shortlisted, rejected, hired."],
    };
  }

  return {
    status: rawStatus,
    errors: [],
  };
}
