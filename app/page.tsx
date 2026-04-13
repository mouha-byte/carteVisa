"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
    }
  | {
      ok: false;
      message: string;
      status: number;
      code?: string;
    };

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

type JobCard = {
  id: string;
  title: string;
  contract_type: string | null;
  location_city: string | null;
  is_remote: boolean;
  published_at: string | null;
  company: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    cover_url: string | null;
    city: string | null;
    sector: string | null;
  } | null;
};

type CategorySection = {
  category: Category;
  companies: CompanyCard[];
};

type SecondaryAd = {
  title: string;
  subtitle: string;
  link: string;
  tag: string;
  imageUrl: string;
};

type SearchResultType = "company" | "job" | "service";

type SearchResultItem = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  description: string | null;
  city: string | null;
  link: string;
};

type SearchPayload = {
  items: SearchResultItem[];
  totals: {
    companies: number;
    jobs: number;
    services: number;
  };
};

const FALLBACK_COMPANIES: CompanyCard[] = [
  {
    id: "fallback-atlas",
    name: "Atlas Tech SARL",
    slug: "atlas-tech",
    company_type: "sarl",
    sector: "Technologie",
    city: "Casablanca",
    logo_url: null,
    cover_url:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
    open_jobs_count: 3,
  },
  {
    id: "fallback-health",
    name: "Maghreb Health Plus",
    slug: "maghreb-health-plus",
    company_type: "sarl",
    sector: "Sante",
    city: "Rabat",
    logo_url: null,
    cover_url:
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1600&q=80",
    open_jobs_count: 1,
  },
];

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

const SECONDARY_ADS: SecondaryAd[] = [
  {
    title: "Pack Visibilite Premium",
    subtitle: "Mettez votre entreprise en avant des le premier ecran.",
    link: "/create-site",
    tag: "Sponsor",
    imageUrl:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Boost Recrutement",
    subtitle: "Recevez plus de candidatures qualifiees en quelques jours.",
    link: "#categories",
    tag: "RH",
    imageUrl:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Formation Business",
    subtitle: "Sessions gratuites et payantes pour entrepreneurs.",
    link: "https://youtube.com",
    tag: "Formation",
    imageUrl:
      "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Creation Site Web",
    subtitle: "Lancez votre site pro avec notre equipe design + dev.",
    link: "/create-site",
    tag: "Web",
    imageUrl:
      "https://images.unsplash.com/photo-1481487196290-c152efe083f5?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Video Branding",
    subtitle: "Faites passer votre image de marque au niveau superieur.",
    link: "#hero-media",
    tag: "Media",
    imageUrl:
      "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1200&q=80",
  },
];

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

function searchTypeLabel(type: SearchResultType): string {
  if (type === "company") {
    return "Entreprise";
  }

  if (type === "job") {
    return "Offre";
  }

  return "Service";
}

function isCombinedEntrepriseStartupCategory(category: Category): boolean {
  const label = `${category.name} ${category.slug}`.toLowerCase();
  return label.includes("startup") && (label.includes("entreprise") || label.includes("enterprise"));
}

function splitCategoryForDisplay(category: Category): Category[] {
  if (!isCombinedEntrepriseStartupCategory(category)) {
    return [category];
  }

  return [
    {
      ...category,
      id: `${category.id}-entreprise`,
      name: "Entreprise",
    },
    {
      ...category,
      id: `${category.id}-startup`,
      name: "Startup",
    },
  ];
}

function isStartupCompany(company: CompanyCard): boolean {
  if (company.company_type === "startup") {
    return true;
  }

  const label = `${company.name} ${company.slug} ${company.sector || ""}`.toLowerCase();
  return /start[\s-]?up/.test(label);
}

function splitSectionForDisplay(section: CategorySection): CategorySection[] {
  if (!isCombinedEntrepriseStartupCategory(section.category)) {
    return [section];
  }

  const startupCompanies = section.companies.filter((company) => isStartupCompany(company));
  const entrepriseCompanies = section.companies.filter((company) => !isStartupCompany(company));

  const [entrepriseCategory, startupCategory] = splitCategoryForDisplay(section.category);

  return [
    {
      category: entrepriseCategory,
      companies: entrepriseCompanies.length > 0 ? entrepriseCompanies : section.companies,
    },
    {
      category: startupCategory,
      companies: startupCompanies.length > 0 ? startupCompanies : section.companies,
    },
  ];
}

function CompanyCoverCard({ company }: { company: CompanyCard }) {
  const coverSrc = company.cover_url || DEFAULT_COMPANY_COVER;
  const typeLabel = company.company_type === "startup" ? "Startup" : "SARL";

  return (
    <Link
      href={`/entreprises/${company.slug}`}
      className="group block overflow-hidden rounded-[2rem] border border-[#24325a] bg-[#101a31] shadow-[0_14px_34px_rgba(3,8,25,0.35)] transition hover:-translate-y-1 hover:border-yellow-500"
    >
      <div className="relative h-72 w-full bg-[#162445] md:h-80">
        <Image src={coverSrc} alt={company.name} fill className="object-cover transition duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070d]/85 via-[#05070d]/15 to-transparent" />

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
            {typeLabel + " • " + (company.city || company.sector || "Ville non specifiee") + " • " + company.open_jobs_count + " poste(s)"}
          </p>
        </div>
      </div>
    </Link>
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
      payload = raw ? JSON.parse(raw) : null;
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

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentCompanies, setRecentCompanies] = useState<CompanyCard[]>(FALLBACK_COMPANIES);
  const [activeJobs, setActiveJobs] = useState<JobCard[]>([]);
  const [categorySections, setCategorySections] = useState<CategorySection[]>([]);
  const [showAllCategorySections, setShowAllCategorySections] = useState(false);
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchType, setSearchType] = useState<"all" | SearchResultType>("all");
  const [searchCategory, setSearchCategory] = useState("all");
  const [searchCity, setSearchCity] = useState("all");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const secondaryAdsLoop = useMemo(() => [...SECONDARY_ADS, ...SECONDARY_ADS], []);

  const hasActiveSearchFilters =
    searchKeyword.trim().length > 0 ||
    searchType !== "all" ||
    searchCategory !== "all" ||
    searchCity !== "all";

  const clearSearchFilters = useCallback(() => {
    setSearchKeyword("");
    setSearchType("all");
    setSearchCategory("all");
    setSearchCity("all");
    setSearchResults([]);
    setSearchError(null);
  }, []);

  const visibleJobs = useMemo(() => {
    if (showAllJobs) {
      return activeJobs;
    }

    return activeJobs.slice(0, 4);
  }, [activeJobs, showAllJobs]);

  const visibleCategorySections = useMemo(() => {
    if (showAllCategorySections) {
      return categorySections;
    }

    return categorySections.slice(0, 4);
  }, [categorySections, showAllCategorySections]);

  const cityOptions = useMemo(() => {
    const values = new Set<string>();

    for (const company of recentCompanies) {
      if (company.city) {
        values.add(company.city);
      }
    }

    for (const job of activeJobs) {
      if (job.location_city) {
        values.add(job.location_city);
      }
      if (job.company?.city) {
        values.add(job.company.city);
      }
    }

    return [...values].sort((a, b) => a.localeCompare(b, "fr"));
  }, [activeJobs, recentCompanies]);

  const loadLandingData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [companiesResult, jobsResult, categoriesResult] = await Promise.all([
      requestApi<CompanyCard[]>("/api/companies?page=1&limit=9&sort=newest"),
      requestApi<JobCard[]>("/api/jobs?page=1&limit=12&sort=newest"),
      requestApi<Category[]>("/api/categories"),
    ]);

    let nextError: string | null = null;

    if (companiesResult.ok) {
      setRecentCompanies(companiesResult.data);
    } else {
      setRecentCompanies(FALLBACK_COMPANIES);
      nextError = companiesResult.message;
    }

    if (jobsResult.ok) {
      setActiveJobs(jobsResult.data);
    } else if (!nextError) {
      nextError = jobsResult.message;
    }

    if (categoriesResult.ok) {
      const displayCategories = categoriesResult.data.flatMap((category) =>
        splitCategoryForDisplay(category)
      );

      setCategories(displayCategories);

      const rawSections = await Promise.all(
        categoriesResult.data.map(async (category) => {
          const byCategory = await requestApi<CompanyCard[]>(
            `/api/companies?page=1&limit=4&sort=newest&category=${encodeURIComponent(category.slug)}`
          );

          return {
            category,
            companies: byCategory.ok ? byCategory.data : [],
          } satisfies CategorySection;
        })
      );

      const displaySections = rawSections
        .filter((section) => section.companies.length > 0)
        .flatMap((section) => splitSectionForDisplay(section));

      setCategorySections(displaySections);
    } else if (!nextError) {
      nextError = categoriesResult.message;
    }

    setError(nextError);
    setLoading(false);
  }, []);

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      void loadLandingData();
    }, 0);

    return () => {
      window.clearTimeout(bootstrapTimer);
    };
  }, [loadLandingData]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 360);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      const keyword = searchKeyword.trim();
      const hasFilters = searchCategory !== "all" || searchCity !== "all";

      if (keyword.length < 2 && !hasFilters) {
        if (!active) {
          return;
        }

        setSearchResults([]);
        setSearchError(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setSearchError(null);

      const params = new URLSearchParams({
        limit: "12",
      });

      if (keyword.length >= 2) {
        params.set("q", keyword);
      }

      if (searchType !== "all") {
        params.set("type", searchType);
      }

      if (searchCategory !== "all") {
        params.set("category", searchCategory);
      }

      if (searchCity !== "all") {
        params.set("city", searchCity);
      }

      const searchResult = await requestApi<SearchPayload>(`/api/search?${params.toString()}`);

      if (!active) {
        return;
      }

      if (searchResult.ok) {
        setSearchResults(searchResult.data.items);
        setSearchError(null);
      } else {
        setSearchResults([]);
        setSearchError(searchResult.message);
      }

      setIsSearching(false);
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchKeyword, searchType, searchCategory, searchCity]);

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <SiteBanner />

      <main id="top" className="mx-auto flex w-full max-w-[92rem] flex-col gap-14 px-[var(--page-gutter)] py-9 md:gap-16 md:py-14">
        <section id="hero-media" className="reveal-up space-y-5">
          <div className="overflow-hidden rounded-3xl border border-[#223058] bg-[#0b1326] shadow-[0_20px_50px_rgba(3,6,20,0.55)]">
            <div className="relative min-h-[280px] w-full md:min-h-[420px]">
              <video
                className="h-full w-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                poster="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=80"
              >
                <source
                  src="https://samplelib.com/lib/preview/mp4/sample-10s.mp4"
                  type="video/mp4"
                />
              </video>

              <div className="absolute inset-0 bg-gradient-to-r from-[#05070d]/92 via-[#0b1326]/62 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#05070d]/80 via-transparent to-transparent" />
              <div className="absolute inset-0 flex items-end p-4 sm:p-7 md:p-12">
                <div className="max-w-4xl space-y-4">
                  <p className="headline-script inline-flex rounded-full border border-yellow-500/60 bg-[#05070d]/70 px-4 py-1.5 text-sm text-yellow-300">
                    Landing multimedia professionnelle
                  </p>
                  <h1 className="headline-special headline-accent text-3xl font-black leading-tight sm:text-4xl md:text-7xl">
                    Design simple, dynamique et visuel
                  </h1>
                  <p className="max-w-3xl text-sm text-slate-200 sm:text-base md:text-lg">
                    Design simple, dynamique et visuel pour presenter les entreprises avec des medias dominants. Pensee pour un affichage fluide sur mobile et desktop.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Link
                      href="#search"
                      className="rounded-full border border-yellow-500 bg-yellow-500 px-4 py-2 text-xs font-bold text-[#05070d] transition hover:bg-yellow-400 sm:px-5 sm:py-2.5 sm:text-sm"
                    >
                      Explorer les entreprises
                    </Link>
                    <Link
                      href="/create-site"
                      className="rounded-full border border-[#2a3a68] bg-[#0b1222] px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-yellow-500 hover:text-yellow-300 sm:px-5 sm:py-2.5 sm:text-sm"
                    >
                      Publier mon entreprise
                    </Link>
                    <span className="rounded-full border border-[#2a3a68] bg-[#05070d]/70 px-3 py-1 text-[11px] font-semibold text-slate-300">
                      Responsive mobile et desktop
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-sm font-semibold text-slate-200 sm:text-base md:text-lg">
            Plateforme orientee business: decouvrez les entreprises recentes, les medias dominants et les offres actives sur tous les formats d ecran.
          </p>
        </section>

        <section className="reveal-up reveal-delay-1 space-y-4 rounded-3xl border border-[#1f2a4d] bg-[#0b1222] p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="headline-special headline-accent text-xl font-black md:text-2xl">
              Medias secondaires
            </h2>
            <span className="rounded-full border border-[#2a3a68] px-3 py-1 text-xs font-semibold text-slate-300">
              defilement automatique
            </span>
          </div>

          <div className="media-scroller">
            <div className="media-scroller-track">
              {secondaryAdsLoop.map((ad, index) => (
                <a
                  key={`${ad.title}-${index}`}
                  href={ad.link}
                  target={ad.link.startsWith("http") ? "_blank" : undefined}
                  rel={ad.link.startsWith("http") ? "noreferrer" : undefined}
                  className="mx-2 w-[78vw] min-w-[260px] max-w-[360px] shrink-0 overflow-hidden rounded-2xl border border-[#2a3a68] bg-[#101a31] transition hover:border-yellow-500"
                >
                  <div
                    className="h-32 w-full bg-cover bg-center sm:h-36"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(5,7,13,0) 0%, rgba(5,7,13,0.78) 100%), url('${ad.imageUrl}')`,
                    }}
                  />
                  <div className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="rounded-full bg-[#23335e] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-300">
                        {ad.tag}
                      </span>
                      <span className="text-xs text-yellow-300">Voir</span>
                    </div>
                    <p className="text-sm font-bold text-white">{ad.title}</p>
                    <p className="mt-1 text-xs text-slate-300">{ad.subtitle}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section
          id="search"
          className="reveal-up reveal-delay-2 rounded-3xl border border-[#1f2a4d] bg-[#0a1120] p-7 md:p-10"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="headline-special headline-accent text-3xl font-black md:text-4xl">
              Recherche instantanee
            </h2>
            <span className="rounded-full border border-[#2a3a68] px-3 py-1 text-xs text-slate-300">
              {searchResults.length} resultat(s)
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <input
              value={searchKeyword}
              onChange={(event) => {
                setSearchKeyword(event.target.value);
              }}
              placeholder="Mot cle: entreprise, service, offre, produit"
              className="rounded-full border border-[#2a3a68] bg-[#0f1830] px-5 py-3.5 text-sm text-white outline-none transition focus:border-yellow-400 lg:col-span-5"
            />

            <select
              value={searchType}
              onChange={(event) => {
                setSearchType(event.target.value as "all" | SearchResultType);
              }}
              className="rounded-full border border-[#2a3a68] bg-[#0f1830] px-4 py-3.5 text-sm text-white outline-none transition focus:border-yellow-400 lg:col-span-2"
            >
              <option value="all">Tout</option>
              <option value="company">Entreprises</option>
              <option value="service">Produits / Services</option>
              <option value="job">Offres d emploi</option>
            </select>

            <select
              value={searchCategory}
              onChange={(event) => {
                setSearchCategory(event.target.value);
              }}
              className="rounded-full border border-[#2a3a68] bg-[#0f1830] px-4 py-3.5 text-sm text-white outline-none transition focus:border-yellow-400 lg:col-span-3"
            >
              <option value="all">Toutes categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={searchCity}
              onChange={(event) => {
                setSearchCity(event.target.value);
              }}
              className="rounded-full border border-[#2a3a68] bg-[#0f1830] px-4 py-3.5 text-sm text-white outline-none transition focus:border-yellow-400 lg:col-span-2"
            >
              <option value="all">Toutes villes</option>
              {cityOptions.map((cityValue) => (
                <option key={cityValue} value={cityValue}>
                  {cityValue}
                </option>
              ))}
            </select>
          </div>

          {hasActiveSearchFilters ? (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={clearSearchFilters}
                className="rounded-full border border-[#2a3a68] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-yellow-500 hover:text-yellow-300"
              >
                Supprimer les filtres
              </button>
            </div>
          ) : null}

          {searchError ? (
            <p className="mt-4 rounded-2xl border border-yellow-500/40 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-200">
              Recherche indisponible: {searchError}
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-slate-300">
              Donnees chargees partiellement: {error}
            </p>
          ) : null}

          {loading ? (
            <p className="mt-4 text-sm text-slate-400">Chargement des contenus...</p>
          ) : null}

          {isSearching ? (
            <p className="mt-4 text-sm text-slate-400">Recherche en cours...</p>
          ) : null}

          {!isSearching && searchResults.length > 0 ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {searchResults.map((item) => (
                <article
                  key={`${item.type}-${item.id}`}
                  className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-6"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full border border-yellow-500/70 px-2 py-1 text-[11px] font-semibold text-yellow-300">
                      {searchTypeLabel(item.type)}
                    </span>
                    {item.city ? (
                      <span className="text-[11px] text-slate-400">{item.city}</span>
                    ) : null}
                  </div>

                  <h3 className="text-lg font-black text-white">{item.title}</h3>
                  <p className="mt-1 text-base text-slate-300">{item.subtitle}</p>
                  {item.description ? (
                    <p className="mt-2 text-base text-slate-400">{item.description}</p>
                  ) : null}

                  <Link
                    href={item.link}
                    className="mt-4 inline-flex rounded-full border border-[#2a3a68] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-[#1a2a4d]"
                  >
                    Ouvrir
                  </Link>
                </article>
              ))}
            </div>
          ) : null}

          {!isSearching &&
          searchResults.length === 0 &&
          searchKeyword.trim().length < 2 &&
          searchCategory === "all" &&
          searchCity === "all" ? (
            <div className="mt-4">
              <p className="text-sm text-slate-300">Suggestions: entreprises recentes</p>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {recentCompanies.map((company) => (
                  <CompanyCoverCard key={company.id} company={company} />
                ))}
              </div>
            </div>
          ) : null}

          {!isSearching &&
          searchResults.length === 0 &&
          (searchKeyword.trim().length >= 2 || searchCategory !== "all" || searchCity !== "all") &&
          !searchError ? (
            <p className="mt-4 rounded-2xl border border-dashed border-[#2a3a68] px-4 py-8 text-center text-sm text-slate-400">
              Aucun resultat pour ces filtres. Essayez un autre mot cle ou une autre categorie.
            </p>
          ) : null}
        </section>

        <section id="jobs" className="reveal-up reveal-delay-3 rounded-3xl border border-[#1f2a4d] bg-[#0b1222] p-7 md:p-10">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="headline-special headline-accent text-3xl font-black">Offres actives</h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[#2a3a68] px-3 py-1 text-xs text-slate-300">
                {activeJobs.length} offre(s)
              </span>
              {activeJobs.length > 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowAllJobs((current) => !current);
                  }}
                  className="rounded-full border border-yellow-500 px-3 py-1 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-500 hover:text-[#05070d]"
                >
                  {showAllJobs ? "Voir moins" : "Voir plus"}
                </button>
              ) : null}
            </div>
          </div>

          {activeJobs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#2a3a68] px-4 py-8 text-center text-sm text-slate-400">
              Aucune offre active pour le moment.
            </p>
          ) : (
            <div className="grid gap-7 md:grid-cols-2">
              {visibleJobs.map((job) => (
                <article key={job.id} className="overflow-hidden rounded-2xl border border-[#2a3a68] bg-[#121d38]">
                  <div className="relative h-36 w-full bg-[#1a2749]">
                    <Image
                      src={job.company?.cover_url || DEFAULT_COMPANY_COVER}
                      alt={job.company?.name || "Entreprise"}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a1120]/80 via-transparent to-transparent" />
                  </div>
                  <div className="space-y-4 p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-black text-white">{job.title}</h3>
                      <span className="text-xs text-slate-300">
                        {job.contract_type || "Contrat"}
                      </span>
                    </div>
                    <p className="text-base text-slate-300">
                      {job.company?.name || "Entreprise"} • {job.location_city || "Ville"}
                      {job.is_remote ? " • Remote" : ""}
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Link
                        href={job.company ? `/entreprises/${job.company.slug}` : "/contact"}
                        className="text-sm font-semibold text-yellow-300 hover:text-yellow-200"
                      >
                        Voir entreprise
                      </Link>
                      <Link
                        href={`/contact?job=${encodeURIComponent(job.id)}`}
                        className="rounded-full border border-yellow-500 px-4 py-2 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-500 hover:text-[#05070d]"
                      >
                        Postuler
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!showAllJobs && activeJobs.length > 4 ? (
            <p className="mt-4 text-xs text-slate-400">
              Affichage limite a 4 offres. Cliquez sur Voir plus pour afficher toutes les offres.
            </p>
          ) : null}
        </section>

        <section id="categories" className="reveal-up reveal-delay-4 rounded-3xl border border-[#1f2a4d] bg-[#0b1222] p-7 md:p-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="headline-special headline-accent text-3xl font-black">
              Entreprises par categorie
            </h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[#2a3a68] px-3 py-1 text-xs text-slate-300">
                {categories.length} categorie(s)
              </span>
              {categorySections.length > 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowAllCategorySections((current) => !current);
                  }}
                  className="rounded-full border border-yellow-500 px-3 py-1 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-500 hover:text-[#05070d]"
                >
                  {showAllCategorySections ? "Voir moins" : "Voir plus"}
                </button>
              ) : null}
            </div>
          </div>

          {!showAllCategorySections && categorySections.length > 4 ? (
            <p className="mb-4 text-xs text-slate-400">
              Affichage limite a 4 categories. Cliquez sur Voir plus pour tout afficher.
            </p>
          ) : null}

          <div className="space-y-10">
            {visibleCategorySections.map((section) => (
              <article key={section.category.id} className="rounded-2xl border border-[#2a3a68] bg-[#101a31] p-6 md:p-7">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black text-white">{section.category.name}</h3>
                    <p className="mt-1 text-base text-slate-300">
                      {CATEGORY_DESCRIPTIONS[section.category.slug] || "Decouvrez les entreprises de cette categorie."}
                    </p>
                  </div>
                  <Link
                    href={`/categories/${section.category.slug}`}
                    className="rounded-full border border-yellow-500 px-4 py-2 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-500 hover:text-[#05070d]"
                  >
                    Voir plus
                  </Link>
                </div>

                <div className="grid gap-7 md:grid-cols-2">
                  {section.companies.map((company) => (
                    <CompanyCoverCard key={company.id} company={company} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Link
            href="/contact"
            className="rounded-3xl border border-[#1f2a4d] bg-[#0a1120] p-7 transition hover:border-yellow-500"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-yellow-300">Contact</p>
            <h3 className="mt-3 text-3xl font-black text-white">Contact professionnel</h3>
            <p className="mt-3 text-sm text-slate-400">
              Formulaire business, reseaux sociaux et echanges rapides avec notre equipe.
            </p>
          </Link>

          <Link
            href="/create-site"
            className="rounded-3xl border border-[#1f2a4d] bg-[#0a1120] p-7 transition hover:border-[#21c7b8]"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-[#21c7b8]">Creation de site</p>
            <h3 className="mt-3 text-3xl font-black text-white">Modeles web et demos live</h3>
            <p className="mt-3 text-sm text-slate-400">
              Decouvrez des templates modernes multimedia et demandez votre site sur mesure.
            </p>
          </Link>
        </section>
      </main>

      <footer className="border-t border-[#16203a] bg-[#04060b]">
        <div className="mx-auto grid w-full max-w-[92rem] gap-8 px-[var(--page-gutter)] py-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/cartevisite-logo.png"
                alt="Logo CarteVisite"
                width={42}
                height={42}
                className="h-10 w-10 rounded-md border border-[#2a3a68] bg-[#0b1222] p-1"
              />
              <p className="headline-script text-2xl text-white">CarteVisite</p>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Plateforme pro pour presenter les entreprises, leurs offres actives et leur visibilite multimedia.
            </p>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.1em] text-slate-300">Navigation</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-slate-400">
              <a href="#search" className="hover:text-yellow-300">Entreprises recentes</a>
              <a href="#jobs" className="hover:text-yellow-300">Offres actives</a>
              <a href="#categories" className="hover:text-yellow-300">Categories</a>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.1em] text-slate-300">Categories</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-slate-400">
              {categories.slice(0, 5).map((category) => (
                <Link key={category.id} href={`/categories/${category.slug}`} className="hover:text-yellow-300">
                  {category.name}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.1em] text-slate-300">Contact</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-slate-400">
              <Link href="/contact" className="hover:text-yellow-300">Page contact</Link>
              <Link href="/create-site" className="hover:text-yellow-300">Creation de site</Link>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" className="hover:text-yellow-300">Formation video</a>
            </div>
          </div>
        </div>
        <div className="border-t border-[#16203a] px-[var(--page-gutter)] py-4 text-center text-xs text-slate-500">
          CarteVisite • 2026 • Solution professionnelle de publications et visibilite d entreprises.
        </div>
      </footer>

      <button
        type="button"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className={`back-to-top-anim fixed bottom-5 right-5 z-50 rounded-full border border-yellow-500 bg-[#05070d]/90 px-4 py-2 text-xs font-bold text-yellow-300 shadow-[0_10px_22px_rgba(0,0,0,0.35)] backdrop-blur transition-all duration-300 hover:bg-yellow-500 hover:text-[#05070d] ${
          showBackToTop ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        Retour haut
      </button>
    </div>
  );
}
