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

type PaginationMeta = {
  total?: number;
};

type DashboardStats = {
  totalJobs: number;
  publishedJobs: number;
  pendingApplications: number;
  totalApplications: number;
};

type JobStatus = "draft" | "published" | "closed";

type ApplicationStatus = "pending" | "shortlisted" | "rejected" | "hired";
type CompanyLegalType = "sarl" | "startup";

type CompanyProfile = {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  company_type: CompanyLegalType;
  sector: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  logo_url: string | null;
  cover_url: string | null;
  status: string;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

type CompanyJob = {
  id: string;
  company_id: string;
  title: string;
  description: string;
  contract_type: string | null;
  location_city: string | null;
  salary_min: number | null;
  salary_max: number | null;
  is_remote: boolean;
  status: JobStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type CompanyApplication = {
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
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  job: {
    id: string;
    title: string;
    contract_type: string | null;
    location_city: string | null;
    status: string;
  } | null;
};

type ProfileFormState = {
  name: string;
  slug: string;
  company_type: CompanyLegalType;
  sector: string;
  description: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website_url: string;
  logo_url: string;
  cover_url: string;
};

type JobFormState = {
  title: string;
  description: string;
  contract_type: string;
  location_city: string;
  salary_min: string;
  salary_max: string;
  is_remote: boolean;
  status: JobStatus;
};

const EMPTY_PROFILE_FORM: ProfileFormState = {
  name: "",
  slug: "",
  company_type: "sarl",
  sector: "",
  description: "",
  address: "",
  city: "",
  country: "",
  phone: "",
  email: "",
  website_url: "",
  logo_url: "",
  cover_url: "",
};

const EMPTY_JOB_FORM: JobFormState = {
  title: "",
  description: "",
  contract_type: "",
  location_city: "",
  salary_min: "",
  salary_max: "",
  is_remote: false,
  status: "draft",
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

function toProfileForm(profile: CompanyProfile): ProfileFormState {
  return {
    name: profile.name,
    slug: profile.slug,
    company_type: profile.company_type,
    sector: profile.sector ?? "",
    description: profile.description ?? "",
    address: profile.address ?? "",
    city: profile.city ?? "",
    country: profile.country ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    website_url: profile.website_url ?? "",
    logo_url: profile.logo_url ?? "",
    cover_url: profile.cover_url ?? "",
  };
}

function toJobForm(job: CompanyJob): JobFormState {
  return {
    title: job.title,
    description: job.description,
    contract_type: job.contract_type ?? "",
    location_city: job.location_city ?? "",
    salary_min: job.salary_min !== null ? String(job.salary_min) : "",
    salary_max: job.salary_max !== null ? String(job.salary_max) : "",
    is_remote: job.is_remote,
    status: job.status,
  };
}

function parseNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("fr-FR");
}

function getMetaTotal(meta?: PaginationMeta): number | null {
  return typeof meta?.total === "number" ? meta.total : null;
}

export default function EspaceEntreprisePage() {
  const router = useRouter();
  const isStatsDebugEnabled = process.env.NODE_ENV !== "production";

  const [authLoading, setAuthLoading] = useState(true);
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [dataLoading, setDataLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(EMPTY_PROFILE_FORM);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [jobs, setJobs] = useState<CompanyJob[]>([]);
  const [jobForm, setJobForm] = useState<JobFormState>(EMPTY_JOB_FORM);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobFeedback, setJobFeedback] = useState<string | null>(null);
  const [isSavingJob, setIsSavingJob] = useState(false);

  const [applications, setApplications] = useState<CompanyApplication[]>([]);
  const [applicationFeedback, setApplicationFeedback] = useState<string | null>(null);
  const [busyApplicationId, setBusyApplicationId] = useState<string | null>(null);
  const [busyMotivationId, setBusyMotivationId] = useState<string | null>(null);

  const [statusDrafts, setStatusDrafts] = useState<Record<string, ApplicationStatus>>({});
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    publishedJobs: 0,
    pendingApplications: 0,
    totalApplications: 0,
  });
  const [statsDebugLines, setStatsDebugLines] = useState<string[]>([]);
  const [statsDebugTimestamp, setStatsDebugTimestamp] = useState<string | null>(null);

  const noDashboardData = useMemo(
    () =>
      !dataLoading &&
      !dashboardError &&
      stats.totalJobs === 0 &&
      stats.publishedJobs === 0 &&
      stats.pendingApplications === 0 &&
      stats.totalApplications === 0,
    [
      dashboardError,
      dataLoading,
      stats.pendingApplications,
      stats.publishedJobs,
      stats.totalApplications,
      stats.totalJobs,
    ]
  );

  const dashboardApplications = useMemo(() => applications.slice(0, 6), [applications]);

  const loadDashboardData = useCallback(async (token: string) => {
    setDataLoading(true);
    setDashboardError(null);

    if (isStatsDebugEnabled) {
      setStatsDebugLines(["Chargement des statistiques entreprise..."]);
      setStatsDebugTimestamp(new Date().toLocaleString("fr-FR"));
    }

    const headers = toAuthHeader(token);

    const [
      profileResult,
      jobsResult,
      applicationsResult,
      totalJobsResult,
      publishedJobsResult,
      pendingApplicationsResult,
    ] = await Promise.all([
      requestApi<CompanyProfile>("/api/company/profile", {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      requestApi<CompanyJob[], PaginationMeta>("/api/company/jobs?limit=100&sort=newest", {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      requestApi<CompanyApplication[], PaginationMeta>(
        "/api/company/applications?limit=100&sort=newest",
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      ),
      requestApi<CompanyJob[], PaginationMeta>("/api/company/jobs?limit=1&sort=newest", {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      requestApi<CompanyJob[], PaginationMeta>(
        "/api/company/jobs?limit=1&sort=newest&status=published",
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      ),
      requestApi<CompanyApplication[], PaginationMeta>(
        "/api/company/applications?limit=1&sort=newest&status=pending",
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      ),
    ]);

    let firstError: string | null = null;

    if (profileResult.ok) {
      setProfile(profileResult.data);
      setProfileForm(toProfileForm(profileResult.data));
    } else if (profileResult.status === 404) {
      setProfile(null);
      setProfileForm(EMPTY_PROFILE_FORM);
      firstError =
        firstError ??
        "Votre compte entreprise n est pas encore lie a une fiche societe. L administrateur doit creer et affecter le compte.";
    } else {
      firstError = firstError ?? profileResult.message;
    }

    if (jobsResult.ok) {
      setJobs(jobsResult.data);
    } else {
      firstError = firstError ?? jobsResult.message;
      setJobs([]);
    }

    if (applicationsResult.ok) {
      setApplications(applicationsResult.data);
      setStatusDrafts(
        Object.fromEntries(
          applicationsResult.data.map((item) => [item.id, item.status])
        )
      );
    } else {
      firstError = firstError ?? applicationsResult.message;
      setApplications([]);
      setStatusDrafts({});
    }

    const totalJobs = totalJobsResult.ok
      ? (getMetaTotal(totalJobsResult.meta) ?? (jobsResult.ok ? jobsResult.data.length : 0))
      : jobsResult.ok
        ? jobsResult.data.length
        : 0;

    const publishedJobs = publishedJobsResult.ok
      ? (getMetaTotal(publishedJobsResult.meta) ?? (jobsResult.ok
        ? jobsResult.data.filter((item) => item.status === "published").length
        : 0))
      : jobsResult.ok
        ? jobsResult.data.filter((item) => item.status === "published").length
        : 0;

    const pendingApplications = pendingApplicationsResult.ok
      ? (getMetaTotal(pendingApplicationsResult.meta) ?? (applicationsResult.ok
        ? applicationsResult.data.filter((item) => item.status === "pending").length
        : 0))
      : applicationsResult.ok
        ? applicationsResult.data.filter((item) => item.status === "pending").length
        : 0;

    const totalApplications = applicationsResult.ok
      ? (getMetaTotal(applicationsResult.meta) ?? applicationsResult.data.length)
      : 0;

    setStats({
      totalJobs,
      publishedJobs,
      pendingApplications,
      totalApplications,
    });

    if (isStatsDebugEnabled) {
      const debugLines = [
        `profile: ok=${profileResult.ok} status=${profileResult.status}`,
        `jobs list: ok=${jobsResult.ok} items=${jobsResult.ok ? jobsResult.data.length : 0} totalMeta=${jobsResult.ok ? (getMetaTotal(jobsResult.meta) ?? "n/a") : "n/a"}`,
        `applications list: ok=${applicationsResult.ok} items=${applicationsResult.ok ? applicationsResult.data.length : 0} totalMeta=${applicationsResult.ok ? (getMetaTotal(applicationsResult.meta) ?? "n/a") : "n/a"}`,
        `counts query: totalJobs=${totalJobs} publishedJobs=${publishedJobs} pendingApplications=${pendingApplications} totalApplications=${totalApplications}`,
        `dashboardError=${firstError ?? "none"}`,
      ];

      setStatsDebugLines(debugLines);
      setStatsDebugTimestamp(new Date().toLocaleString("fr-FR"));
      console.debug("[Entreprise dashboard stats debug]", {
        stats: {
          totalJobs,
          publishedJobs,
          pendingApplications,
          totalApplications,
        },
        sources: {
          profileResult,
          jobsResult,
          applicationsResult,
          totalJobsResult,
          publishedJobsResult,
          pendingApplicationsResult,
        },
        dashboardError: firstError,
      });
    }

    setDashboardError(firstError);
    setDataLoading(false);
  }, [isStatsDebugEnabled]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const session = loadStoredSession();
      if (!session) {
        router.replace("/login?next=/espace-entreprise");
        return;
      }

      const currentActor = await fetchActorFromSession(session);
      if (!active) {
        return;
      }

      if (!currentActor) {
        clearStoredSession();
        router.replace("/login?next=/espace-entreprise");
        return;
      }

      if (currentActor.role !== "entreprise") {
        setAuthError("Acces reserve aux comptes entreprise.");
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

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken || !profile) {
      return;
    }

    const name = profileForm.name.trim();
    const slug = profileForm.slug.trim();

    if (name.length < 2) {
      setProfileFeedback("Le nom de la societe doit contenir au moins 2 caracteres.");
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setProfileFeedback(
        "Le slug doit contenir uniquement des lettres minuscules, chiffres et tirets."
      );
      return;
    }

    setIsSavingProfile(true);
    setProfileFeedback(null);

    const result = await requestApi<CompanyProfile>("/api/company/profile", {
      method: "PATCH",
      headers: {
        ...toAuthHeader(accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        slug,
        company_type: profileForm.company_type,
        sector: profileForm.sector.trim() || null,
        description: profileForm.description.trim() || null,
        address: profileForm.address.trim() || null,
        city: profileForm.city.trim() || null,
        country: profileForm.country.trim() || null,
        phone: profileForm.phone.trim() || null,
        email: profileForm.email.trim() || null,
        website_url: profileForm.website_url.trim() || null,
        logo_url: profileForm.logo_url.trim() || null,
        cover_url: profileForm.cover_url.trim() || null,
      }),
    });

    if (result.ok) {
      setProfile(result.data);
      setProfileForm(toProfileForm(result.data));
      setProfileFeedback("Profil entreprise mis a jour.");
    } else {
      setProfileFeedback(result.message);
    }

    setIsSavingProfile(false);
  };

  const resetJobForm = () => {
    setJobForm(EMPTY_JOB_FORM);
    setEditingJobId(null);
  };

  const handleJobSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    const title = jobForm.title.trim();
    const description = jobForm.description.trim();

    if (title.length < 4 || description.length < 20) {
      setJobFeedback(
        "Le titre doit contenir au moins 4 caracteres et la description au moins 20 caracteres."
      );
      return;
    }

    setIsSavingJob(true);
    setJobFeedback(null);

    const payload = {
      title,
      description,
      contract_type: jobForm.contract_type.trim() || null,
      location_city: jobForm.location_city.trim() || null,
      salary_min: parseNumberOrNull(jobForm.salary_min),
      salary_max: parseNumberOrNull(jobForm.salary_max),
      is_remote: jobForm.is_remote,
      status: jobForm.status,
    };

    const path = editingJobId
      ? `/api/company/jobs/${encodeURIComponent(editingJobId)}`
      : "/api/company/jobs";

    const result = await requestApi<CompanyJob>(path, {
      method: editingJobId ? "PATCH" : "POST",
      headers: {
        ...toAuthHeader(accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (result.ok) {
      setJobFeedback(editingJobId ? "Offre mise a jour." : "Offre creee.");
      resetJobForm();
      await loadDashboardData(accessToken);
    } else {
      setJobFeedback(result.message);
    }

    setIsSavingJob(false);
  };

  const handleEditJob = (job: CompanyJob) => {
    setEditingJobId(job.id);
    setJobForm(toJobForm(job));
    setJobFeedback(null);
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!accessToken) {
      return;
    }

    setBusyApplicationId(null);
    setJobFeedback(null);

    const result = await requestApi<{ id: string; deleted: boolean }>(
      `/api/company/jobs/${encodeURIComponent(jobId)}`,
      {
        method: "DELETE",
        headers: toAuthHeader(accessToken),
      }
    );

    if (!result.ok) {
      setJobFeedback(result.message);
      return;
    }

    setJobFeedback("Offre supprimee.");
    await loadDashboardData(accessToken);
  };

  const handleApplicationStatusSave = async (applicationId: string) => {
    if (!accessToken) {
      return;
    }

    const nextStatus = statusDrafts[applicationId];
    if (!nextStatus) {
      return;
    }

    setBusyApplicationId(applicationId);
    setApplicationFeedback(null);

    const result = await requestApi<CompanyApplication>(
      `/api/company/applications/${encodeURIComponent(applicationId)}/status`,
      {
        method: "PATCH",
        headers: {
          ...toAuthHeader(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      }
    );

    if (!result.ok) {
      setApplicationFeedback(result.message);
      setBusyApplicationId(null);
      return;
    }

    setApplicationFeedback("Statut candidature mis a jour.");
    await loadDashboardData(accessToken);
    setBusyApplicationId(null);
  };

  const handleOpenCv = async (applicationId: string) => {
    if (!accessToken) {
      return;
    }

    const currentApplication = applications.find((item) => item.id === applicationId);
    if (currentApplication && !currentApplication.cv_path) {
      setApplicationFeedback("Aucun CV disponible pour cette candidature.");
      return;
    }

    setBusyApplicationId(applicationId);
    setApplicationFeedback(null);

    const result = await requestApi<{ download_url: string }>(
      `/api/company/applications/${encodeURIComponent(applicationId)}/cv`,
      {
        method: "GET",
        headers: toAuthHeader(accessToken),
      }
    );

    if (!result.ok) {
      setApplicationFeedback(result.message);
      setBusyApplicationId(null);
      return;
    }

    window.open(result.data.download_url, "_blank", "noopener,noreferrer");
    setBusyApplicationId(null);
  };

  const handleOpenMotivationLetter = async (applicationId: string) => {
    if (!accessToken) {
      return;
    }

    setApplicationFeedback(null);
    setBusyMotivationId(applicationId);

    const result = await requestApi<{ download_url: string }>(
      `/api/company/applications/${encodeURIComponent(applicationId)}/motivation-letter`,
      {
        method: "GET",
        headers: toAuthHeader(accessToken),
      }
    );

    if (!result.ok) {
      setApplicationFeedback(result.message);
      setBusyMotivationId(null);
      return;
    }

    window.open(result.data.download_url, "_blank", "noopener,noreferrer");
    setBusyMotivationId(null);
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
          <p className="text-sm text-slate-300">Chargement de l espace entreprise...</p>
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
            {actor?.role === "super_admin" ? (
              <Link
                href="/espace-admin"
                className="mt-4 inline-flex rounded-full border border-yellow-500 px-4 py-2 text-sm font-semibold text-yellow-300"
              >
                Ouvrir l espace super admin
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
              <p className="text-xs uppercase tracking-[0.12em] text-yellow-300">Espace entreprise</p>
              <h1 className="mt-1 text-3xl font-black text-white md:text-4xl">
                Pilotage de votre entreprise
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Connecte en tant que {actor?.fullName || actor?.email || "utilisateur"}
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

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <article className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
              <p className="text-xs text-slate-400">Offres total</p>
              <p className="mt-1 text-2xl font-black text-white">{stats.totalJobs}</p>
            </article>
            <article className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
              <p className="text-xs text-slate-400">Offres publiees</p>
              <p className="mt-1 text-2xl font-black text-white">{stats.publishedJobs}</p>
            </article>
            <article className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
              <p className="text-xs text-slate-400">Candidatures en attente</p>
              <p className="mt-1 text-2xl font-black text-white">{stats.pendingApplications}</p>
            </article>
            <article className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
              <p className="text-xs text-slate-400">Candidatures total</p>
              <p className="mt-1 text-2xl font-black text-white">{stats.totalApplications}</p>
            </article>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Navigation rapide:</span>
            <a
              href="#profil-entreprise"
              className="rounded-full border border-[#2a3a68] px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300"
            >
              Profil
            </a>
            <a
              href="#gestion-offres"
              className="rounded-full border border-[#2a3a68] px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300"
            >
              Offres
            </a>
            <a
              href="#candidatures-entreprise"
              className="rounded-full border border-[#2a3a68] px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300"
            >
              Candidatures
            </a>
          </div>

          {dashboardError ? (
            <p className="mt-4 rounded-2xl border border-yellow-500/50 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-200">
              {dashboardError}
            </p>
          ) : null}

          {dataLoading ? (
            <p className="mt-4 text-sm text-slate-400">Chargement des donnees...</p>
          ) : null}

          {noDashboardData ? (
            <p className="mt-4 rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-slate-300">
              Aucune statistique disponible pour le moment. Verifiez que votre compte est bien lie a une entreprise et qu il existe des offres/candidatures.
            </p>
          ) : null}

          {isStatsDebugEnabled ? (
            <details className="mt-4 rounded-2xl border border-cyan-500/40 bg-cyan-950/20 px-4 py-3 text-xs text-cyan-100">
              <summary className="cursor-pointer font-semibold">
                Debug stats entreprise (dev)
              </summary>
              <div className="mt-2 space-y-1">
                <p className="text-cyan-200">
                  Derniere mise a jour: {statsDebugTimestamp ?? "n/a"}
                </p>
                {statsDebugLines.length === 0 ? (
                  <p className="text-cyan-200">Aucune ligne de debug pour le moment.</p>
                ) : (
                  statsDebugLines.map((line, index) => (
                    <p
                      key={`entreprise-stats-debug-${index}`}
                      className="break-words text-cyan-100"
                    >
                      - {line}
                    </p>
                  ))
                )}
              </div>
            </details>
          ) : null}
        </section>

        {profile ? (
          <section
            id="profil-entreprise"
            className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-yellow-300">Identite entreprise</p>
            <h2 className="text-2xl font-black text-white">Profil entreprise</h2>
            <p className="mt-2 text-sm text-slate-300">
              Statut actuel: <span className="font-semibold text-yellow-300">{profile.status}</span>
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Type: <span className="font-semibold text-yellow-300">{profile.company_type === "startup" ? "Startup" : "SARL"}</span>
            </p>

            <form onSubmit={handleProfileSubmit} className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                required
                minLength={2}
                value={profileForm.name}
                onChange={(event) => {
                  setProfileForm((current) => ({ ...current, name: event.target.value }));
                }}
                placeholder="Nom entreprise"
                className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              />
              <input
                required
                value={profileForm.slug}
                onChange={(event) => {
                  setProfileForm((current) => ({ ...current, slug: event.target.value }));
                }}
                placeholder="slug-entreprise"
                className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              />
              <select
                value={profileForm.company_type}
                onChange={(event) => {
                  setProfileForm((current) => ({
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
                value={profileForm.sector}
                onChange={(event) => {
                  setProfileForm((current) => ({ ...current, sector: event.target.value }));
                }}
                placeholder="Secteur"
                className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              />
              <input
                value={profileForm.city}
                onChange={(event) => {
                  setProfileForm((current) => ({ ...current, city: event.target.value }));
                }}
                placeholder="Ville"
                className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              />
              <input
                value={profileForm.country}
                onChange={(event) => {
                  setProfileForm((current) => ({ ...current, country: event.target.value }));
                }}
                placeholder="Pays"
                className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              />
              <input
                value={profileForm.phone}
                onChange={(event) => {
                  setProfileForm((current) => ({ ...current, phone: event.target.value }));
                }}
                placeholder="Telephone"
                className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              />
              <input
                type="email"
                value={profileForm.email}
                onChange={(event) => {
                  setProfileForm((current) => ({ ...current, email: event.target.value }));
                }}
                placeholder="Email"
                className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              />
              <input
                value={profileForm.website_url}
                onChange={(event) => {
                  setProfileForm((current) => ({ ...current, website_url: event.target.value }));
                }}
                placeholder="Site web (https://...)"
                className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              />
              <input
                value={profileForm.logo_url}
                onChange={(event) => {
                  setProfileForm((current) => ({ ...current, logo_url: event.target.value }));
                }}
                placeholder="Logo URL"
                className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              />
              <input
                value={profileForm.cover_url}
                onChange={(event) => {
                  setProfileForm((current) => ({ ...current, cover_url: event.target.value }));
                }}
                placeholder="Cover URL"
                className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              />
              <input
                value={profileForm.address}
                onChange={(event) => {
                  setProfileForm((current) => ({ ...current, address: event.target.value }));
                }}
                placeholder="Adresse"
                className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400 md:col-span-2"
              />
              <textarea
                rows={4}
                value={profileForm.description}
                onChange={(event) => {
                  setProfileForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }));
                }}
                placeholder="Description"
                className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400 md:col-span-2"
              />
              <button
                type="submit"
                disabled={isSavingProfile}
                className="rounded-full border border-yellow-500 bg-yellow-500 px-6 py-3 text-sm font-black text-[#05070d] transition hover:bg-yellow-400 disabled:opacity-60 md:col-span-2"
              >
                {isSavingProfile ? "Enregistrement..." : "Mettre a jour le profil"}
              </button>
              {profileFeedback ? (
                <p className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-slate-200 md:col-span-2">
                  {profileFeedback}
                </p>
              ) : null}
            </form>
          </section>
        ) : null}

        <section
          id="gestion-offres"
          className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6"
        >
          <p className="text-xs uppercase tracking-[0.12em] text-yellow-300">Gestion offres</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-white">
              {editingJobId ? "Modifier une offre" : "Creer une offre"}
            </h2>
            {editingJobId ? (
              <button
                type="button"
                onClick={resetJobForm}
                className="rounded-full border border-[#2a3a68] px-3 py-1.5 text-xs font-semibold text-slate-200"
              >
                Annuler la modification
              </button>
            ) : null}
          </div>

          <form onSubmit={handleJobSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              required
              minLength={4}
              value={jobForm.title}
              onChange={(event) => {
                setJobForm((current) => ({ ...current, title: event.target.value }));
              }}
              placeholder="Titre poste"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            />
            <input
              value={jobForm.contract_type}
              onChange={(event) => {
                setJobForm((current) => ({
                  ...current,
                  contract_type: event.target.value,
                }));
              }}
              placeholder="Type contrat (CDI, CDD...)"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            />
            <input
              value={jobForm.location_city}
              onChange={(event) => {
                setJobForm((current) => ({
                  ...current,
                  location_city: event.target.value,
                }));
              }}
              placeholder="Ville"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            />
            <select
              value={jobForm.status}
              onChange={(event) => {
                setJobForm((current) => ({
                  ...current,
                  status: event.target.value as JobStatus,
                }));
              }}
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            >
              <option value="draft">Brouillon</option>
              <option value="published">Publie</option>
              <option value="closed">Ferme</option>
            </select>
            <input
              value={jobForm.salary_min}
              onChange={(event) => {
                setJobForm((current) => ({ ...current, salary_min: event.target.value }));
              }}
              placeholder="Salaire min"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            />
            <input
              value={jobForm.salary_max}
              onChange={(event) => {
                setJobForm((current) => ({ ...current, salary_max: event.target.value }));
              }}
              placeholder="Salaire max"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            />
            <label className="flex items-center gap-3 rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white md:col-span-2">
              <input
                type="checkbox"
                checked={jobForm.is_remote}
                onChange={(event) => {
                  setJobForm((current) => ({ ...current, is_remote: event.target.checked }));
                }}
              />
              Poste remote
            </label>
            <textarea
              required
              minLength={20}
              rows={4}
              value={jobForm.description}
              onChange={(event) => {
                setJobForm((current) => ({
                  ...current,
                  description: event.target.value,
                }));
              }}
              placeholder="Description du poste"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400 md:col-span-2"
            />

            <button
              type="submit"
              disabled={isSavingJob}
              className="rounded-full border border-yellow-500 bg-yellow-500 px-6 py-3 text-sm font-black text-[#05070d] transition hover:bg-yellow-400 disabled:opacity-60 md:col-span-2"
            >
              {isSavingJob
                ? "Enregistrement..."
                : editingJobId
                  ? "Mettre a jour l offre"
                  : "Publier l offre"}
            </button>
          </form>

          {jobFeedback ? (
            <p className="mt-3 rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-slate-200">
              {jobFeedback}
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-white">Vos offres (CRUD)</h2>
            <span className="rounded-full border border-[#2a3a68] bg-[#121d38] px-2.5 py-0.5 text-xs text-slate-200">
              Total: {stats.totalJobs}
            </span>
          </div>
          <div className="mt-4 grid gap-4">
            {jobs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#2a3a68] px-4 py-8 text-sm text-slate-400">
                Aucune offre trouvee.
              </p>
            ) : (
              jobs.map((job) => (
                <article
                  key={job.id}
                  className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-white">{job.title}</h3>
                      <p className="mt-1 text-xs text-slate-300">
                        {job.contract_type || "Contrat"} • {job.location_city || "Ville non precisee"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Creee le {formatDate(job.created_at)}
                      </p>
                    </div>
                    <span className="rounded-full border border-yellow-500/70 px-3 py-1 text-xs font-semibold text-yellow-300">
                      {job.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-300">{job.description}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleEditJob(job);
                      }}
                      className="rounded-full border border-[#2a3a68] px-4 py-1.5 text-xs font-semibold text-slate-200"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteJob(job.id);
                      }}
                      className="rounded-full border border-rose-500/70 px-4 py-1.5 text-xs font-semibold text-rose-200"
                    >
                      Supprimer
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section
          id="candidatures-entreprise"
          className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6"
        >
          <p className="text-xs uppercase tracking-[0.12em] text-yellow-300">Gestion candidatures</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-white">Candidatures recues</h2>
            <Link
              href="/espace-entreprise/candidatures"
              className="rounded-full border border-yellow-500 px-4 py-2 text-xs font-semibold text-yellow-300"
            >
              Voir plus ({stats.totalApplications})
            </Link>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Affichage des 6 dernieres candidatures. Ouvrez la page Voir plus pour la liste complete.
          </p>

          {applicationFeedback ? (
            <p className="mt-4 rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-slate-200">
              {applicationFeedback}
            </p>
          ) : null}

          <div className="mt-4 grid gap-4">
            {dashboardApplications.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#2a3a68] px-4 py-8 text-sm text-slate-400">
                Aucune candidature pour le moment.
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

                    <p className="mt-2 text-xs text-slate-400">
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

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void handleOpenCv(application.id);
                        }}
                        disabled={busyApplicationId === application.id || !application.cv_path}
                        className="rounded-full border border-[#2a3a68] px-4 py-1.5 text-xs font-semibold text-slate-100 disabled:opacity-60"
                      >
                        {busyApplicationId === application.id
                          ? "Ouverture..."
                          : application.cv_path
                            ? "Ouvrir CV"
                            : "CV indisponible"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void handleOpenMotivationLetter(application.id);
                        }}
                        disabled={!hasMotivationFile || busyMotivationId === application.id}
                        className="rounded-full border border-[#2a3a68] px-4 py-1.5 text-xs font-semibold text-slate-100 disabled:opacity-60"
                      >
                        {busyMotivationId === application.id
                          ? "Ouverture..."
                          : hasMotivationFile
                            ? "Ouvrir lettre"
                            : "Lettre indisponible"}
                      </button>

                      <select
                        value={statusDrafts[application.id] ?? application.status}
                        onChange={(event) => {
                          setStatusDrafts((current) => ({
                            ...current,
                            [application.id]: event.target.value as ApplicationStatus,
                          }));
                        }}
                        className="rounded-full border border-[#2a3a68] bg-[#0f1830] px-3 py-1.5 text-xs text-white"
                      >
                        <option value="pending">pending</option>
                        <option value="shortlisted">shortlisted</option>
                        <option value="rejected">rejected</option>
                        <option value="hired">hired</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          void handleApplicationStatusSave(application.id);
                        }}
                        disabled={busyApplicationId === application.id}
                        className="rounded-full border border-yellow-500 px-4 py-1.5 text-xs font-semibold text-yellow-300 disabled:opacity-60"
                      >
                        Appliquer statut
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
