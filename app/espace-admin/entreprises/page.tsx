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

export default function EspaceAdminEntreprisesPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);

  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);

  const loadCompanies = useCallback(async (token: string) => {
    setDataLoading(true);
    setDataError(null);

    const result = await requestApi<AdminCompany[]>(
      "/api/admin/companies?limit=200&sort=newest",
      {
        method: "GET",
        headers: toAuthHeader(token),
        cache: "no-store",
      }
    );

    if (!result.ok) {
      setCompanies([]);
      setDataError(result.message);
      setDataLoading(false);
      return;
    }

    setCompanies(result.data);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const session = loadStoredSession();
      if (!session) {
        router.replace("/login?next=/espace-admin/entreprises");
        return;
      }

      const currentActor = await fetchActorFromSession(session);
      if (!active) {
        return;
      }

      if (!currentActor) {
        clearStoredSession();
        router.replace("/login?next=/espace-admin/entreprises");
        return;
      }

      if (currentActor.role !== "super_admin") {
        setAuthError("Acces reserve au super administrateur.");
        setActor(currentActor);
        setAuthLoading(false);
        return;
      }

      setActor(currentActor);
      setAuthLoading(false);

      await loadCompanies(currentActor.accessToken);
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadCompanies, router]);

  const handleLogout = () => {
    clearStoredSession();
    router.push("/login");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#05070d] text-slate-100">
        <SiteBanner />
        <main className="mx-auto w-full max-w-[92rem] px-[var(--page-gutter)] py-10">
          <p className="text-sm text-slate-300">Chargement des entreprises...</p>
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
                Super admin
              </p>
              <h1 className="mt-1 text-3xl font-black text-white md:text-4xl">
                Toutes les entreprises
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Connecte en tant que {actor?.fullName || actor?.email || "admin"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/espace-admin"
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
            Liste complete des entreprises ({companies.length}).
          </p>

          {dataError ? (
            <p className="mt-4 rounded-2xl border border-yellow-500/50 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-200">
              {dataError}
            </p>
          ) : null}

          {dataLoading ? (
            <p className="mt-4 text-sm text-slate-400">Chargement de la liste...</p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
          <div className="grid gap-4">
            {companies.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#2a3a68] px-4 py-8 text-sm text-slate-400">
                Aucune entreprise disponible.
              </p>
            ) : (
              companies.map((company) => (
                <article
                  key={company.id}
                  className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-white">{company.name}</h3>
                      <p className="mt-1 text-xs text-slate-300">slug: {company.slug}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        owner_user_id: {company.owner_user_id}
                      </p>
                    </div>
                    <span className="rounded-full border border-yellow-500/70 px-3 py-1 text-xs font-semibold text-yellow-300">
                      {company.status}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                    <p>Type: {company.company_type === "startup" ? "Startup" : "SARL"}</p>
                    <p>Secteur: {company.sector || "-"}</p>
                    <p>Ville: {company.city || "-"}</p>
                    <p>Pays: {company.country || "-"}</p>
                    <p>Featured: {company.is_featured ? "Oui" : "Non"}</p>
                  </div>

                  <div className="mt-3 rounded-2xl border border-[#2a3a68] bg-[#0f1830] p-3">
                    <p className="text-xs font-semibold text-slate-300">Description complete</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                      {company.description || "Aucune description fournie."}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                    <p>Creee le {formatDate(company.created_at)}</p>
                    <p>Mise a jour le {formatDate(company.updated_at)}</p>
                  </div>

                  <div className="mt-3">
                    <Link
                      href={`/entreprises/${company.slug}`}
                      target="_blank"
                      className="rounded-full border border-yellow-500 px-4 py-2 text-xs font-semibold text-yellow-300"
                    >
                      Ouvrir la page publique
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
