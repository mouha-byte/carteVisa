import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonRequestBody,
} from "@/lib/server/api-response";
import { applyRateLimit } from "@/lib/server/rate-limit";
import { supabasePost } from "@/lib/server/supabase-rest";
import { sendContactAdminNotification } from "@/lib/server/transactional-email";

type ContactMessageInsertRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  message: string;
  is_handled: boolean;
  created_at: string;
};

type ContactPayload = {
  fullName: string;
  email: string;
  phone: string | null;
  message: string;
};

const CONTACT_RATE_LIMIT = {
  keyPrefix: "contact",
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

function parseContactPayload(body: unknown): {
  data?: ContactPayload;
  errors: string[];
} {
  if (!isRecord(body)) {
    return {
      errors: ["Request body must be a JSON object."],
    };
  }

  const errors: string[] = [];

  const fullName = readTrimmedString(body, ["full_name", "fullName"]);
  if (!fullName || fullName.length < 2 || fullName.length > 120) {
    errors.push("full_name must be between 2 and 120 characters.");
  }

  const email = readTrimmedString(body, ["email"]);
  if (!email || !isValidEmail(email)) {
    errors.push("email must be a valid email address.");
  }

  const message = readTrimmedString(body, ["message"]);
  if (!message || message.length < 10 || message.length > 5000) {
    errors.push("message must be between 10 and 5000 characters.");
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

  if (errors.length > 0 || !fullName || !email || !message) {
    return { errors };
  }

  return {
    data: {
      fullName,
      email,
      phone,
      message,
    },
    errors,
  };
}

export async function POST(request: Request) {
  try {
    const rateLimit = applyRateLimit(request, CONTACT_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return apiError(
        429,
        "RATE_LIMITED",
        "Too many contact submissions. Please try again later.",
        {
          retry_after_seconds: rateLimit.retryAfterSeconds,
        }
      );
    }

    const parsedBody = await parseJsonRequestBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const payload = parseContactPayload(parsedBody.data);
    if (payload.errors.length > 0 || !payload.data) {
      return apiError(400, "INVALID_PAYLOAD", "Invalid contact payload.", {
        errors: payload.errors,
      });
    }

    const insertResult = await supabasePost<ContactMessageInsertRow[]>(
      "contact_messages?select=id,full_name,email,phone,message,is_handled,created_at",
      {
        full_name: payload.data.fullName,
        email: payload.data.email,
        phone: payload.data.phone,
        message: payload.data.message,
      }
    );

    const contactMessage = insertResult.data[0];
    if (!contactMessage) {
      return apiError(
        500,
        "CREATE_FAILED",
        "Failed to create contact message."
      );
    }

    await sendContactAdminNotification({
      contactMessageId: contactMessage.id,
      fullName: contactMessage.full_name,
      email: contactMessage.email,
      phone: contactMessage.phone,
      message: contactMessage.message,
    });

    return apiSuccess(contactMessage, undefined, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
