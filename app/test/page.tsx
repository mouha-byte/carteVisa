"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type EndpointMethod = "GET" | "POST" | "PATCH" | "DELETE";
type EndpointAuth = "public" | "entreprise" | "admin";

type EndpointResult = {
  status: number;
  ok: boolean;
  durationMs: number;
  at: string;
  body: unknown;
};

type EndpointDefinition = {
  id: string;
  section: "Public" | "Entreprise" | "Admin";
  label: string;
  method: EndpointMethod;
  auth: EndpointAuth;
  expectedStatus: number[];
  isDangerous?: boolean;
  path: (state: DashboardState) => string;
  buildInit?: (state: DashboardState) => Promise<{
    headers?: Record<string, string>;
    body?: BodyInit;
  }>;
};

type DashboardState = {
  entrepriseToken: string;
  adminToken: string;
  q: string;
  city: string;
  categorySlug: string;
  companySlug: string;
  companyId: string;
  ownerUserId: string;
  jobId: string;
  applicationId: string;
  applicationStatus: string;
  includeDangerousInBatch: boolean;
};

const INITIAL_STATE: DashboardState = {
  entrepriseToken: "",
  adminToken: "",
  q: "",
  city: "",
  categorySlug: "technologie",
  companySlug: "atlas-tech",
  companyId: "",
  ownerUserId: "",
  jobId: "",
  applicationId: "",
  applicationStatus: "pending",
  includeDangerousInBatch: false,
};

function buildQuery(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (!value) {
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    searchParams.set(key, trimmed);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildDefaultCvFile(): File {
  return new File(["%PDF-1.4\n% minimal test cv\n"], "demo-cv.pdf", {
    type: "application/pdf",
  });
}

function shortJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function endpointPathPreview(definition: EndpointDefinition, state: DashboardState): string {
  try {
    return definition.path(state);
  } catch {
    return "<invalid path input>";
  }
}

export default function TestIndexPage() {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [applicationCvFile, setApplicationCvFile] = useState<File | null>(null);
  const [results, setResults] = useState<Record<string, EndpointResult>>({});
  const [runningEndpointId, setRunningEndpointId] = useState<string | null>(null);

  const endpoints = useMemo<EndpointDefinition[]>(
    () => [
      {
        id: "public-health",
        section: "Public",
        label: "Health check",
        method: "GET",
        auth: "public",
        expectedStatus: [200],
        path: () => "/api/health",
      },
      {
        id: "public-categories",
        section: "Public",
        label: "Categories list",
        method: "GET",
        auth: "public",
        expectedStatus: [200],
        path: () => "/api/categories",
      },
      {
        id: "public-companies",
        section: "Public",
        label: "Companies search",
        method: "GET",
        auth: "public",
        expectedStatus: [200],
        path: (ctx) =>
          `/api/companies${buildQuery({
            page: "1",
            limit: "10",
            sort: "newest",
            q: ctx.q,
            city: ctx.city,
            category: ctx.categorySlug,
          })}`,
      },
      {
        id: "public-company-slug",
        section: "Public",
        label: "Company by slug",
        method: "GET",
        auth: "public",
        expectedStatus: [200, 404],
        path: (ctx) => `/api/companies/${encodeURIComponent(ctx.companySlug)}`,
      },
      {
        id: "public-jobs",
        section: "Public",
        label: "Jobs search",
        method: "GET",
        auth: "public",
        expectedStatus: [200],
        path: (ctx) =>
          `/api/jobs${buildQuery({
            page: "1",
            limit: "10",
            sort: "newest",
            q: ctx.q,
            city: ctx.city,
            company: ctx.companySlug,
            category: ctx.categorySlug,
          })}`,
      },
      {
        id: "public-job-id",
        section: "Public",
        label: "Job by id",
        method: "GET",
        auth: "public",
        expectedStatus: [200, 400, 404],
        path: (ctx) => `/api/jobs/${encodeURIComponent(ctx.jobId)}`,
      },
      {
        id: "public-contact-post",
        section: "Public",
        label: "Create contact message",
        method: "POST",
        auth: "public",
        expectedStatus: [201],
        path: () => "/api/contact",
        buildInit: async () => {
          const stamp = Date.now();
          return {
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              full_name: `Smoke Contact ${stamp}`,
              email: `smoke.contact.${stamp}@example.com`,
              phone: "+212600000001",
              message: `Smoke test contact message created at ${stamp}.`,
            }),
          };
        },
      },
      {
        id: "public-site-request-post",
        section: "Public",
        label: "Create site request",
        method: "POST",
        auth: "public",
        expectedStatus: [201],
        path: () => "/api/site-requests",
        buildInit: async () => {
          const stamp = Date.now();
          return {
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              company_name: `Smoke Company ${stamp}`,
              sector: "Technologie",
              contact_name: `Smoke Request ${stamp}`,
              email: `smoke.request.${stamp}@example.com`,
              phone: "+212600000002",
              needs: "Need a website and dashboard for hiring flow.",
            }),
          };
        },
      },
      {
        id: "public-application-post",
        section: "Public",
        label: "Submit application (multipart)",
        method: "POST",
        auth: "public",
        expectedStatus: [201, 400, 404],
        path: () => "/api/applications",
        buildInit: async (ctx) => {
          const stamp = Date.now();
          const formData = new FormData();

          formData.set("job_offer_id", ctx.jobId);
          formData.set("candidate_name", `Smoke Candidate ${stamp}`);
          formData.set("candidate_email", `smoke.candidate.${stamp}@example.com`);
          formData.set("candidate_phone", "+212611111111");
          formData.set("cover_letter", "I am interested in this opportunity.");
          formData.set("cv", applicationCvFile ?? buildDefaultCvFile());

          return {
            body: formData,
          };
        },
      },
      {
        id: "public-application-receipt",
        section: "Public",
        label: "Application receipt",
        method: "GET",
        auth: "public",
        expectedStatus: [200, 400, 404],
        path: (ctx) => `/api/applications/${encodeURIComponent(ctx.applicationId)}/receipt`,
      },
      {
        id: "entreprise-profile-create",
        section: "Entreprise",
        label: "Create company profile",
        method: "POST",
        auth: "entreprise",
        expectedStatus: [201, 400, 409],
        path: () => "/api/company/profile",
        buildInit: async (ctx) => ({
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Smoke Entreprise",
            slug: `smoke-entreprise-${Date.now()}`,
            city: ctx.city || "Casablanca",
          }),
        }),
      },
      {
        id: "entreprise-profile-update",
        section: "Entreprise",
        label: "Update company profile",
        method: "PATCH",
        auth: "entreprise",
        expectedStatus: [200, 400, 404],
        path: () => "/api/company/profile",
        buildInit: async (ctx) => ({
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            city: ctx.city || "Casablanca",
          }),
        }),
      },
      {
        id: "entreprise-jobs-list",
        section: "Entreprise",
        label: "List company jobs",
        method: "GET",
        auth: "entreprise",
        expectedStatus: [200],
        path: () => "/api/company/jobs?page=1&limit=10",
      },
      {
        id: "entreprise-jobs-create",
        section: "Entreprise",
        label: "Create company job",
        method: "POST",
        auth: "entreprise",
        expectedStatus: [201, 400],
        path: () => "/api/company/jobs",
        buildInit: async (ctx) => ({
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: `Smoke Job ${Date.now()}`,
            description:
              "This is a smoke test job description with enough detail for validation.",
            contract_type: "CDI",
            location_city: ctx.city || "Casablanca",
            status: "draft",
          }),
        }),
      },
      {
        id: "entreprise-job-update",
        section: "Entreprise",
        label: "Update company job by id",
        method: "PATCH",
        auth: "entreprise",
        expectedStatus: [200, 400, 403, 404],
        path: (ctx) => `/api/company/jobs/${encodeURIComponent(ctx.jobId)}`,
        buildInit: async () => ({
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "draft",
          }),
        }),
      },
      {
        id: "entreprise-job-delete",
        section: "Entreprise",
        label: "Delete company job by id",
        method: "DELETE",
        auth: "entreprise",
        expectedStatus: [200, 400, 403, 404],
        isDangerous: true,
        path: (ctx) => `/api/company/jobs/${encodeURIComponent(ctx.jobId)}`,
      },
      {
        id: "entreprise-applications-list",
        section: "Entreprise",
        label: "List company applications",
        method: "GET",
        auth: "entreprise",
        expectedStatus: [200],
        path: () => "/api/company/applications?page=1&limit=10",
      },
      {
        id: "entreprise-application-status",
        section: "Entreprise",
        label: "Update application status",
        method: "PATCH",
        auth: "entreprise",
        expectedStatus: [200, 400, 403, 404],
        path: (ctx) =>
          `/api/company/applications/${encodeURIComponent(ctx.applicationId)}/status`,
        buildInit: async (ctx) => ({
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: ctx.applicationStatus,
          }),
        }),
      },
      {
        id: "entreprise-application-cv",
        section: "Entreprise",
        label: "Get application CV signed URL",
        method: "GET",
        auth: "entreprise",
        expectedStatus: [200, 400, 403, 404],
        path: (ctx) => `/api/company/applications/${encodeURIComponent(ctx.applicationId)}/cv`,
      },
      {
        id: "admin-contact-list",
        section: "Admin",
        label: "List contact messages",
        method: "GET",
        auth: "admin",
        expectedStatus: [200],
        path: () => "/api/admin/contact-messages?page=1&limit=10",
      },
      {
        id: "admin-site-requests-list",
        section: "Admin",
        label: "List site requests",
        method: "GET",
        auth: "admin",
        expectedStatus: [200],
        path: () => "/api/admin/site-requests?page=1&limit=10",
      },
      {
        id: "admin-companies-list",
        section: "Admin",
        label: "List companies",
        method: "GET",
        auth: "admin",
        expectedStatus: [200],
        path: () => "/api/admin/companies?page=1&limit=10",
      },
      {
        id: "admin-companies-create",
        section: "Admin",
        label: "Create company",
        method: "POST",
        auth: "admin",
        expectedStatus: [201, 400],
        path: () => "/api/admin/companies",
        buildInit: async (ctx) => ({
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            owner_user_id: ctx.ownerUserId,
            name: `Admin Smoke Company ${Date.now()}`,
            slug: `admin-smoke-company-${Date.now()}`,
            city: ctx.city || "Casablanca",
            status: "pending",
          }),
        }),
      },
      {
        id: "admin-company-update",
        section: "Admin",
        label: "Update company by id",
        method: "PATCH",
        auth: "admin",
        expectedStatus: [200, 400, 404],
        path: (ctx) => `/api/admin/companies/${encodeURIComponent(ctx.companyId)}`,
        buildInit: async () => ({
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "active",
            is_featured: false,
          }),
        }),
      },
      {
        id: "admin-company-delete",
        section: "Admin",
        label: "Delete company by id",
        method: "DELETE",
        auth: "admin",
        expectedStatus: [200, 400, 404],
        isDangerous: true,
        path: (ctx) => `/api/admin/companies/${encodeURIComponent(ctx.companyId)}`,
      },
      {
        id: "admin-application-cv",
        section: "Admin",
        label: "Get application CV signed URL",
        method: "GET",
        auth: "admin",
        expectedStatus: [200, 400, 404],
        path: (ctx) => `/api/admin/applications/${encodeURIComponent(ctx.applicationId)}/cv`,
      },
    ],
    [applicationCvFile]
  );

  const groupedEndpoints = useMemo(() => {
    return {
      Public: endpoints.filter((endpoint) => endpoint.section === "Public"),
      Entreprise: endpoints.filter((endpoint) => endpoint.section === "Entreprise"),
      Admin: endpoints.filter((endpoint) => endpoint.section === "Admin"),
    };
  }, [endpoints]);

  const updateState = <K extends keyof DashboardState>(key: K, value: DashboardState[K]) => {
    setState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resolveTokenForAuth = (auth: EndpointAuth): string | null => {
    if (auth === "public") {
      return null;
    }

    if (auth === "entreprise") {
      return state.entrepriseToken.trim() || null;
    }

    return state.adminToken.trim() || null;
  };

  const runEndpoint = async (endpoint: EndpointDefinition): Promise<void> => {
    setRunningEndpointId(endpoint.id);

    const token = resolveTokenForAuth(endpoint.auth);
    if (endpoint.auth !== "public" && !token) {
      setResults((prev) => ({
        ...prev,
        [endpoint.id]: {
          status: 0,
          ok: false,
          durationMs: 0,
          at: new Date().toISOString(),
          body: {
            error: `Missing ${endpoint.auth} bearer token.`,
          },
        },
      }));
      setRunningEndpointId(null);
      return;
    }

    const init: RequestInit = {
      method: endpoint.method,
      headers: {},
    };

    if (token) {
      (init.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    if (endpoint.buildInit) {
      const customInit = await endpoint.buildInit(state);
      if (customInit.headers) {
        init.headers = {
          ...(init.headers as Record<string, string>),
          ...customInit.headers,
        };
      }
      if (customInit.body !== undefined) {
        init.body = customInit.body;
      }
    }

    const startedAt = performance.now();

    try {
      const response = await fetch(endpoint.path(state), init);
      const raw = await response.text();

      let parsed: unknown = raw;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = raw;
      }

      const durationMs = Math.round(performance.now() - startedAt);

      setResults((prev) => ({
        ...prev,
        [endpoint.id]: {
          status: response.status,
          ok: endpoint.expectedStatus.includes(response.status),
          durationMs,
          at: new Date().toISOString(),
          body: parsed,
        },
      }));
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      setResults((prev) => ({
        ...prev,
        [endpoint.id]: {
          status: 0,
          ok: false,
          durationMs,
          at: new Date().toISOString(),
          body: {
            error: error instanceof Error ? error.message : "Unknown network error",
          },
        },
      }));
    } finally {
      setRunningEndpointId(null);
    }
  };

  const runBatch = async (): Promise<void> => {
    const selected = endpoints.filter(
      (endpoint) => state.includeDangerousInBatch || !endpoint.isDangerous
    );

    for (const endpoint of selected) {
      await runEndpoint(endpoint);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-[var(--page-gutter)] py-8">
      <header className="rounded border border-zinc-300 bg-white p-4">
        <h1 className="text-2xl font-semibold">API Test Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Minimal UI to test all backend endpoints (public, entreprise, and admin).
        </p>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/test/companies" className="rounded border px-3 py-1.5 hover:bg-zinc-50">
            Legacy Companies Tester
          </Link>
          <Link href="/test/jobs" className="rounded border px-3 py-1.5 hover:bg-zinc-50">
            Legacy Jobs Tester
          </Link>
        </div>
      </header>

      <section className="rounded border border-zinc-300 bg-white p-4">
        <h2 className="text-lg font-medium">Shared Inputs</h2>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Entreprise Bearer Token
            <textarea
              value={state.entrepriseToken}
              onChange={(event) => updateState("entrepriseToken", event.target.value)}
              className="min-h-20 rounded border px-2 py-1 font-mono text-xs"
              placeholder="paste entreprise JWT"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Admin Bearer Token
            <textarea
              value={state.adminToken}
              onChange={(event) => updateState("adminToken", event.target.value)}
              className="min-h-20 rounded border px-2 py-1 font-mono text-xs"
              placeholder="paste admin JWT"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            CV File (for POST /api/applications)
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setApplicationCvFile(file);
              }}
              className="rounded border px-2 py-1 text-xs"
            />
            <span className="text-xs text-zinc-500">
              {applicationCvFile
                ? `Selected: ${applicationCvFile.name}`
                : "No file selected (auto-generated PDF will be used)"}
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Search q
            <input
              value={state.q}
              onChange={(event) => updateState("q", event.target.value)}
              className="rounded border px-2 py-1 text-sm"
              placeholder="keyword"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            City
            <input
              value={state.city}
              onChange={(event) => updateState("city", event.target.value)}
              className="rounded border px-2 py-1 text-sm"
              placeholder="Casablanca"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Category Slug
            <input
              value={state.categorySlug}
              onChange={(event) => updateState("categorySlug", event.target.value)}
              className="rounded border px-2 py-1 text-sm"
              placeholder="technologie"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Company Slug
            <input
              value={state.companySlug}
              onChange={(event) => updateState("companySlug", event.target.value)}
              className="rounded border px-2 py-1 text-sm"
              placeholder="atlas-tech"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Company ID (UUID)
            <input
              value={state.companyId}
              onChange={(event) => updateState("companyId", event.target.value)}
              className="rounded border px-2 py-1 font-mono text-xs"
              placeholder="company id for admin update/delete"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Owner User ID (UUID)
            <input
              value={state.ownerUserId}
              onChange={(event) => updateState("ownerUserId", event.target.value)}
              className="rounded border px-2 py-1 font-mono text-xs"
              placeholder="owner user id for admin create"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Job ID (UUID)
            <input
              value={state.jobId}
              onChange={(event) => updateState("jobId", event.target.value)}
              className="rounded border px-2 py-1 font-mono text-xs"
              placeholder="job id for job detail/update/delete/application"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Application ID (UUID)
            <input
              value={state.applicationId}
              onChange={(event) => updateState("applicationId", event.target.value)}
              className="rounded border px-2 py-1 font-mono text-xs"
              placeholder="application id for receipt/status/cv"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Application Status
            <select
              value={state.applicationStatus}
              onChange={(event) => updateState("applicationStatus", event.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="pending">pending</option>
              <option value="shortlisted">shortlisted</option>
              <option value="rejected">rejected</option>
              <option value="hired">hired</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.includeDangerousInBatch}
              onChange={(event) =>
                updateState("includeDangerousInBatch", event.target.checked)
              }
            />
            Include dangerous endpoints in batch run
          </label>

          <button
            type="button"
            onClick={() => {
              void runBatch();
            }}
            disabled={runningEndpointId !== null}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {runningEndpointId ? "Running..." : "Run Batch"}
          </button>
        </div>
      </section>

      {(["Public", "Entreprise", "Admin"] as const).map((sectionName) => (
        <section key={sectionName} className="rounded border border-zinc-300 bg-white p-4">
          <h2 className="text-lg font-medium">{sectionName} Endpoints</h2>

          <div className="mt-3 grid gap-3">
            {groupedEndpoints[sectionName].map((endpoint) => {
              const result = results[endpoint.id];

              return (
                <article key={endpoint.id} className="rounded border border-zinc-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border px-2 py-0.5 text-xs font-semibold">
                      {endpoint.method}
                    </span>
                    <span className="rounded border px-2 py-0.5 text-xs">
                      {endpoint.auth}
                    </span>
                    {endpoint.isDangerous ? (
                      <span className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                        dangerous
                      </span>
                    ) : null}
                    <h3 className="text-sm font-medium">{endpoint.label}</h3>
                  </div>

                  <p className="mt-1 font-mono text-xs text-zinc-600">
                    {endpointPathPreview(endpoint, state)}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                    <span>Expected: {endpoint.expectedStatus.join(", ")}</span>
                    {result ? (
                      <>
                        <span>-</span>
                        <span>Status: {result.status}</span>
                        <span>-</span>
                        <span>{result.ok ? "PASS" : "FAIL"}</span>
                        <span>-</span>
                        <span>{result.durationMs}ms</span>
                      </>
                    ) : null}
                  </div>

                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        void runEndpoint(endpoint);
                      }}
                      disabled={runningEndpointId !== null}
                      className="rounded border px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-60"
                    >
                      {runningEndpointId === endpoint.id ? "Running..." : "Run"}
                    </button>
                  </div>

                  {result ? (
                    <pre className="mt-3 max-h-52 overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-100">
                      {shortJson(result.body)}
                    </pre>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
