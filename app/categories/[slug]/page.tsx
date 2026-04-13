"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, use, useEffect, useMemo, useState } from "react";

import { SiteBanner } from "@/app/ui/site-banner";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type CompanyCard = {
  id: string;
  name: string;
  slug: string;
  company_type: "sarl" | "startup";
  sector: string | null;
  city: string | null;
  logo_url: string | null;
  cover_url: string | null;
  open_jobs_count: number;
};

type ApiSuccess<T, M = Record<string, unknown>> = {
  success: true;
  data: T;
  meta?: M;
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  entreprise:
    "Entreprises etablies avec structure operationnelle, services actifs et recrutement en cours.",
  startup:
    "Startups innovantes en phase de croissance, produit digital et acceleration commerciale.",
  technologie:
    "Entreprises tech specialisees en logiciels, IA, cloud et transformation digitale.",
  sante:
    "Structures de sante, services cliniques et ecosysteme medical professionnel.",
  education:
    "Organismes de formation, academies et solutions d employabilite.",
  finance:
    "Cabinets financiers, investissements, conseil et pilotage de croissance.",
  commerce:
    "Retail, distribution, e-commerce et acceleration des ventes.",
  industrie:
    "Maintenance, production et services techniques pour sites industriels.",
  marketing:
    "Agences et acteurs de visibilite, communication et acquisition digitale.",
};

const DEFAULT_COMPANY_COVER =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80";

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

export default function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [category, setCategory] = useState<Category | null>(null);
  const [companies, setCompanies] = useState<CompanyCard[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [categoriesResponse, companiesResponse] = await Promise.all([
          fetch("/api/categories"),
          fetch(`/api/companies?page=1&limit=40&sort=newest&category=${encodeURIComponent(slug)}`),
        ]);

        const categoriesPayload: unknown = await categoriesResponse.json();
        const companiesPayload: unknown = await companiesResponse.json();

        if (isApiSuccess<Category[]>(categoriesPayload)) {
          const found = categoriesPayload.data.find((item) => item.slug === slug) || null;
          if (active) {
            setCategory(found);
          }
        }

        if (isApiSuccess<CompanyCard[]>(companiesPayload)) {
          if (active) {
            setCompanies(companiesPayload.data);
          }
        } else if (isApiFailure(companiesPayload)) {
          if (active) {
            setError(companiesPayload.error.message);
          }
        } else if (active) {
          setError("Reponse API invalide.");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Erreur reseau inattendue.");
        }
      }

      if (active) {
        setLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [slug]);

  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return companies;
    }

    return companies.filter((item) => {
      return [item.name, item.company_type, item.sector || "", item.city || ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [companies, search]);

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const description = CATEGORY_DESCRIPTIONS[slug] || "Decouvrez les entreprises de cette categorie.";

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <SiteBanner />

      <main className="mx-auto w-full max-w-[92rem] px-[var(--page-gutter)] py-8 md:py-10">
        <section className="rounded-3xl border border-[#223059] bg-[#0a1120] p-6 md:p-9">
          <p className="text-xs uppercase tracking-[0.12em] text-yellow-300">Categorie</p>
          <h1 className="mt-2 text-3xl font-black text-white md:text-5xl">
            {category?.name || slug}
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">{description}</p>

          <form onSubmit={onSearchSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder="Rechercher une entreprise dans cette categorie"
              className="w-full rounded-full border border-[#2a3a68] bg-[#121d38] px-5 py-3 text-sm text-white outline-none transition focus:border-yellow-400"
            />
            <button
              type="submit"
              className="rounded-full border border-yellow-500 bg-yellow-500 px-5 py-3 text-sm font-black text-[#05070d]"
            >
              Rechercher
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-white">Entreprises de la categorie</h2>
            <span className="rounded-full border border-[#2a3a68] px-3 py-1 text-xs text-slate-300">
              {filteredCompanies.length} resultat(s)
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : null}

          {error ? (
            <p className="rounded-2xl border border-rose-500/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          {!loading && !error && filteredCompanies.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#2a3a68] px-4 py-10 text-sm text-slate-400">
              Aucune entreprise trouvee pour cette recherche.
            </p>
          ) : null}

          {!loading && !error && filteredCompanies.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCompanies.map((company) => (
                <Link
                  key={company.id}
                  href={`/entreprises/${company.slug}`}
                  className="group block overflow-hidden rounded-3xl border border-[#24325a] bg-[#101a31] shadow-[0_14px_34px_rgba(3,8,25,0.35)] transition hover:-translate-y-1 hover:border-yellow-500"
                >
                  <div className="relative h-72 w-full bg-[#121d38] md:h-80">
                    <Image
                      src={company.cover_url || DEFAULT_COMPANY_COVER}
                      alt={company.name}
                      fill
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#05070d]/85 via-[#05070d]/20 to-transparent" />

                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <div className="relative h-24 w-24 scale-90 rounded-full border border-white/20 bg-[#05070d]/50 opacity-0 shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur transition duration-300 group-hover:scale-100 group-hover:opacity-100">
                        <div className="absolute inset-2 rounded-full border border-white/20 bg-[#070a12]/80" />
                        <div className="absolute inset-0 grid place-items-center p-4">
                          <Image
                            src="/cartevisite-logo.png"
                            alt="Logo CarteVisite"
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded-md"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/20 bg-[#05070d]/70 px-4 py-3 backdrop-blur">
                      <p className="truncate text-base font-black text-white">{company.name}</p>
                      <p className="mt-1 max-h-0 overflow-hidden text-xs text-slate-200 opacity-0 transition-all duration-300 group-hover:max-h-8 group-hover:opacity-100 group-focus-visible:max-h-8 group-focus-visible:opacity-100">
                        {(company.company_type === "startup" ? "Startup" : "SARL") + " • " + (company.city || company.sector || "Ville non specifiee") + " • " + company.open_jobs_count + " poste(s)"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
