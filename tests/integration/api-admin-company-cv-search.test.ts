import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as adminCompaniesGET } from "@/app/api/admin/companies/route";
import { PATCH as adminCompanyPATCH } from "@/app/api/admin/companies/[id]/route";
import { GET as adminApplicationCvGET } from "@/app/api/admin/applications/[id]/cv/route";
import { GET as companyApplicationCvGET } from "@/app/api/company/applications/[id]/cv/route";
import { GET as jobsGET } from "@/app/api/jobs/route";

const SUPER_ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTREPRISE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COMPANY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_COMPANY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const APPLICATION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> }
) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

describe("Admin companies, CV download, and category filtering", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.SUPABASE_STORAGE_CV_BUCKET = "candidate-cv";
    process.env.CV_DOWNLOAD_URL_EXP_SECONDS = "300";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/admin/companies requires super admin auth", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await adminCompaniesGET(
      new Request("http://localhost/api/admin/companies")
    );

    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GET /api/admin/companies returns paginated data for super admin", async () => {
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

      if (url.includes("/rest/v1/companies?")) {
        expect(url).toContain("status=eq.active");

        return Promise.resolve(
          jsonResponse(
            [
              {
                id: COMPANY_ID,
                owner_user_id: ENTREPRISE_ID,
                name: "Atlas Tech SARL",
                slug: "atlas-tech",
                sector: "Technologie",
                description: null,
                city: "Casablanca",
                country: "Morocco",
                status: "active",
                is_featured: false,
                created_at: "2026-04-01T00:00:00.000Z",
                updated_at: "2026-04-01T00:00:00.000Z",
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

    const response = await adminCompaniesGET(
      new Request("http://localhost/api/admin/companies?page=1&limit=10&status=active", {
        headers: {
          Authorization: "Bearer super-admin-token",
        },
      })
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.meta.total).toBe(1);
    expect(body.data[0].id).toBe(COMPANY_ID);
  });

  it("PATCH /api/admin/companies/[id] updates company activation status", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
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

      if (url.includes("/rest/v1/companies?") && init?.method === "GET") {
        return Promise.resolve(
          jsonResponse([
            {
              id: COMPANY_ID,
              owner_user_id: ENTREPRISE_ID,
              name: "Atlas Tech SARL",
              slug: "atlas-tech",
              sector: "Technologie",
              description: null,
              city: "Casablanca",
              country: "Morocco",
              status: "pending",
              is_featured: false,
              created_at: "2026-04-01T00:00:00.000Z",
              updated_at: "2026-04-01T00:00:00.000Z",
            },
          ])
        );
      }

      if (url.includes("/rest/v1/companies?") && init?.method === "PATCH") {
        const payload = JSON.parse(String(init.body)) as {
          status: string;
          is_featured: boolean;
        };

        expect(payload.status).toBe("active");
        expect(payload.is_featured).toBe(true);

        return Promise.resolve(
          jsonResponse([
            {
              id: COMPANY_ID,
              owner_user_id: ENTREPRISE_ID,
              name: "Atlas Tech SARL",
              slug: "atlas-tech",
              sector: "Technologie",
              description: null,
              city: "Casablanca",
              country: "Morocco",
              status: "active",
              is_featured: true,
              created_at: "2026-04-01T00:00:00.000Z",
              updated_at: "2026-04-02T00:00:00.000Z",
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await adminCompanyPATCH(
      new Request(`http://localhost/api/admin/companies/${COMPANY_ID}`, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer super-admin-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "active",
          is_featured: true,
        }),
      }),
      {
        params: Promise.resolve({ id: COMPANY_ID }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("active");
    expect(body.data.is_featured).toBe(true);
  });

  it("GET /api/company/applications/[id]/cv returns signed URL for owning entreprise", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
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
              company_id: COMPANY_ID,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/applications?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: APPLICATION_ID,
              company_id: COMPANY_ID,
              cv_path: `company/${COMPANY_ID}/applications/${APPLICATION_ID}/demo-cv.pdf`,
              cv_file_name: "demo-cv.pdf",
            },
          ])
        );
      }

      if (url.includes("/storage/v1/object/sign/")) {
        expect(init?.method).toBe("POST");
        return Promise.resolve(
          jsonResponse({
            signedURL:
              "/object/sign/candidate-cv/company/cccccccc-cccc-4ccc-8ccc-cccccccccccc/applications/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/demo-cv.pdf?token=abc",
          })
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await companyApplicationCvGET(
      new Request(`http://localhost/api/company/applications/${APPLICATION_ID}/cv`, {
        headers: {
          Authorization: "Bearer entreprise-token",
        },
      }),
      {
        params: Promise.resolve({ id: APPLICATION_ID }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.application_id).toBe(APPLICATION_ID);
    expect(body.data.download_url).toContain("/storage/v1/object/sign/");
  });

  it("GET /api/company/applications/[id]/cv blocks access for other company", async () => {
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
              company_id: COMPANY_ID,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/applications?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: APPLICATION_ID,
              company_id: OTHER_COMPANY_ID,
              cv_path: `company/${OTHER_COMPANY_ID}/applications/${APPLICATION_ID}/demo-cv.pdf`,
              cv_file_name: "demo-cv.pdf",
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await companyApplicationCvGET(
      new Request(`http://localhost/api/company/applications/${APPLICATION_ID}/cv`, {
        headers: {
          Authorization: "Bearer entreprise-token",
        },
      }),
      {
        params: Promise.resolve({ id: APPLICATION_ID }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("GET /api/admin/applications/[id]/cv returns signed URL for super admin", async () => {
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

      if (url.includes("/rest/v1/applications?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: APPLICATION_ID,
              cv_path: `company/${COMPANY_ID}/applications/${APPLICATION_ID}/demo-cv.pdf`,
              cv_file_name: "demo-cv.pdf",
            },
          ])
        );
      }

      if (url.includes("/storage/v1/object/sign/")) {
        return Promise.resolve(
          jsonResponse({
            signedURL:
              "/object/sign/candidate-cv/company/cccccccc-cccc-4ccc-8ccc-cccccccccccc/applications/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/demo-cv.pdf?token=def",
          })
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await adminApplicationCvGET(
      new Request(`http://localhost/api/admin/applications/${APPLICATION_ID}/cv`, {
        headers: {
          Authorization: "Bearer super-admin-token",
        },
      }),
      {
        params: Promise.resolve({ id: APPLICATION_ID }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.application_id).toBe(APPLICATION_ID);
    expect(body.data.download_url).toContain("/storage/v1/object/sign/");
  });

  it("GET /api/jobs supports category filter", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/rest/v1/company_categories?")) {
        return Promise.resolve(
          jsonResponse([
            {
              company_id: COMPANY_ID,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/job_offers?")) {
        const decodedUrl = decodeURIComponent(url);
        expect(decodedUrl).toContain(`company_id=in.(${COMPANY_ID})`);

        return Promise.resolve(
          jsonResponse(
            [
              {
                id: "job-1",
                company_id: COMPANY_ID,
                title: "Developpeur Full Stack",
                description: "Build and maintain products",
                contract_type: "CDI",
                location_city: "Casablanca",
                salary_min: null,
                salary_max: null,
                is_remote: false,
                status: "published",
                published_at: "2026-04-01T00:00:00.000Z",
                created_at: "2026-04-01T00:00:00.000Z",
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

      if (url.includes("/rest/v1/companies?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: COMPANY_ID,
              name: "Atlas Tech SARL",
              slug: "atlas-tech",
              logo_url: null,
              city: "Casablanca",
              sector: "Technologie",
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await jobsGET(
      new Request("http://localhost/api/jobs?category=technologie&page=1&limit=10")
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.meta.category).toBe("technologie");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].company?.slug).toBe("atlas-tech");
  });
});