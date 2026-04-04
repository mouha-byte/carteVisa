"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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

type ApplicationStatus = "pending" | "shortlisted" | "rejected" | "hired";

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

    if (
      typeof payload === "object" &&
      payload !== null &&
      "success" in payload &&
      (payload as { success: unknown }).success === true
    ) {
      const successPayload = payload as ApiSuccess<T, M>;
      return {
        ok: true,
        data: successPayload.data,
        meta: successPayload.meta,
        status: response.status,
      };
    }

    if (
      typeof payload === "object" &&
      payload !== null &&
      "success" in payload &&
      (payload as { success: unknown }).success === false
    ) {
      const failurePayload = payload as ApiFailure;
      return {
        ok: false,
        message: failurePayload.error.message,
        code: failurePayload.error.code,
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

export default function EspaceEntrepriseCandidaturesPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [applications, setApplications] = useState<CompanyApplication[]>([]);

  const [applicationFeedback, setApplicationFeedback] = useState<string | null>(null);
  const [busyApplicationId, setBusyApplicationId] = useState<string | null>(null);
  const [busyMotivationId, setBusyMotivationId] = useState<string | null>(null);

  const [statusDrafts, setStatusDrafts] = useState<Record<string, ApplicationStatus>>({});

  const loadApplications = useCallback(async (token: string) => {
    setDataLoading(true);
    setDataError(null);

    const result = await requestApi<CompanyApplication[]>(
      "/api/company/applications?limit=200&sort=newest",
      {
        method: "GET",
        headers: toAuthHeader(token),
        cache: "no-store",
      }
    );

    if (!result.ok) {
      setApplications([]);
      setStatusDrafts({});
      setDataError(result.message);
      setDataLoading(false);
      return;
    }

    setApplications(result.data);
    setStatusDrafts(Object.fromEntries(result.data.map((item) => [item.id, item.status])));
    setDataLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const session = loadStoredSession();
      if (!session) {
        router.replace("/login?next=/espace-entreprise/candidatures");
        return;
      }

      const currentActor = await fetchActorFromSession(session);
      if (!active) {
        return;
      }

      if (!currentActor) {
        clearStoredSession();
        router.replace("/login?next=/espace-entreprise/candidatures");
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

      await loadApplications(currentActor.accessToken);
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadApplications, router]);

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
    await loadApplications(accessToken);
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
          <p className="text-sm text-slate-300">Chargement des candidatures...</p>
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
              <p className="text-xs uppercase tracking-[0.12em] text-yellow-300">
                Espace entreprise
              </p>
              <h1 className="mt-1 text-3xl font-black text-white md:text-4xl">
                Toutes les candidatures
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Connecte en tant que {actor?.fullName || actor?.email || "utilisateur"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/espace-entreprise"
                className="rounded-full border border-[#2a3a68] px-4 py-2 text-sm font-semibold text-slate-100"
              >
                Retour dashboard
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-[#2a3a68] px-4 py-2 text-sm font-semibold text-slate-100"
              >
                Deconnexion
              </button>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-300">
            Nombre total: {applications.length} candidature(s).
          </p>

          {dataError ? (
            <p className="mt-4 rounded-2xl border border-yellow-500/50 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-200">
              {dataError}
            </p>
          ) : null}

          {applicationFeedback ? (
            <p className="mt-4 rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-slate-200">
              {applicationFeedback}
            </p>
          ) : null}

          {dataLoading ? (
            <p className="mt-4 text-sm text-slate-400">Chargement de la liste...</p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
          <div className="grid gap-4">
            {applications.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#2a3a68] px-4 py-8 text-sm text-slate-400">
                Aucune candidature disponible.
              </p>
            ) : (
              applications.map((application) => {
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
                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full border border-[#2a3a68] px-2.5 py-1 text-xs font-semibold text-slate-200">
                          {application.status}
                        </span>
                        <select
                          value={statusDrafts[application.id] ?? application.status}
                          onChange={(event) => {
                            const nextStatus = event.target.value as ApplicationStatus;
                            setStatusDrafts((current) => ({
                              ...current,
                              [application.id]: nextStatus,
                            }));
                          }}
                          className="rounded-xl border border-[#2a3a68] bg-[#0f1830] px-3 py-1.5 text-xs text-slate-100 outline-none"
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
                          className="rounded-full border border-yellow-500 px-3 py-1 text-xs font-semibold text-yellow-300 disabled:opacity-60"
                        >
                          {busyApplicationId === application.id
                            ? "Sauvegarde..."
                            : "Sauver statut"}
                        </button>
                      </div>
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
                      <p className="mt-3 text-sm text-slate-500">Aucun texte de motivation.</p>
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
                          void handleOpenCv(application.id);
                        }}
                        disabled={busyApplicationId === application.id || !application.cv_path}
                        className="rounded-full border border-yellow-500 px-4 py-1.5 text-xs font-semibold text-yellow-300 disabled:opacity-60"
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
