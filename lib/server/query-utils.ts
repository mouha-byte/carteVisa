export function parsePageParam(value: string | null, fallback = 1): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export function parseLimitParam(
  value: string | null,
  fallback = 12,
  max = 50
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
}

export function parseSortParam<T extends string>(
  value: string | null,
  allowedValues: readonly T[],
  fallback: T
): T {
  if (!value) {
    return fallback;
  }

  const match = allowedValues.find((item) => item === value);
  return match ?? fallback;
}

export function cleanSearchTerm(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value
    .trim()
    .replace(/[,*()"']/g, " ")
    .replace(/\s+/g, " ");

  if (!cleaned) {
    return null;
  }

  return cleaned;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
