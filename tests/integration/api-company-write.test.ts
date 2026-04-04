import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH as companyJobPATCH, DELETE as companyJobDELETE } from "@/app/api/company/jobs/[id]/route";
import { GET as companyJobsGET, POST as companyJobsPOST } from "@/app/api/company/jobs/route";
import {
  PATCH as companyApplicationStatusPATCH,
} from "@/app/api/company/applications/[id]/status/route";
import { GET as companyApplicationsGET } from "@/app/api/company/applications/route";
import {
  PATCH as companyProfilePATCH,
  POST as companyProfilePOST,
} from "@/app/api/company/profile/route";

const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOB_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const APPLICATION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> }
) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

function emptyResponse(status = 204) {
  return new Response(null, { status });
}

describe("Sprint 2 entreprise write APIs", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /api/company/jobs returns 401 when auth header is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await companyJobsPOST(
      new Request("http://localhost/api/company/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Developpeur Full Stack",
          description: "Build backend routes and test integrations with Supabase.",
        }),
      })
    );

    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST /api/company/jobs returns INVALID_JSON for malformed payload", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: ACTOR_ID }));
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: ACTOR_ID,
              role: "entreprise",
              company_id: COMPANY_ID,
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await companyJobsPOST(
      new Request("http://localhost/api/company/jobs", {
        method: "POST",
        headers: {
          Authorization: "Bearer fake-token",
          "Content-Type": "application/json",
        },
        body: "{ malformed-json",
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("POST /api/company/jobs creates a job for the authenticated entreprise", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(
          jsonResponse({
            id: ACTOR_ID,
            email: "seed.atlas@cartevisite.app",
          })
        );
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: ACTOR_ID,
              role: "entreprise",
              company_id: COMPANY_ID,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/job_offers?")) {
        expect(init?.method).toBe("POST");

        const payload = JSON.parse(String(init?.body)) as {
          company_id: string;
          created_by: string;
          status: string;
        };

        expect(payload.company_id).toBe(COMPANY_ID);
        expect(payload.created_by).toBe(ACTOR_ID);
        expect(payload.status).toBe("published");

        return Promise.resolve(
          jsonResponse(
            [
              {
                id: JOB_ID,
                company_id: COMPANY_ID,
                title: "Developpeur Full Stack",
                description:
                  "Build backend routes and test integrations with Supabase.",
                contract_type: "CDI",
                location_city: "Casablanca",
                salary_min: 9000,
                salary_max: 14000,
                is_remote: false,
                status: "published",
                published_at: "2026-04-11T12:00:00.000Z",
                created_at: "2026-04-11T12:00:00.000Z",
                updated_at: "2026-04-11T12:00:00.000Z",
              },
            ],
            { status: 201 }
          )
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await companyJobsPOST(
      new Request("http://localhost/api/company/jobs", {
        method: "POST",
        headers: {
          Authorization: "Bearer fake-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Developpeur Full Stack",
          description: "Build backend routes and test integrations with Supabase.",
          contract_type: "CDI",
          location_city: "Casablanca",
          salary_min: 9000,
          salary_max: 14000,
          is_remote: false,
          status: "published",
        }),
      })
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(JOB_ID);
    expect(body.data.company_id).toBe(COMPANY_ID);
  });

  it("PATCH /api/company/jobs/[id] blocks updates for another company", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: ACTOR_ID }));
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: ACTOR_ID,
              role: "entreprise",
              company_id: COMPANY_ID,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/job_offers?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: JOB_ID,
              company_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              title: "Data Analyst",
              description: "Description for another company job posting.",
              contract_type: "CDI",
              location_city: "Rabat",
              salary_min: null,
              salary_max: null,
              is_remote: false,
              status: "draft",
              published_at: null,
              created_at: "2026-04-11T12:00:00.000Z",
              updated_at: "2026-04-11T12:00:00.000Z",
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await companyJobPATCH(
      new Request("http://localhost/api/company/jobs/" + JOB_ID, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer fake-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Updated title",
        }),
      }),
      { params: Promise.resolve({ id: JOB_ID }) }
    );

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("DELETE /api/company/jobs/[id] deletes a job belonging to actor company", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: ACTOR_ID }));
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: ACTOR_ID,
              role: "entreprise",
              company_id: COMPANY_ID,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/job_offers?") && init?.method === "GET") {
        return Promise.resolve(
          jsonResponse([
            {
              id: JOB_ID,
              company_id: COMPANY_ID,
              title: "Developpeur Full Stack",
              description: "Long description for test delete operation flow.",
              contract_type: "CDI",
              location_city: "Casablanca",
              salary_min: null,
              salary_max: null,
              is_remote: false,
              status: "draft",
              published_at: null,
              created_at: "2026-04-11T12:00:00.000Z",
              updated_at: "2026-04-11T12:00:00.000Z",
            },
          ])
        );
      }

      if (url.includes("/rest/v1/job_offers?") && init?.method === "DELETE") {
        return Promise.resolve(emptyResponse(204));
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await companyJobDELETE(
      new Request("http://localhost/api/company/jobs/" + JOB_ID, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer fake-token",
        },
      }),
      { params: Promise.resolve({ id: JOB_ID }) }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(JOB_ID);
    expect(body.data.deleted).toBe(true);
  });

  it("PATCH /api/company/profile updates current entreprise company profile", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: ACTOR_ID }));
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: ACTOR_ID,
              role: "entreprise",
              company_id: COMPANY_ID,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/companies?") && init?.method === "PATCH") {
        return Promise.resolve(
          jsonResponse([
            {
              id: COMPANY_ID,
              owner_user_id: ACTOR_ID,
              name: "Atlas Tech SARL",
              slug: "atlas-tech",
              sector: "Technologie",
              description: "Software services and digital consulting.",
              address: "Bd Zerktouni 120",
              city: "Fes",
              country: "Morocco",
              phone: "+212600000001",
              email: "contact@atlastest.ma",
              website_url: "https://atlas-tech.example",
              logo_url: null,
              cover_url: null,
              status: "active",
              is_featured: false,
              created_at: "2026-04-11T12:00:00.000Z",
              updated_at: "2026-04-11T12:30:00.000Z",
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await companyProfilePATCH(
      new Request("http://localhost/api/company/profile", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer fake-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          city: "Fes",
          website_url: "https://atlas-tech.example",
        }),
      })
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.city).toBe("Fes");
  });

  it("POST /api/company/profile creates profile when entreprise has no company yet", async () => {
    const newCompanyId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: ACTOR_ID }));
      }

      if (url.includes("/rest/v1/profiles?") && init?.method === "GET") {
        return Promise.resolve(
          jsonResponse([
            {
              id: ACTOR_ID,
              role: "entreprise",
              company_id: null,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/companies?") && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            [
              {
                id: newCompanyId,
                owner_user_id: ACTOR_ID,
                name: "New Company",
                slug: "new-company",
                sector: null,
                description: null,
                address: null,
                city: null,
                country: null,
                phone: null,
                email: null,
                website_url: null,
                logo_url: null,
                cover_url: null,
                status: "pending",
                is_featured: false,
                created_at: "2026-04-11T12:00:00.000Z",
                updated_at: "2026-04-11T12:00:00.000Z",
              },
            ],
            { status: 201 }
          )
        );
      }

      if (url.includes("/rest/v1/profiles?") && init?.method === "PATCH") {
        return Promise.resolve(emptyResponse(204));
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await companyProfilePOST(
      new Request("http://localhost/api/company/profile", {
        method: "POST",
        headers: {
          Authorization: "Bearer fake-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "New Company",
          slug: "new-company",
        }),
      })
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(newCompanyId);
    expect(body.data.slug).toBe("new-company");
  });

  it("GET /api/company/jobs returns paginated jobs for entreprise", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: ACTOR_ID }));
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: ACTOR_ID,
              role: "entreprise",
              company_id: COMPANY_ID,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/job_offers?")) {
        return Promise.resolve(
          jsonResponse(
            [
              {
                id: JOB_ID,
                company_id: COMPANY_ID,
                title: "Developpeur Full Stack",
                description: "Long description for job list testing.",
                contract_type: "CDI",
                location_city: "Casablanca",
                salary_min: null,
                salary_max: null,
                is_remote: false,
                status: "draft",
                published_at: null,
                created_at: "2026-04-11T12:00:00.000Z",
                updated_at: "2026-04-11T12:00:00.000Z",
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

    const response = await companyJobsGET(
      new Request("http://localhost/api/company/jobs?page=1&limit=10&sort=newest", {
        headers: {
          Authorization: "Bearer fake-token",
        },
      })
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.meta.total).toBe(1);
    expect(body.data[0].id).toBe(JOB_ID);
  });

  it("GET /api/company/applications returns paginated applications with job summary", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: ACTOR_ID }));
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: ACTOR_ID,
              role: "entreprise",
              company_id: COMPANY_ID,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/applications?")) {
        return Promise.resolve(
          jsonResponse(
            [
              {
                id: APPLICATION_ID,
                job_offer_id: JOB_ID,
                company_id: COMPANY_ID,
                candidate_name: "Candidate Demo",
                candidate_email: "candidate.demo@cartevisite.app",
                candidate_phone: "+212611111111",
                cover_letter: "I am interested in this role.",
                cv_path: `company/${COMPANY_ID}/applications/demo-cv.pdf`,
                cv_file_name: "demo-cv.pdf",
                status: "pending",
                reviewed_by: null,
                reviewed_at: null,
                created_at: "2026-04-11T12:00:00.000Z",
                updated_at: "2026-04-11T12:00:00.000Z",
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

      if (url.includes("/rest/v1/job_offers?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: JOB_ID,
              title: "Developpeur Full Stack",
              contract_type: "CDI",
              location_city: "Casablanca",
              status: "published",
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await companyApplicationsGET(
      new Request(
        "http://localhost/api/company/applications?page=1&limit=10&sort=newest",
        {
          headers: {
            Authorization: "Bearer fake-token",
          },
        }
      )
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.meta.total).toBe(1);
    expect(body.data[0].id).toBe(APPLICATION_ID);
    expect(body.data[0].job?.id).toBe(JOB_ID);
  });

  it("PATCH /api/company/applications/[id]/status updates application status", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: ACTOR_ID }));
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: ACTOR_ID,
              role: "entreprise",
              company_id: COMPANY_ID,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/applications?") && init?.method === "GET") {
        return Promise.resolve(
          jsonResponse([
            {
              id: APPLICATION_ID,
              job_offer_id: JOB_ID,
              company_id: COMPANY_ID,
              candidate_name: "Candidate Demo",
              candidate_email: "candidate.demo@cartevisite.app",
              candidate_phone: "+212611111111",
              cover_letter: "I am interested in this role.",
              cv_path: `company/${COMPANY_ID}/applications/demo-cv.pdf`,
              cv_file_name: "demo-cv.pdf",
              status: "pending",
              reviewed_by: null,
              reviewed_at: null,
              created_at: "2026-04-11T12:00:00.000Z",
              updated_at: "2026-04-11T12:00:00.000Z",
            },
          ])
        );
      }

      if (url.includes("/rest/v1/applications?") && init?.method === "PATCH") {
        const payload = JSON.parse(String(init?.body)) as {
          status: string;
          reviewed_by: string;
        };

        expect(payload.status).toBe("shortlisted");
        expect(payload.reviewed_by).toBe(ACTOR_ID);

        return Promise.resolve(
          jsonResponse([
            {
              id: APPLICATION_ID,
              job_offer_id: JOB_ID,
              company_id: COMPANY_ID,
              candidate_name: "Candidate Demo",
              candidate_email: "candidate.demo@cartevisite.app",
              candidate_phone: "+212611111111",
              cover_letter: "I am interested in this role.",
              cv_path: `company/${COMPANY_ID}/applications/demo-cv.pdf`,
              cv_file_name: "demo-cv.pdf",
              status: "shortlisted",
              reviewed_by: ACTOR_ID,
              reviewed_at: "2026-04-11T13:00:00.000Z",
              created_at: "2026-04-11T12:00:00.000Z",
              updated_at: "2026-04-11T13:00:00.000Z",
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await companyApplicationStatusPATCH(
      new Request(
        "http://localhost/api/company/applications/" + APPLICATION_ID + "/status",
        {
          method: "PATCH",
          headers: {
            Authorization: "Bearer fake-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "shortlisted" }),
        }
      ),
      {
        params: Promise.resolve({ id: APPLICATION_ID }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("shortlisted");
    expect(body.data.reviewed_by).toBe(ACTOR_ID);
  });

  it("PATCH /api/company/applications/[id]/status blocks updates for another company", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: ACTOR_ID }));
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: ACTOR_ID,
              role: "entreprise",
              company_id: COMPANY_ID,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/applications?") && init?.method === "GET") {
        return Promise.resolve(
          jsonResponse([
            {
              id: APPLICATION_ID,
              job_offer_id: JOB_ID,
              company_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
              candidate_name: "Candidate Demo",
              candidate_email: "candidate.demo@cartevisite.app",
              candidate_phone: "+212611111111",
              cover_letter: "I am interested in this role.",
              cv_path: "company/other/applications/demo-cv.pdf",
              cv_file_name: "demo-cv.pdf",
              status: "pending",
              reviewed_by: null,
              reviewed_at: null,
              created_at: "2026-04-11T12:00:00.000Z",
              updated_at: "2026-04-11T12:00:00.000Z",
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await companyApplicationStatusPATCH(
      new Request(
        "http://localhost/api/company/applications/" + APPLICATION_ID + "/status",
        {
          method: "PATCH",
          headers: {
            Authorization: "Bearer fake-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "rejected" }),
        }
      ),
      {
        params: Promise.resolve({ id: APPLICATION_ID }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("PATCH /api/company/applications/[id]/status returns INVALID_JSON for malformed payload", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/auth/v1/user")) {
        return Promise.resolve(jsonResponse({ id: ACTOR_ID }));
      }

      if (url.includes("/rest/v1/profiles?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: ACTOR_ID,
              role: "entreprise",
              company_id: COMPANY_ID,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/applications?") && init?.method === "GET") {
        return Promise.resolve(
          jsonResponse([
            {
              id: APPLICATION_ID,
              job_offer_id: JOB_ID,
              company_id: COMPANY_ID,
              candidate_name: "Candidate Demo",
              candidate_email: "candidate.demo@cartevisite.app",
              candidate_phone: "+212611111111",
              cover_letter: "I am interested in this role.",
              cv_path: `company/${COMPANY_ID}/applications/demo-cv.pdf`,
              cv_file_name: "demo-cv.pdf",
              status: "pending",
              reviewed_by: null,
              reviewed_at: null,
              created_at: "2026-04-11T12:00:00.000Z",
              updated_at: "2026-04-11T12:00:00.000Z",
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await companyApplicationStatusPATCH(
      new Request(
        "http://localhost/api/company/applications/" + APPLICATION_ID + "/status",
        {
          method: "PATCH",
          headers: {
            Authorization: "Bearer fake-token",
            "Content-Type": "application/json",
          },
          body: "{ malformed-json",
        }
      ),
      {
        params: Promise.resolve({ id: APPLICATION_ID }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_JSON");
  });
});
