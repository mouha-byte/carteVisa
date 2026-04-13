"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

import { SiteBanner } from "@/app/ui/site-banner";

type CompanyDetail = {
  id: string;
  name: string;
  slug: string;
  company_type: "sarl" | "startup";
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
  jobs: Array<{
    id: string;
    title: string;
    contract_type: string | null;
    location_city: string | null;
    is_remote: boolean;
  }>;
  services: Array<{
    id: string;
    title: string;
    description: string | null;
    price_label: string | null;
  }>;
  news: Array<{
    id: string;
    title: string;
    content: string;
    image_url: string | null;
    published_at: string;
  }>;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
};

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

type SocialPlatform = "linkedin" | "facebook" | "instagram" | "youtube";

type SocialLink = {
  label: string;
  href: string;
  platform: SocialPlatform;
};

function isApiSuccess<T>(value: unknown): value is ApiSuccess<T> {
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

function companyInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() ?? "");

  return parts.join("") || "CV";
}

function SocialMediaIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === "linkedin") {
    return (
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#0A66C2] text-lg font-black text-white">
        in
      </span>
    );
  }

  if (platform === "facebook") {
    return (
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#1877F2] text-2xl font-black leading-none text-white">
        f
      </span>
    );
  }

  if (platform === "instagram") {
    return (
      <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[#F9CE34] via-[#EE2A7B] to-[#6228D7]">
        <span className="h-6 w-6 rounded-md border-2 border-white" />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-white" />
      </span>
    );
  }

  return (
    <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-[#FF0000]">
      <span className="ml-0.5 h-0 w-0 border-y-[7px] border-y-transparent border-l-[12px] border-l-white" />
    </span>
  );
}

export default function CompanyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCompany() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/companies/${encodeURIComponent(slug)}`);
        const raw = await response.text();
        const payload: unknown = raw ? JSON.parse(raw) : null;

        if (isApiSuccess<CompanyDetail>(payload)) {
          if (active) {
            setCompany(payload.data);
          }
        } else if (isApiFailure(payload)) {
          if (active) {
            setError(payload.error.message);
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

    void loadCompany();

    return () => {
      active = false;
    };
  }, [slug]);

  const mapQuery = useMemo(() => {
    if (!company) {
      return "Casablanca";
    }

    const query = [company.address, company.city, company.country]
      .filter((item) => Boolean(item))
      .join(", ");

    return query || company.name;
  }, [company]);

  const galleryImages = useMemo(() => {
    if (!company) {
      return [] as string[];
    }

    const media = [
      company.cover_url,
      company.logo_url,
      ...company.news.map((item) => item.image_url),
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80",
    ].filter((item): item is string => Boolean(item));

    return [...new Set(media)].slice(0, 6);
  }, [company]);

  const socialLinks = useMemo<SocialLink[]>(() => {
    if (!company) {
      return [] as SocialLink[];
    }

    const encodedName = encodeURIComponent(company.name);
    const tag = company.slug.replace(/-/g, "");

    return [
      {
        label: "LinkedIn",
        href: `https://www.linkedin.com/search/results/companies/?keywords=${encodedName}`,
        platform: "linkedin",
      },
      {
        label: "Facebook",
        href: `https://www.facebook.com/search/top?q=${encodedName}`,
        platform: "facebook",
      },
      {
        label: "Instagram",
        href: `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}`,
        platform: "instagram",
      },
      {
        label: "YouTube",
        href: `https://www.youtube.com/results?search_query=${encodedName}`,
        platform: "youtube",
      },
    ];
  }, [company]);

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <SiteBanner />

      <main className="mx-auto w-full max-w-[92rem] px-[var(--page-gutter)] py-8 md:py-10">
        {loading ? (
          <div className="rounded-3xl border border-[#223059] bg-[#0a1120] p-8 text-sm text-slate-300">
            Chargement de la fiche entreprise...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-3xl border border-rose-500/40 bg-rose-950/20 p-8 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {!loading && !error && company ? (
          <div className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-[#223059] bg-[#0a1120]">
              <div className="relative aspect-[21/8] min-h-[260px] w-full bg-[#101a31]">
                {company.cover_url ? (
                  <Image
                    src={company.cover_url}
                    alt={`Cover ${company.name}`}
                    fill
                    className="object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-[#05070d]/95 via-[#05070d]/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <div className="flex items-end gap-4">
                    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#2a3a68] bg-[#121d38] text-lg font-black text-white">
                      {company.logo_url ? (
                        <Image
                          src={company.logo_url}
                          alt={`Logo ${company.name}`}
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        companyInitials(company.name)
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-yellow-300">Fiche entreprise</p>
                      <h1 className="text-2xl font-black text-white md:text-4xl">{company.name}</h1>
                      <p className="mt-1 text-sm text-slate-200">
                        {company.company_type === "startup" ? "Startup" : "SARL"} • {company.sector || "Secteur non specifie"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <article className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
                <h2 className="text-xl font-black text-white">Description complete</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  {company.description || "Cette entreprise n a pas encore publie de description detaillee."}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">Type</p>
                    <p className="mt-1 text-sm text-white">{company.company_type === "startup" ? "Startup" : "SARL"}</p>
                  </div>
                  <div className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">Adresse</p>
                    <p className="mt-1 text-sm text-white">{company.address || "Non precisee"}</p>
                  </div>
                  <div className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">Telephone</p>
                    <p className="mt-1 text-sm text-white">{company.phone || "Non precise"}</p>
                  </div>
                  <div className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">Email</p>
                    <p className="mt-1 text-sm text-white">{company.email || "Non precise"}</p>
                  </div>
                  <div className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">Site web</p>
                    {company.website_url ? (
                      <a href={company.website_url} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-yellow-300 hover:text-yellow-200">
                        {company.website_url}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-white">Non precise</p>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">Reseaux sociaux</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {socialLinks.map((social) => (
                      <a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noreferrer"
                        title={social.label}
                        aria-label={social.label}
                        className="rounded-xl transition hover:scale-105 focus-visible:scale-105"
                      >
                        <SocialMediaIcon platform={social.platform} />
                        <span className="sr-only">{social.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </article>

              <article className="rounded-3xl border border-[#223059] bg-[#0b1428] p-4">
                <h2 className="text-lg font-black text-white">Localisation (Google Maps)</h2>
                <div className="mt-3 overflow-hidden rounded-2xl border border-[#2a3a68]">
                  <iframe
                    title="Carte entreprise"
                    src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
                    className="h-[320px] w-full"
                    loading="lazy"
                  />
                </div>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <article className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
                <h2 className="text-xl font-black text-white">Produits / Services</h2>
                <div className="mt-4 space-y-3">
                  {company.services.length === 0 ? (
                    <p className="text-sm text-slate-400">Aucun service publie pour le moment.</p>
                  ) : (
                    company.services.map((service) => (
                      <div key={service.id} className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
                        <p className="text-sm font-bold text-white">{service.title}</p>
                        <p className="mt-1 text-xs text-slate-300">{service.description || "Service professionnel."}</p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-xs text-yellow-300">{service.price_label || "Sur devis"}</span>
                          <Link
                            href={`/contact?service=${encodeURIComponent(service.id)}&company=${encodeURIComponent(company.slug)}`}
                            className="rounded-full border border-[#2a3a68] px-3 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-[#1a2a4d]"
                          >
                            Demander ce service
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
                <h2 className="text-xl font-black text-white">Actualites entreprise</h2>
                <div className="mt-4 space-y-3">
                  {company.news.length === 0 ? (
                    <p className="text-sm text-slate-400">Aucune actualite pour le moment.</p>
                  ) : (
                    company.news.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
                        <p className="text-sm font-bold text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-300">{item.content}</p>
                        <p className="mt-2 text-[11px] text-slate-400">{new Date(item.published_at).toLocaleDateString("fr-FR")}</p>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>

            <section className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-white">Postes ouverts</h2>
                <span className="rounded-full border border-[#2a3a68] px-3 py-1 text-xs text-slate-300">
                  {company.jobs.length} offre(s)
                </span>
              </div>
              {company.jobs.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#2a3a68] px-4 py-8 text-sm text-slate-400">
                  Aucun poste ouvert pour le moment.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {company.jobs.map((job) => (
                    <article key={job.id} className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
                      <h3 className="text-sm font-black text-white">{job.title}</h3>
                      <p className="mt-1 text-xs text-slate-300">
                        {job.contract_type || "Contrat"} • {job.location_city || "Ville"}
                        {job.is_remote ? " • Remote" : ""}
                      </p>
                      <Link
                        href={`/contact?job=${encodeURIComponent(job.id)}&company=${encodeURIComponent(company.slug)}`}
                        className="mt-3 inline-flex rounded-full border border-yellow-500 px-4 py-1.5 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-500 hover:text-[#05070d]"
                      >
                        Postuler
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-[#223059] bg-[#0b1428] p-6">
              <h2 className="text-xl font-black text-white">Galerie photos</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {galleryImages.map((imageUrl) => (
                  <div key={imageUrl} className="relative h-40 overflow-hidden rounded-2xl border border-[#2a3a68]">
                    <Image src={imageUrl} alt="Media entreprise" fill className="object-cover" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
