"use client";

import { FormEvent, useState } from "react";

import { SiteBanner } from "@/app/ui/site-banner";

type ApiError = {
  code: string;
  message: string;
};

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error: ApiError;
};

type SiteRequestResponse = {
  id: string;
  company_name: string;
  sector: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  needs: string;
  status: "new" | "in_progress" | "closed";
  created_at: string;
  updated_at: string;
};

type SiteRequestForm = {
  companyName: string;
  sector: string;
  contactName: string;
  email: string;
  phone: string;
  needs: string;
};

type TemplateCard = {
  title: string;
  description: string;
  thumbnail: string;
  liveUrl: string;
};

type LiveLinkCard = {
  title: string;
  description: string;
  liveUrl: string;
};

const INITIAL_FORM: SiteRequestForm = {
  companyName: "",
  sector: "",
  contactName: "",
  email: "",
  phone: "",
  needs: "",
};

const TEMPLATE_MODELS: TemplateCard[] = [
  {
    title: "Corporate Executive",
    description: "Site institutionnel premium avec forte credibilite visuelle.",
    thumbnail:
      "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?auto=format&fit=crop&w=1200&q=80",
    liveUrl: "https://demo.vercel.store",
  },
  {
    title: "Startup Momentum",
    description: "Landing conversion orientee acquisition et campagnes ads.",
    thumbnail:
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=80",
    liveUrl: "https://tailwindui.com",
  },
  {
    title: "Agency Visual Pro",
    description: "Portfolio agence avec animations, videos et galerie projets.",
    thumbnail:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    liveUrl: "https://vercel.com/templates",
  },
  {
    title: "Ecommerce Flash",
    description: "Boutique orientee performance mobile et conversion checkout.",
    thumbnail:
      "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=80",
    liveUrl: "https://commercejs.com",
  },
];

const EXTRA_LIVE_LINKS: LiveLinkCard[] = [
  {
    title: "SaaS Dashboard Live",
    description: "Interface SaaS complete avec tableaux de bord, analytics et espaces membres.",
    liveUrl: "https://vercel.com/templates/next.js",
  },
  {
    title: "Portfolio Agency Live",
    description: "Showcase agence avec sections services, etudes de cas et contact conversion.",
    liveUrl: "https://www.webflow.com/templates",
  },
  {
    title: "Ecommerce Boutique Live",
    description: "Boutique moderne orientee mobile-first et tunnel de conversion optimise.",
    liveUrl: "https://demo.vercel.store",
  },
  {
    title: "Landing Campagne Live",
    description: "Landing marketing conversion avec hero impactant, FAQ et CTA multi-niveaux.",
    liveUrl: "https://tailwindui.com/templates",
  },
];

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

export default function CreateSitePage() {
  const [form, setForm] = useState<SiteRequestForm>(INITIAL_FORM);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"ok" | "error" | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSending(true);
    setFeedback(null);
    setFeedbackType(null);

    try {
      const response = await fetch("/api/site-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_name: form.companyName,
          sector: form.sector || null,
          contact_name: form.contactName,
          email: form.email,
          phone: form.phone || null,
          needs: form.needs,
        }),
      });

      const raw = await response.text();
      const parsed: unknown = raw ? JSON.parse(raw) : null;

      if (isApiSuccess<SiteRequestResponse>(parsed)) {
        setFeedbackType("ok");
        setFeedback(
          "Votre demande de creation de site a ete envoyee. Notre equipe vous recontacte rapidement."
        );
        setForm(INITIAL_FORM);
      } else if (isApiFailure(parsed)) {
        setFeedbackType("error");
        setFeedback(parsed.error.message);
      } else {
        setFeedbackType("error");
        setFeedback("Une erreur inattendue est survenue. Merci de reessayer.");
      }
    } catch (error) {
      setFeedbackType("error");
      setFeedback(
        error instanceof Error ? error.message : "Erreur reseau. Verifiez votre connexion."
      );
    }

    setIsSending(false);
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <SiteBanner />

      <main className="mx-auto w-full max-w-[92rem] px-[var(--page-gutter)] py-8 md:py-12">
        <section className="reveal-up rounded-3xl border border-[#223059] bg-[#0a1120] p-6 md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#21c7b8]">
            Creation de site web
          </p>
          <h1 className="mt-2 max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl">
            Une page complete avec modeles professionnels, photos, videos et liens live.
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-slate-300 md:text-base">
            Choisissez un modele, inspirez-vous des references visuelles, et envoyez votre brief
            pour lancer votre nouveau site rapidement.
          </p>
        </section>

        <section className="mt-6 reveal-up reveal-delay-1 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TEMPLATE_MODELS.map((model) => (
            <article
              key={model.title}
              className="overflow-hidden rounded-3xl border border-[#223059] bg-[#0b1428]"
            >
              <div
                className="h-36 w-full bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(5,7,13,0) 0%, rgba(5,7,13,0.8) 100%), url('${model.thumbnail}')`,
                }}
              />
              <div className="p-4">
                <h2 className="text-sm font-black text-white">{model.title}</h2>
                <p className="mt-1 text-xs text-slate-300">{model.description}</p>
                <a
                  href={model.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full border border-[#2a3a68] px-3 py-1.5 text-xs font-semibold text-yellow-300 transition hover:border-yellow-500"
                >
                  Open Live
                </a>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 reveal-up reveal-delay-2 rounded-3xl border border-[#223059] bg-[#0b1428] p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-xl font-black text-white">Autres sites live</h2>
            <span className="rounded-full border border-[#2a3a68] px-3 py-1 text-xs text-slate-300">
              {EXTRA_LIVE_LINKS.length} references
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {EXTRA_LIVE_LINKS.map((item) => (
              <article key={item.title} className="rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
                <p className="text-sm font-black text-white">{item.title}</p>
                <p className="mt-2 text-xs text-slate-300">{item.description}</p>
                <a
                  href={item.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full border border-yellow-500 px-3 py-1.5 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-500 hover:text-[#05070d]"
                >
                  Ouvrir le live
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 reveal-up reveal-delay-4 rounded-3xl border border-[#223059] bg-[#0b1428] p-5 md:p-6">
          <h2 className="text-xl font-black text-white">Demande de creation</h2>
          <p className="mt-2 text-sm text-slate-400">
            Ce formulaire envoie une demande complete a l API de creation de site.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-3 md:grid-cols-2">
            <input
              required
              minLength={2}
              maxLength={160}
              value={form.companyName}
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  companyName: event.target.value,
                }));
              }}
              placeholder="Nom entreprise"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-[#21c7b8]"
            />

            <input
              value={form.sector}
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  sector: event.target.value,
                }));
              }}
              placeholder="Secteur (optionnel)"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-[#21c7b8]"
            />

            <input
              required
              minLength={2}
              maxLength={120}
              value={form.contactName}
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  contactName: event.target.value,
                }));
              }}
              placeholder="Nom du contact"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-[#21c7b8]"
            />

            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  email: event.target.value,
                }));
              }}
              placeholder="Email"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-[#21c7b8]"
            />

            <input
              value={form.phone}
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  phone: event.target.value,
                }));
              }}
              placeholder="Telephone (optionnel)"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-[#21c7b8] md:col-span-2"
            />

            <textarea
              required
              minLength={10}
              maxLength={5000}
              rows={6}
              value={form.needs}
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  needs: event.target.value,
                }));
              }}
              placeholder="Decrivez votre projet, style, pages, objectifs et delais"
              className="rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-[#21c7b8] md:col-span-2"
            />

            <button
              type="submit"
              disabled={isSending}
              className="rounded-full border border-[#21c7b8] bg-[#21c7b8] px-6 py-3 text-sm font-black text-[#05070d] transition hover:bg-[#1cb3a6] disabled:opacity-60 md:col-span-2"
            >
              {isSending ? "Envoi..." : "Envoyer la demande"}
            </button>

            {feedback ? (
              <p
                className={`rounded-2xl px-4 py-3 text-sm md:col-span-2 ${
                  feedbackType === "ok"
                    ? "border border-emerald-400/40 bg-emerald-950/20 text-emerald-200"
                    : "border border-rose-400/40 bg-rose-950/20 text-rose-200"
                }`}
              >
                {feedback}
              </p>
            ) : null}
          </form>
        </section>
      </main>
    </div>
  );
}
