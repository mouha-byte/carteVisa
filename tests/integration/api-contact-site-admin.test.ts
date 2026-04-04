import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as adminContactMessagesGET } from "@/app/api/admin/contact-messages/route";
import { GET as adminSiteRequestsGET } from "@/app/api/admin/site-requests/route";
import { POST as contactPOST } from "@/app/api/contact/route";
import { POST as siteRequestsPOST } from "@/app/api/site-requests/route";

const SUPER_ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTREPRISE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> }
) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

describe("Sprint 5 contact/site/admin APIs", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "no-reply@example.com";
    process.env.RESEND_REPLY_TO_EMAIL = "support@example.com";
    process.env.ADMIN_NOTIFICATION_EMAIL = "admin@example.com";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /api/contact validates payload before DB calls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await contactPOST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "198.51.100.10",
        },
        body: JSON.stringify({
          full_name: "A",
          email: "invalid-email",
          message: "short",
        }),
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_PAYLOAD");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST /api/contact creates message and sends admin notification", async () => {
    let emailEventInsertCount = 0;
    let resendSendCount = 0;

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/rest/v1/contact_messages?") && init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as {
          full_name: string;
          email: string;
        };

        expect(payload.full_name).toBe("Seed Contact");
        expect(payload.email).toBe("seed.contact@cartevisite.app");

        return Promise.resolve(
          jsonResponse(
            [
              {
                id: "contact-1",
                full_name: "Seed Contact",
                email: "seed.contact@cartevisite.app",
                phone: "+212622222222",
                message: "Hello from the contact form for sprint 5 tests.",
                is_handled: false,
                created_at: "2026-04-12T12:00:00.000Z",
              },
            ],
            { status: 201 }
          )
        );
      }

      if (url.includes("/rest/v1/email_events?") && init?.method === "POST") {
        emailEventInsertCount += 1;
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
        const payload = JSON.parse(String(init.body)) as {
          status: string;
          provider_message_id: string;
        };

        expect(payload.status).toBe("sent");
        expect(payload.provider_message_id).toMatch(/^re-msg-/);

        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await contactPOST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "198.51.100.11",
        },
        body: JSON.stringify({
          full_name: "Seed Contact",
          email: "seed.contact@cartevisite.app",
          phone: "+212622222222",
          message: "Hello from the contact form for sprint 5 tests.",
        }),
      })
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("contact-1");
    expect(emailEventInsertCount).toBe(1);
    expect(resendSendCount).toBe(1);
  });

  it("POST /api/site-requests still succeeds when Resend fails", async () => {
    const emailStatuses: string[] = [];

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (
        url.includes("/rest/v1/website_creation_requests?") &&
        init?.method === "POST"
      ) {
        return Promise.resolve(
          jsonResponse(
            [
              {
                id: "site-request-1",
                company_name: "Seed Retail Company",
                sector: "Commerce",
                contact_name: "Seed Request",
                email: "seed.request@cartevisite.app",
                phone: "+212633333333",
                needs: "Need a website with pages and contact form.",
                status: "new",
                created_at: "2026-04-12T12:00:00.000Z",
                updated_at: "2026-04-12T12:00:00.000Z",
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
                id: "event-site-1",
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
              message: "Resend upstream failure",
            },
            { status: 500 }
          )
        );
      }

      if (url.includes("/rest/v1/email_events?") && init?.method === "PATCH") {
        const payload = JSON.parse(String(init.body)) as { status: string };
        emailStatuses.push(payload.status);
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await siteRequestsPOST(
      new Request("http://localhost/api/site-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "198.51.100.12",
        },
        body: JSON.stringify({
          company_name: "Seed Retail Company",
          sector: "Commerce",
          contact_name: "Seed Request",
          email: "seed.request@cartevisite.app",
          phone: "+212633333333",
          needs: "Need a website with pages and contact form.",
        }),
      })
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("site-request-1");
    expect(emailStatuses).toContain("failed");
  });

  it("GET /api/admin/contact-messages requires authentication", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await adminContactMessagesGET(
      new Request("http://localhost/api/admin/contact-messages")
    );

    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GET /api/admin/contact-messages blocks non-admin actors", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: ENTREPRISE_ID }));
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: ENTREPRISE_ID,
              role: "entreprise",
              company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await adminContactMessagesGET(
      new Request("http://localhost/api/admin/contact-messages", {
        headers: {
          Authorization: "Bearer entreprise-token",
        },
      })
    );

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("GET /api/admin/contact-messages returns paginated messages for super admin", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: SUPER_ADMIN_ID }));
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: SUPER_ADMIN_ID,
              role: "super_admin",
              company_id: null,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/contact_messages?")) {
        return Promise.resolve(
          jsonResponse(
            [
              {
                id: "contact-1",
                full_name: "Seed Contact",
                email: "seed.contact@cartevisite.app",
                phone: "+212622222222",
                message: "Hello from contact.",
                is_handled: false,
                handled_by: null,
                handled_at: null,
                created_at: "2026-04-12T12:00:00.000Z",
              },
            ],
            {
              headers: {
                "content-range": "0-0/1",
              },
            }
          )
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await adminContactMessagesGET(
      new Request(
        "http://localhost/api/admin/contact-messages?page=1&limit=10&sort=newest&handled=false",
        {
          headers: {
            Authorization: "Bearer super-admin-token",
          },
        }
      )
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.meta.total).toBe(1);
    expect(body.data[0].id).toBe("contact-1");
  });

  it("GET /api/admin/site-requests validates status filter", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: SUPER_ADMIN_ID }));
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: SUPER_ADMIN_ID,
              role: "super_admin",
              company_id: null,
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await adminSiteRequestsGET(
      new Request("http://localhost/api/admin/site-requests?status=invalid", {
        headers: {
          Authorization: "Bearer super-admin-token",
        },
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_STATUS");
  });

  it("GET /api/admin/site-requests returns paginated requests for super admin", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: SUPER_ADMIN_ID }));
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: SUPER_ADMIN_ID,
              role: "super_admin",
              company_id: null,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/website_creation_requests?")) {
        return Promise.resolve(
          jsonResponse(
            [
              {
                id: "site-request-1",
                company_name: "Seed Retail Company",
                sector: "Commerce",
                contact_name: "Seed Request",
                email: "seed.request@cartevisite.app",
                phone: "+212633333333",
                needs: "Need a website with pages and contact form.",
                status: "new",
                admin_notes: null,
                handled_by: null,
                handled_at: null,
                created_at: "2026-04-12T12:00:00.000Z",
                updated_at: "2026-04-12T12:00:00.000Z",
              },
            ],
            {
              headers: {
                "content-range": "0-0/1",
              },
            }
          )
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await adminSiteRequestsGET(
      new Request(
        "http://localhost/api/admin/site-requests?page=1&limit=10&sort=newest&status=new",
        {
          headers: {
            Authorization: "Bearer super-admin-token",
          },
        }
      )
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.meta.total).toBe(1);
    expect(body.data[0].id).toBe("site-request-1");
  });
});
