"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  AuthenticatedActor,
  clearStoredSession,
  fetchActorFromSession,
  loadStoredSession,
  toAuthHeader,
} from "@/app/ui/auth-session";
import { SiteBanner } from "@/app/ui/site-banner";

type ApiError = {
  code: string;
  message: string;
};

type ApiSuccess<T, M = Record<string, unknown>> = {
  success: true;
  data: T;
  meta?: M;
};

type ApiFailure = {
  success: false;
  error: ApiError;
};

type RequestResult<T, M = Record<string, unknown>> =
  | {
      ok: true;
      data: T;
      meta?: M;
      status: number;
    }
  | {
      ok: false;
      message: string;
      code?: string;
      status: number;
    };

type CompanyStatus = "pending" | "active" | "inactive" | "rejected";
type CompanyLegalType = "sarl" | "startup";

type AdminCompany = {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  company_type: CompanyLegalType;
  sector: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  status: CompanyStatus;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

type ContactMessage = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  message: string;
  is_handled: boolean;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
};

type SiteRequestStatus = "new" | "in_progress" | "closed";

type SiteRequest = {
  id: string;
  company_name: string;
  sector: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  needs: string;
  status: SiteRequestStatus;
  admin_notes: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
};

type AdminApplicationStatus = "pending" | "shortlisted" | "rejected" | "hired";

type AdminApplication = {
  id: string;
  job_offer_id: string;
  company_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  cover_letter: string | null;
  coverLetterText?: string | null;
  motivationLetterPath?: string | null;
  cv_path: string | null;
  cv_file_name: string | null;
  status: AdminApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  company: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
  job: {
    id: string;
    title: string;
    contract_type: string | null;
    location_city: string | null;
    status: string;
  } | null;
};

type CompanyCreateForm = {
  owner_user_id: string;
  name: string;
  slug: string;
  company_type: CompanyLegalType;
  sector: string;
  description: string;
  city: string;
  country: string;
  status: CompanyStatus;
  is_featured: boolean;
};

const EMPTY_COMPANY_CREATE_FORM: CompanyCreateForm = {
  owner_user_id: "",
  name: "",
  slug: "",
  company_type: "sarl",
  sector: "",
  description: "",
  city: "",
  country: "",
  status: "pending",
  is_featured: false,
};

function isApiSuccess<T, M = Record<string, unknown>>(
  value: unknown
): value is ApiSuccess<T, M> {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    (value as { success: unknown }).success === true
  );
}

function isApiFailure(value: unknown): value is ApiFailure {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    (value as { success: unknown }).success === false
  );
}

async function requestApi<T, M = Record<string, unknown>>(
  path: string,
  init?: RequestInit
): Promise<RequestResult<T, M>> {
  try {
    const response = await fetch(path, init);
    const raw = await response.text();

    let payload: unknown;
    try {
      payload = raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return {
        ok: false,
        message: `Reponse non JSON pour ${path}`,
        status: response.status,
      };
    }

    if (isApiSuccess<T, M>(payload)) {
      return {
        ok: true,
        data: payload.data,
        meta: payload.meta,
        status: response.status,
      };
    }

    if (isApiFailure(payload)) {
      return {
        ok: false,
        message: payload.error.message,
        code: payload.error.code,
        status: response.status,
      };
    }

    return {
      ok: false,
      message: "Reponse API invalide.",
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erreur reseau inattendue.",
      status: 0,
    };
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("fr-FR");
}

export default function EspaceAdminPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [dataLoading, setDataLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [siteRequests, setSiteRequests] = useState<SiteRequest[]>([]);
  const [applications, setApplications] = useState<AdminApplication[]>([]);

  const [companyCreateForm, setCompanyCreateForm] = useState<CompanyCreateForm>(
    EMPTY_COMPANY_CREATE_FORM
  );
  const [companyFeedback, setCompanyFeedback] = useState<string | null>(null);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [busyCompanyId, setBusyCompanyId] = useState<string | null>(null);

  const [statusDrafts, setStatusDrafts] = useState<Record<string, CompanyStatus>>({});
  const [typeDrafts, setTypeDrafts] = useState<Record<string, CompanyLegalType>>({});
  const [featuredDrafts, setFeaturedDrafts] = useState<Record<string, boolean>>({});

  const [adminCvFeedback, setAdminCvFeedback] = useState<string | null>(null);
  const [busyAdminApplicationId, setBusyAdminApplicationId] = useState<string | null>(
    null
  );
  const [busyAdminMotivationId, setBusyAdminMotivationId] = useState<string | null>(
    null
  );
  const [selectedCompany, setSelectedCompany] = useState<AdminCompany | null>(null);

  const pendingCompanies = useMemo(
    () => companies.filter((item) => item.status === "pending").length,
    [companies]
  );

  const unhandledContacts = useMemo(
    () => contactMessages.filter((item) => !item.is_handled).length,
    [contactMessages]
  );

  const newSiteRequests = useMemo(
    () => siteRequests.filter((item) => item.status === "new").length,
    [siteRequests]
  );

  const applicationsCount = useMemo(() => applications.length, [applications]);

  const noDashboardData = useMemo(
    () =>
      !dataLoading &&
      !dashboardError &&
      companies.length === 0 &&
      contactMessages.length === 0 &&
      siteRequests.length === 0 &&
      applications.length === 0,
    [applications.length, companies.length, contactMessages.length, dashboardError, dataLoading, siteRequests.length]
  );

  const dashboardCompanies = useMemo(() => companies.slice(0, 6), [companies]);
  const dashboardApplications = useMemo(() => applications.slice(0, 6), [applications]);

  const loadDashboardData = useCallback(async (token: string) => {
    setDataLoading(true);
    setDashboardError(null);

    const headers = toAuthHeader(token);

    const [companiesResult, contactsResult, requestsResult, applicationsResult] =
      await Promise.all([
      requestApi<AdminCompany[]>("/api/admin/companies?limit=100&sort=newest", {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      requestApi<ContactMessage[]>(
        "/api/admin/contact-messages?limit=20&sort=newest",
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      ),
      requestApi<SiteRequest[]>("/api/admin/site-requests?limit=20&sort=newest", {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      requestApi<AdminApplication[]>(
        "/api/admin/applications?limit=30&sort=newest",
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      ),
    ]);

    let firstError: string | null = null;

    if (companiesResult.ok) {
      setCompanies(companiesResult.data);
      setStatusDrafts(
        Object.fromEntries(companiesResult.data.map((item) => [item.id, item.status]))
      );
      setTypeDrafts(
        Object.fromEntries(companiesResult.data.map((item) => [item.id, item.company_type]))
      );
      setFeaturedDrafts(
        Object.fromEntries(
          companiesResult.data.map((item) => [item.id, item.is_featured])
        )
      );
    } else {
      setCompanies([]);
      setStatusDrafts({});
      setTypeDrafts({});
      setFeaturedDrafts({});
      firstError = firstError ?? companiesResult.message;
    }

    if (contactsResult.ok) {
      setContactMessages(contactsResult.data);
    } else {
      setContactMessages([]);
      firstError = firstError ?? contactsResult.message;
    }

    if (requestsResult.ok) {
      setSiteRequests(requestsResult.data);
    } else {
      setSiteRequests([]);
      firstError = firstError ?? requestsResult.message;
    }

    if (applicationsResult.ok) {
      setApplications(applicationsResult.data);
    } else {
      setApplications([]);
      firstError = firstError ?? applicationsResult.message;
    }

    setDashboardError(firstError);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const session = loadStoredSession();
      if (!session) {
        router.replace("/login?next=/espace-admin");
        return;
      }

      const currentActor = await fetchActorFromSession(session);
      if (!active) {
        return;
      }

      if (!currentActor) {
        clearStoredSession();
        router.replace("/login?next=/espace-admin");
        return;
      }

      if (currentActor.role !== "super_admin") {
        setAuthError("Acces reserve au super administrateur.");
        setActor(currentActor);
        setAccessToken(currentActor.accessToken);
        setAuthLoading(false);
        return;
      }

      setActor(currentActor);
      setAccessToken(currentActor.accessToken);
      setAuthLoading(false);

      await loadDashboardData(currentActor.accessToken);
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadDashboardData, router]);

  const handleCreateCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    const ownerUserId = companyCreateForm.owner_user_id.trim();
    const name = companyCreateForm.name.trim();
    const slug = companyCreateForm.slug.trim();

    if (!ownerUserId || !name || !slug) {
      setCompanyFeedback("owner_user_id, name et slug sont obligatoires.");
      return;
    }

    setIsCreatingCompany(true);
    setCompanyFeedback(null);

    const result = await requestApi<AdminCompany>("/api/admin/companies", {
      method: "POST",
      headers: {
        ...toAuthHeader(accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        owner_user_id: ownerUserId,
        name,
        slug,
        company_type: companyCreateForm.company_type,
        sector: companyCreateForm.sector.trim() || null,
        description: companyCreateForm.description.trim() || null,
        city: companyCreateForm.city.trim() || null,
        country: companyCreateForm.country.trim() || null,
        status: companyCreateForm.status,
        is_featured: companyCreateForm.is_featured,
      }),
    });

    if (!result.ok) {
      setCompanyFeedback(result.message);
      setIsCreatingCompany(false);
      return;
    }

    setCompanyFeedback("Compte societe cree avec succes.");
    setCompanyCreateForm(EMPTY_COMPANY_CREATE_FORM);
    await loadDashboardData(accessToken);
    setIsCreatingCompany(false);
  };

  const handleSaveCompanyRow = async (companyId: string) => {
    if (!accessToken) {
      return;
    }

    setBusyCompanyId(companyId);
    setCompanyFeedback(null);

    const result = await requestApi<AdminCompany>(
      `/api/admin/companies/${encodeURIComponent(companyId)}`,
      {
        method: "PATCH",
        headers: {
          ...toAuthHeader(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: statusDrafts[companyId],
          company_type: typeDrafts[companyId],
          is_featured: Boolean(featuredDrafts[companyId]),
        }),
      }
    );

    if (!result.ok) {
      setCompanyFeedback(result.message);
      setBusyCompanyId(null);
      return;
    }

    setCompanyFeedback("Societe mise a jour.");
    await loadDashboardData(accessToken);
    setBusyCompanyId(null);
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!accessToken) {
      return;
    }

    setBusyCompanyId(companyId);
    setCompanyFeedback(null);

    const result = await requestApi<{ id: string; deleted: boolean }>(
      `/api/admin/companies/${encodeURIComponent(companyId)}`,
      {
        method: "DELETE",
        headers: toAuthHeader(accessToken),
      }
    );

    if (!result.ok) {
      setCompanyFeedback(result.message);
      setBusyCompanyId(null);
      return;
    }

    setCompanyFeedback("Societe supprimee.");
    await loadDashboardData(accessToken);
    setBusyCompanyId(null);
  };

  const handleOpenAdminCv = async (applicationId: string) => {
    if (!accessToken) {
      return;
    }

    const currentApplication = applications.find((item) => item.id === applicationId);
    if (currentApplication && !currentApplication.cv_path) {
      setAdminCvFeedback("Aucun CV disponible pour cette candidature.");
      return;
    }

    setAdminCvFeedback(null);
    setBusyAdminApplicationId(applicationId);

    const result = await requestApi<{ download_url: string }>(
      `/api/admin/applications/${encodeURIComponent(applicationId)}/cv`,
      {
        method: "GET",
        headers: toAuthHeader(accessToken),
      }
    );

    if (!result.ok) {
      setAdminCvFeedback(result.message);
      setBusyAdminApplicationId(null);
      return;
    }

    window.open(result.data.download_url, "_blank", "noopener,noreferrer");
    setAdminCvFeedback("CV ouvert dans un nouvel onglet.");
    setBusyAdminApplicationId(null);
  };

  const handleOpenAdminMotivation = async (applicationId: string) => {
    if (!accessToken) {
      return;
    }

    setAdminCvFeedback(null);
    setBusyAdminMotivationId(applicationId);

    const result = await requestApi<{ download_url: string }>(
      `/api/admin/applications/${encodeURIComponent(applicationId)}/motivation-letter`,
      {
        method: "GET",
        headers: toAuthHeader(accessToken),
      }
    );

    if (!result.ok) {
      setAdminCvFeedback(result.message);
      setBusyAdminMotivationId(null);
      return;
    }

    window.open(result.data.download_url, "_blank", "noopener,noreferrer");
    setAdminCvFeedback("Lettre de motivation ouverte dans un nouvel onglet.");
    setBusyAdminMotivationId(null);
  };

  const handleLogout = () => {
    clearStoredSession();
    router.push("/login");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#05070d] text-slate-100">
        <SiteBanner />
        <main className="mx-auto w-full max-w-[92rem] px-[var(--page-gutter)] py-10">
          <p className="text-sm text-slate-300">Chargement de l espace super admin...</p>
        </main>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-[#05070d] text-slate-100">
        <SiteBanner />
        <main className="mx-auto w-full max-w-[92rem] px-[var(--page-gutter)] py-10">
          <section className="rounded-3xl border border-rose-500/40 bg-rose-950/20 p-6">
            <h1 className="text-2xl font-black text-white">Acces refuse</h1>
            <p className="mt-2 text-sm text-rose-200">{authError}</p>
            {actor?.role === "entreprise" ? (
              <Link
                href="/espace-entreprise"
                className="mt-4 inline-flex rounded-full border border-yellow-500 px-4 py-2 text-sm font-semibold text-yellow-300"
              >
                Ouvrir l espace entreprise
              </Link>
            ) : null}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <SiteBanner />

      <main className="mx-auto flex w-full max-w-[92rem] flex-col gap-6 px-[var(--page-gutter)] py-8 md:py-10">
        <section className="rounded-3xl border border-[#223059] bg-[#0a1120] p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-yellow-300">Super admin</p>
              <h1 className="mt-1 text-3xl font-black text-white md:text-4xl">
                Dashboard global
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Connecte en tant que {actor?.fullName || actor?.email || "admin"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-[#2a3a68] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300"
            >
              Deconnexion
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-5">
            <article className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
              <p className="text-xs text-slate-400">Societes total</p>
              <p className="mt-1 text-2xl font-black text-white">{companies.length}</p>
            </article>
            <article className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
              <p className="text-xs text-slate-400">Societes en attente</p>
              <p className="mt-1 text-2xl font-black text-white">{pendingCompanies}</p>
            </article>
            <article className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
              <p className="text-xs text-slate-400">Messages contact non traites</p>
              <p className="mt-1 text-2xl font-black text-white">{unhandledContacts}</p>
            </article>
            <article className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
              <p className="text-xs text-slate-400">Demandes site nouvelles</p>
              <p className="mt-1 text-2xl font-black text-white">{newSiteRequests}</p>
            </article>
            <article className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
              <p className="text-xs text-slate-400">Candidatures recues</p>
              <p className="mt-1 text-2xl font-black text-white">{applicationsCount}</p>
            </article>
          </div>

          {dashboardError ? (
            <p className="mt-4 rounded-2xl border border-yellow-500/50 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-200">
              {dashboardError}
            </p>
          ) : null}

          {dataLoading ? (
            <p className="mt-4 text-sm text-slate-400">Chargement du dashboard...</p>
          ) : null}

          {noDashboardData ? (
            <p className="mt-4 rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-slate-300">
              Aucune donnee admin trouvee. Verifiez le seed de la base ou la variable SUPABASE_SERVICE_ROLE_KEY.
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
          <h2 className="text-2xl font-black text-white">Creer un compte societe</h2>
          <p className="mt-2 text-sm text-slate-300">
            Le compte entreprise est cree et affecte par l administration.
          </p>

          <form onSubmit={handleCreateCompany} className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              required
              value={companyCreateForm.owner_user_id}
              onChange={(event) => {
                setCompanyCreateForm((current) => ({
                  ...current,
                  owner_user_id: event.target.value,
                }));
              }}
              placeholder="owner_user_id (UUID)"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            />
            <input
              required
              value={companyCreateForm.name}
              onChange={(event) => {
                setCompanyCreateForm((current) => ({
                  ...current,
                  name: event.target.value,
                }));
              }}
              placeholder="Nom societe"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            />
            <input
              required
              value={companyCreateForm.slug}
              onChange={(event) => {
                setCompanyCreateForm((current) => ({
                  ...current,
                  slug: event.target.value,
                }));
              }}
              placeholder="slug-societe"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            />
            <select
              value={companyCreateForm.company_type}
              onChange={(event) => {
                setCompanyCreateForm((current) => ({
                  ...current,
                  company_type: event.target.value as CompanyLegalType,
                }));
              }}
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            >
              <option value="sarl">SARL</option>
              <option value="startup">Startup</option>
            </select>
            <input
              value={companyCreateForm.sector}
              onChange={(event) => {
                setCompanyCreateForm((current) => ({
                  ...current,
                  sector: event.target.value,
                }));
              }}
              placeholder="Secteur"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            />
            <input
              value={companyCreateForm.city}
              onChange={(event) => {
                setCompanyCreateForm((current) => ({
                  ...current,
                  city: event.target.value,
                }));
              }}
              placeholder="Ville"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            />
            <input
              value={companyCreateForm.country}
              onChange={(event) => {
                setCompanyCreateForm((current) => ({
                  ...current,
                  country: event.target.value,
                }));
              }}
              placeholder="Pays"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            />
            <select
              value={companyCreateForm.status}
              onChange={(event) => {
                setCompanyCreateForm((current) => ({
                  ...current,
                  status: event.target.value as CompanyStatus,
                }));
              }}
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            >
              <option value="pending">pending</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="rejected">rejected</option>
            </select>
            <label className="flex items-center gap-3 rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white">
              <input
                type="checkbox"
                checked={companyCreateForm.is_featured}
                onChange={(event) => {
                  setCompanyCreateForm((current) => ({
                    ...current,
                    is_featured: event.target.checked,
                  }));
                }}
              />
              Mise en avant
            </label>
            <textarea
              rows={4}
              value={companyCreateForm.description}
              onChange={(event) => {
                setCompanyCreateForm((current) => ({
                  ...current,
                  description: event.target.value,
                }));
              }}
              placeholder="Description"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400 md:col-span-2"
            />

            <button
              type="submit"
              disabled={isCreatingCompany}
              className="rounded-full border border-yellow-500 bg-yellow-500 px-6 py-3 text-sm font-black text-[#05070d] transition hover:bg-yellow-400 disabled:opacity-60 md:col-span-2"
            >
              {isCreatingCompany ? "Creation..." : "Creer la societe"}
            </button>
          </form>

          {companyFeedback ? (
            <p className="mt-3 rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-slate-200">
              {companyFeedback}
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-white">Societes (apercu limite)</h2>
            <Link
              href="/espace-admin/entreprises"
              className="rounded-full border border-yellow-500 px-4 py-2 text-xs font-semibold text-yellow-300"
            >
              Voir plus ({companies.length})
            </Link>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Affichage des 6 dernieres entreprises. Utilisez le lien Voir plus pour la liste complete.
          </p>
          <div className="mt-4 grid gap-4">
            {dashboardCompanies.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#2a3a68] px-4 py-8 text-sm text-slate-400">
                Aucune societe disponible.
              </p>
            ) : (
              dashboardCompanies.map((company) => (
                <article
                  key={company.id}
                  className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-white">{company.name}</h3>
                      <p className="mt-1 text-xs text-slate-300">slug: {company.slug}</p>
                      <p className="mt-1 text-xs text-slate-300">
                        Type: {company.company_type === "startup" ? "Startup" : "SARL"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        owner_user_id: {company.owner_user_id}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400">MAJ: {formatDate(company.updated_at)}</p>
                  </div>

                  <p className="mt-3 text-sm text-slate-300 line-clamp-2">
                    {company.description || "Aucune description fournie."}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCompany(company);
                      }}
                      className="rounded-full border border-[#2a3a68] px-4 py-1.5 text-xs font-semibold text-slate-100"
                    >
                      Voir plus
                    </button>

                    <select
                      value={statusDrafts[company.id] ?? company.status}
                      onChange={(event) => {
                        setStatusDrafts((current) => ({
                          ...current,
                          [company.id]: event.target.value as CompanyStatus,
                        }));
                      }}
                      className="rounded-full border border-[#2a3a68] bg-[#0f1830] px-3 py-1.5 text-xs text-white"
                    >
                      <option value="pending">pending</option>
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                      <option value="rejected">rejected</option>
                    </select>

                    <select
                      value={typeDrafts[company.id] ?? company.company_type}
                      onChange={(event) => {
                        setTypeDrafts((current) => ({
                          ...current,
                          [company.id]: event.target.value as CompanyLegalType,
                        }));
                      }}
                      className="rounded-full border border-[#2a3a68] bg-[#0f1830] px-3 py-1.5 text-xs text-white"
                    >
                      <option value="sarl">SARL</option>
                      <option value="startup">Startup</option>
                    </select>

                    <label className="flex items-center gap-2 text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(featuredDrafts[company.id])}
                        onChange={(event) => {
                          setFeaturedDrafts((current) => ({
                            ...current,
                            [company.id]: event.target.checked,
                          }));
                        }}
                      />
                      Featured
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        void handleSaveCompanyRow(company.id);
                      }}
                      disabled={busyCompanyId === company.id}
                      className="rounded-full border border-yellow-500 px-4 py-1.5 text-xs font-semibold text-yellow-300 disabled:opacity-60"
                    >
                      Enregistrer
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteCompany(company.id);
                      }}
                      disabled={busyCompanyId === company.id}
                      className="rounded-full border border-rose-500/70 px-4 py-1.5 text-xs font-semibold text-rose-200 disabled:opacity-60"
                    >
                      Supprimer
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-white">Candidatures recues (sans UUID)</h2>
            <Link
              href="/espace-admin/candidatures"
              className="rounded-full border border-yellow-500 px-4 py-2 text-xs font-semibold text-yellow-300"
            >
              Voir plus ({applications.length})
            </Link>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Affichage des 6 dernieres candidatures. Ouvrez la page Voir plus pour la liste complete.
          </p>

          {adminCvFeedback ? (
            <p className="mt-3 rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-slate-200">
              {adminCvFeedback}
            </p>
          ) : null}

          <div className="mt-4 grid gap-4">
            {dashboardApplications.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#2a3a68] px-4 py-8 text-sm text-slate-400">
                Aucune candidature disponible.
              </p>
            ) : (
              dashboardApplications.map((application) => {
                const coverLetterText =
                  application.coverLetterText ?? application.cover_letter ?? null;
                const hasMotivationFile = Boolean(application.motivationLetterPath);

                return (
                  <article
                    key={application.id}
                    className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-black text-white">
                          {application.candidate_name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-300">
                          {application.candidate_email}
                          {application.candidate_phone ? ` • ${application.candidate_phone}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Entreprise: {application.company?.name || "Societe inconnue"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Poste: {application.job?.title || "Offre inconnue"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Recue le {formatDate(application.created_at)} • ID: {application.id}
                        </p>
                      </div>
                      <span className="rounded-full border border-yellow-500/70 px-3 py-1 text-xs font-semibold text-yellow-300">
                        {application.status}
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-slate-400">
                      CV: {application.cv_file_name || "fichier non nomme"}
                    </p>

                    {coverLetterText ? (
                      <div className="mt-3 rounded-2xl border border-[#2a3a68] bg-[#0f1830] p-3">
                        <p className="text-xs font-semibold text-slate-300">
                          Lettre de motivation (texte)
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                          {coverLetterText}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">
                        Aucun texte de motivation.
                      </p>
                    )}

                    {hasMotivationFile ? (
                      <p className="mt-2 text-xs text-slate-400">
                        Fichier lettre: {application.motivationLetterPath}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void handleOpenAdminCv(application.id);
                        }}
                        disabled={
                          busyAdminApplicationId === application.id || !application.cv_path
                        }
                        className="rounded-full border border-yellow-500 px-4 py-1.5 text-xs font-semibold text-yellow-300 disabled:opacity-60"
                      >
                        {busyAdminApplicationId === application.id
                          ? "Ouverture..."
                          : application.cv_path
                            ? "Ouvrir CV"
                            : "CV indisponible"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void handleOpenAdminMotivation(application.id);
                        }}
                        disabled={!hasMotivationFile || busyAdminMotivationId === application.id}
                        className="rounded-full border border-[#2a3a68] px-4 py-1.5 text-xs font-semibold text-slate-100 disabled:opacity-60"
                      >
                        {busyAdminMotivationId === application.id
                          ? "Ouverture..."
                          : hasMotivationFile
                            ? "Ouvrir lettre"
                            : "Lettre indisponible"}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
            <h2 className="text-xl font-black text-white">Messages contact recents</h2>
            <div className="mt-4 space-y-3">
              {contactMessages.length === 0 ? (
                <p className="text-sm text-slate-400">Aucun message.</p>
              ) : (
                contactMessages.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-3"
                  >
                    <p className="text-sm font-bold text-white">{item.full_name}</p>
                    <p className="text-xs text-slate-300">{item.email}</p>
                    <p className="mt-1 text-xs text-slate-400 line-clamp-3">{item.message}</p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
            <h2 className="text-xl font-black text-white">Demandes creation de site</h2>
            <div className="mt-4 space-y-3">
              {siteRequests.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune demande.</p>
              ) : (
                siteRequests.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-white">{item.company_name}</p>
                      <span className="rounded-full border border-yellow-500/70 px-2 py-0.5 text-[10px] font-semibold text-yellow-300">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{item.contact_name} • {item.email}</p>
                    <p className="mt-1 text-xs text-slate-400 line-clamp-3">{item.needs}</p>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        {selectedCompany ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070d]/85 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl border border-[#2a3a68] bg-[#0b1428] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-yellow-300">
                    Fiche entreprise
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-white">{selectedCompany.name}</h3>
                  <p className="mt-1 text-xs text-slate-300">slug: {selectedCompany.slug}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCompany(null);
                  }}
                  className="rounded-full border border-[#2a3a68] px-3 py-1.5 text-xs font-semibold text-slate-100"
                >
                  Fermer
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <p className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-xs text-slate-300">
                  Statut: <span className="font-semibold text-white">{selectedCompany.status}</span>
                </p>
                <p className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-xs text-slate-300">
                  Type: <span className="font-semibold text-white">{selectedCompany.company_type === "startup" ? "Startup" : "SARL"}</span>
                </p>
                <p className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-xs text-slate-300">
                  Secteur: <span className="font-semibold text-white">{selectedCompany.sector || "-"}</span>
                </p>
                <p className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-xs text-slate-300">
                  Ville: <span className="font-semibold text-white">{selectedCompany.city || "-"}</span>
                </p>
                <p className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-xs text-slate-300">
                  Pays: <span className="font-semibold text-white">{selectedCompany.country || "-"}</span>
                </p>
              </div>

              <p className="mt-4 rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-xs text-slate-300">
                owner_user_id: {selectedCompany.owner_user_id}
              </p>

              <div className="mt-4 rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
                <h4 className="text-sm font-bold text-white">Description complete</h4>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                  {selectedCompany.description || "Aucune description fournie."}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <p>Creee le {formatDate(selectedCompany.created_at)}</p>
                <p>Mise a jour le {formatDate(selectedCompany.updated_at)}</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`/entreprises/${selectedCompany.slug}`}
                  target="_blank"
                  className="rounded-full border border-yellow-500 px-4 py-2 text-xs font-semibold text-yellow-300"
                >
                  Ouvrir la page publique
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
