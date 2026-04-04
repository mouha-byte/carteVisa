type ApiMeta = Record<string, unknown>;

type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

const STATUS_ERROR_CODE_MAP: Record<number, string> = {
  400: "INVALID_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "INVALID_PAYLOAD",
  429: "RATE_LIMITED",
};

function getErrorCodeFromStatus(status: number): string {
  if (status >= 500) {
    return "UPSTREAM_ERROR";
  }

  return STATUS_ERROR_CODE_MAP[status] ?? "UPSTREAM_ERROR";
}

export function apiSuccess<T>(
  data: T,
  meta?: ApiMeta,
  init?: ResponseInit
): Response {
  const body = meta
    ? { success: true as const, data, meta }
    : { success: true as const, data };

  return Response.json(body, {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  const error: ApiErrorPayload = details
    ? { code, message, details }
    : { code, message };

  return Response.json(
    {
      success: false as const,
      error,
    },
    { status }
  );
}

export function apiErrorFromStatus(
  status: number,
  message: string,
  details?: unknown
): Response {
  return apiError(status, getErrorCodeFromStatus(status), message, details);
}

export async function parseJsonRequestBody<T = unknown>(
  request: Request
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  try {
    const data = (await request.json()) as T;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: apiError(400, "INVALID_JSON", "Request body must be valid JSON."),
    };
  }
}

export function handleApiError(error: unknown): Response {
  if (error instanceof Error) {
    const maybeErrorWithStatus = error as Error & { status?: number };

    if (
      typeof maybeErrorWithStatus.status === "number" &&
      maybeErrorWithStatus.status >= 400 &&
      maybeErrorWithStatus.status < 600
    ) {
      return apiErrorFromStatus(
        maybeErrorWithStatus.status,
        maybeErrorWithStatus.message
      );
    }

    return apiError(500, "INTERNAL_ERROR", error.message);
  }

  return apiError(500, "INTERNAL_ERROR", "Unexpected server error.");
}
