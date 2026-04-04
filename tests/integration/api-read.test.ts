import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as categoriesGET } from "@/app/api/categories/route";
import { GET as companyBySlugGET } from "@/app/api/companies/[slug]/route";
import { GET as companiesGET } from "@/app/api/companies/route";
import { GET as healthGET } from "@/app/api/health/route";
import { GET as jobByIdGET } from "@/app/api/jobs/[id]/route";
import { GET as jobsGET } from "@/app/api/jobs/route";

function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> }
) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

describe("Sprint 1 read APIs", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/health returns ok when Supabase responds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse([{ id: "c1" }]))
    );

    const response = await healthGET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(body.data.services.supabase).toBe(true);
  });

  it("GET /api/categories returns only active categories by default", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);
      expect(url).toContain("/rest/v1/categories?");
      expect(url).toContain("is_active=eq.true");

      return Promise.resolve(
        jsonResponse([
          { id: "1", name: "Technologie", slug: "technologie", is_active: true },
          { id: "2", name: "Sante", slug: "sante", is_active: true },
        ])
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost:3000/api/categories");
    const response = await categoriesGET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(2);
  });

  it("GET /api/companies returns paginated companies with open_jobs_count", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/rest/v1/companies?")) {
        return Promise.resolve(
          jsonResponse(
            [
              {
                id: "11111111-1111-4111-8111-111111111111",
                name: "Atlas Tech SARL",
                slug: "atlas-tech",
                sector: "Technologie",
                description: "Tech",
                city: "Casablanca",
                country: "Morocco",
                logo_url: null,
                website_url: null,
                is_featured: true,
                created_at: "2026-04-01T00:00:00.000Z",
                updated_at: "2026-04-01T00:00:00.000Z",
              },
              {
                id: "22222222-2222-4222-8222-222222222222",
                name: "Maghreb Health Plus",
                slug: "maghreb-health-plus",
                sector: "Sante",
                description: "Health",
                city: "Rabat",
                country: "Morocco",
                logo_url: null,
                website_url: null,
                is_featured: false,
                created_at: "2026-04-01T00:00:00.000Z",
                updated_at: "2026-04-01T00:00:00.000Z",
              },
            ],
            {
              headers: {
                "content-range": "0-1/2",
              },
            }
          )
        );
      }

      if (url.includes("/rest/v1/job_offers?")) {
        return Promise.resolve(
          jsonResponse([
            { company_id: "11111111-1111-4111-8111-111111111111" },
            { company_id: "11111111-1111-4111-8111-111111111111" },
            { company_id: "22222222-2222-4222-8222-222222222222" },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request(
      "http://localhost:3000/api/companies?page=1&limit=5&sort=newest"
    );
    const response = await companiesGET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(2);
    expect(body.data[0].open_jobs_count).toBe(2);
    expect(body.data[1].open_jobs_count).toBe(1);
  });

  it("GET /api/companies/[slug] returns company details with relations", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/rest/v1/companies?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Atlas Tech SARL",
              slug: "atlas-tech",
              sector: "Technologie",
              description: "Tech",
              address: "Bd Zerktouni 120",
              city: "Casablanca",
              country: "Morocco",
              phone: "+212600000001",
              email: "contact@atlastest.ma",
              website_url: "https://atlas-tech.example",
              logo_url: null,
              cover_url: null,
              is_featured: true,
              created_at: "2026-04-01T00:00:00.000Z",
              updated_at: "2026-04-01T00:00:00.000Z",
            },
          ])
        );
      }

      if (url.includes("/rest/v1/job_offers?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: "a1",
              title: "Developpeur Full Stack",
              contract_type: "CDI",
              location_city: "Casablanca",
              is_remote: false,
              status: "published",
              published_at: "2026-04-01T00:00:00.000Z",
              created_at: "2026-04-01T00:00:00.000Z",
            },
          ])
        );
      }

      if (url.includes("/rest/v1/company_services?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: "s1",
              title: "Creation de site web",
              description: "Service",
              price_label: "A partir de 2500 MAD",
              is_active: true,
            },
          ])
        );
      }

      if (url.includes("/rest/v1/company_news?")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: "n1",
              title: "News",
              content: "Content",
              image_url: null,
              is_published: true,
              published_at: "2026-04-01T00:00:00.000Z",
              created_at: "2026-04-01T00:00:00.000Z",
            },
          ])
        );
      }

      if (url.includes("/rest/v1/company_categories?")) {
        return Promise.resolve(
          jsonResponse([
            {
              categories: {
                id: "cat1",
                name: "Technologie",
                slug: "technologie",
              },
            },
          ])
        );
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await companyBySlugGET(new Request("http://localhost"), {
      params: Promise.resolve({ slug: "atlas-tech" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe("atlas-tech");
    expect(body.data.jobs).toHaveLength(1);
    expect(body.data.services).toHaveLength(1);
    expect(body.data.news).toHaveLength(1);
    expect(body.data.categories).toHaveLength(1);
  });

  it("GET /api/jobs returns list with linked company", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/rest/v1/job_offers?")) {
        return Promise.resolve(
          jsonResponse(
            [
              {
                id: "job1",
                company_id: "11111111-1111-4111-8111-111111111111",
                title: "Developpeur Full Stack",
                description: "Desc",
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
              id: "11111111-1111-4111-8111-111111111111",
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
      new Request("http://localhost:3000/api/jobs?page=1&limit=10")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].company?.slug).toBe("atlas-tech");
  });

  it("GET /api/jobs/[id] returns 400 for invalid uuid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await jobByIdGET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "invalid-id" }),
    });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_ID");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
