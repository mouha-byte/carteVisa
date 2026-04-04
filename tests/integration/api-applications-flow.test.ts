import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as applicationsPOST } from "@/app/api/applications/route";
import { GET as applicationReceiptGET } from "@/app/api/applications/[id]/receipt/route";

const APPLICATION_ID = "99999999-9999-4999-8999-999999999999";
const JOB_ID = "88888888-8888-4888-8888-888888888888";
const COMPANY_ID = "77777777-7777-4777-8777-777777777777";

function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> }
) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

describe("Sprint 3 application flow APIs", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.SUPABASE_STORAGE_CV_BUCKET = "candidate-cv";
    process.env.CV_MAX_SIZE_MB = "8";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "no-reply@example.com";
    process.env.RESEND_REPLY_TO_EMAIL = "support@example.com";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /api/applications rejects non-multipart content type", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await applicationsPOST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_CONTENT_TYPE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST /api/applications validates CV MIME type", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const form = new FormData();
    form.append("job_offer_id", JOB_ID);
    form.append("candidate_name", "Candidate Demo");
    form.append("candidate_email", "candidate.demo@cartevisite.app");
    form.append("cv", new File(["hello"], "demo.txt", { type: "text/plain" }));

    const response = await applicationsPOST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        body: form,
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_PAYLOAD");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST /api/applications uploads CV and creates application", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(APPLICATION_ID);

    let emailEventInsertCount = 0;
    let resendSendCount = 0;

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/rest/v1/job_offers?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: JOB_ID,
              company_id: COMPANY_ID,
              title: "Developpeur Full Stack",
              status: "published",
            },
          ])
        );
      }

      if (url.includes("/rest/v1/companies?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: COMPANY_ID,
              name: "Atlas Tech SARL",
              email: "jobs@atlastest.ma",
            },
          ])
        );
      }

      if (url.includes("/storage/v1/object/candidate-cv/")) {
        expect(init?.method).toBe("POST");
        return Promise.resolve(new Response(null, { status: 200 }));
      }

      if (url.includes("/rest/v1/applications?") && init?.method === "POST") {
        const payload = JSON.parse(String(init?.body)) as {
          id: string;
          status: string;
          cv_path: string;
        };

        expect(payload.id).toBe(APPLICATION_ID);
        expect(payload.status).toBe("pending");
        expect(payload.cv_path).toContain(`/applications/${APPLICATION_ID}/`);

        return Promise.resolve(
          jsonResponse(
            [
              {
                id: APPLICATION_ID,
                job_offer_id: JOB_ID,
                company_id: COMPANY_ID,
                candidate_name: "Candidate Demo",
                candidate_email: "candidate.demo@cartevisite.app",
                status: "pending",
                created_at: "2026-04-12T10:00:00.000Z",
              },
            ],
            { status: 201 }
          )
        );
      }

      if (url.includes("/rest/v1/email_events?") && init?.method === "POST") {
        emailEventInsertCount += 1;

        const payload = JSON.parse(String(init?.body)) as {
          status: string;
          event_type: string;
        };
        expect(payload.status).toBe("queued");
        expect(payload.event_type).toContain("application_");

        return Promise.resolve(
          jsonResponse(
            [
              {
                id: `event-${emailEventInsertCount}`,
              },
            ],
            { status: 201 }
          )
        );
      }

      if (url.includes("https://api.resend.com/emails")) {
        resendSendCount += 1;
        return Promise.resolve(
          jsonResponse(
            {
              id: `re-msg-${resendSendCount}`,
            },
            { status: 200 }
          )
        );
      }

      if (url.includes("/rest/v1/email_events?") && init?.method === "PATCH") {
        const payload = JSON.parse(String(init?.body)) as {
          status: string;
          provider_message_id: string | null;
        };

        expect(payload.status).toBe("sent");
        expect(payload.provider_message_id).toMatch(/^re-msg-/);

        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const form = new FormData();
    form.append("job_offer_id", JOB_ID);
    form.append("candidate_name", "Candidate Demo");
    form.append("candidate_email", "candidate.demo@cartevisite.app");
    form.append("candidate_phone", "+212611111111");
    form.append("cover_letter", "I am interested in this role.");
    form.append(
      "cv",
      new File(["%PDF-1.4 demo"], "demo-cv.pdf", {
        type: "application/pdf",
      })
    );

    const response = await applicationsPOST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        body: form,
      })
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(APPLICATION_ID);
    expect(body.data.receipt_url).toBe(`/api/applications/${APPLICATION_ID}/receipt`);
    expect(emailEventInsertCount).toBe(2);
    expect(resendSendCount).toBe(2);
  });

  it("POST /api/applications still succeeds when Resend fails", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(APPLICATION_ID);

    const emailEventStatuses: string[] = [];

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/rest/v1/job_offers?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: JOB_ID,
              company_id: COMPANY_ID,
              title: "Developpeur Full Stack",
              status: "published",
            },
          ])
        );
      }

      if (url.includes("/rest/v1/companies?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: COMPANY_ID,
              name: "Atlas Tech SARL",
              email: "jobs@atlastest.ma",
            },
          ])
        );
      }

      if (url.includes("/storage/v1/object/candidate-cv/")) {
        return Promise.resolve(new Response(null, { status: 200 }));
      }

      if (url.includes("/rest/v1/applications?") && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            [
              {
                id: APPLICATION_ID,
                job_offer_id: JOB_ID,
                company_id: COMPANY_ID,
                candidate_name: "Candidate Demo",
                candidate_email: "candidate.demo@cartevisite.app",
                status: "pending",
                created_at: "2026-04-12T10:00:00.000Z",
              },
            ],
            { status: 201 }
          )
        );
      }

      if (url.includes("/rest/v1/email_events?") && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            [
              {
                id: `event-${Math.random()}`,
              },
            ],
            { status: 201 }
          )
        );
      }

      if (url.includes("https://api.resend.com/emails")) {
        return Promise.resolve(
          jsonResponse(
            {
              message: "Upstream resend failure",
            },
            { status: 500 }
          )
        );
      }

      if (url.includes("/rest/v1/email_events?") && init?.method === "PATCH") {
        const payload = JSON.parse(String(init?.body)) as {
          status: string;
        };
        emailEventStatuses.push(payload.status);
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const form = new FormData();
    form.append("job_offer_id", JOB_ID);
    form.append("candidate_name", "Candidate Demo");
    form.append("candidate_email", "candidate.demo@cartevisite.app");
    form.append(
      "cv",
      new File(["%PDF-1.4 demo"], "demo-cv.pdf", {
        type: "application/pdf",
      })
    );

    const response = await applicationsPOST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        body: form,
      })
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(emailEventStatuses).toContain("failed");
  });

  it("GET /api/applications/[id]/receipt returns receipt payload", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/rest/v1/applications?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: APPLICATION_ID,
              job_offer_id: JOB_ID,
              company_id: COMPANY_ID,
              candidate_name: "Candidate Demo",
              candidate_email: "candidate.demo@cartevisite.app",
              status: "pending",
              created_at: "2026-04-12T10:00:00.000Z",
            },
          ])
        );
      }

      if (url.includes("/rest/v1/job_offers?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: JOB_ID,
              title: "Developpeur Full Stack",
              contract_type: "CDI",
              location_city: "Casablanca",
            },
          ])
        );
      }

      if (url.includes("/rest/v1/companies?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: COMPANY_ID,
              name: "Atlas Tech SARL",
              slug: "atlas-tech",
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await applicationReceiptGET(new Request("http://localhost"), {
      params: Promise.resolve({ id: APPLICATION_ID }),
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(APPLICATION_ID);
    expect(body.data.job?.id).toBe(JOB_ID);
    expect(body.data.company?.slug).toBe("atlas-tech");
  });

  it("GET /api/applications/[id]/receipt returns 400 on invalid id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await applicationReceiptGET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "invalid-id" }),
    });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_ID");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
