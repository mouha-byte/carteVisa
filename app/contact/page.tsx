"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";

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

type ContactResponse = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  message: string;
  is_handled: boolean;
  created_at: string;
};

type ApplicationResponse = {
  id: string;
  receipt_url: string;
  status: string;
};

type ContactFormState = {
  fullName: string;
  email: string;
  phone: string;
  message: string;
};

type SocialPlatform = "linkedin" | "instagram" | "facebook" | "youtube";

type SocialLink = {
  name: string;
  href: string;
  subtitle: string;
  platform: SocialPlatform;
};

const INITIAL_FORM: ContactFormState = {
  fullName: "",
  email: "",
  phone: "",
  message: "",
};

const SOCIAL_LINKS: SocialLink[] = [
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com",
    subtitle: "Partenariats B2B et opportunites entreprise",
    platform: "linkedin",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com",
    subtitle: "News visuelles, reels et promotions",
    platform: "instagram",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com",
    subtitle: "Communautes locales et campagnes social media",
    platform: "facebook",
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com",
    subtitle: "Formation video et demos marketing",
    platform: "youtube",
  },
];

function SocialLogo({ platform }: { platform: SocialPlatform }) {
  if (platform === "linkedin") {
    return (
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0A66C2] text-base font-black text-white">
        in
      </span>
    );
  }

  if (platform === "instagram") {
    return (
      <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#F9CE34] via-[#EE2A7B] to-[#6228D7]">
        <span className="h-5 w-5 rounded-md border-2 border-white" />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-white" />
      </span>
    );
  }

  if (platform === "facebook") {
    return (
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#1877F2] text-2xl font-black leading-none text-white">
        f
      </span>
    );
  }

  return (
    <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-[#FF0000]">
      <span className="ml-0.5 h-0 w-0 border-y-[7px] border-y-transparent border-l-[12px] border-l-white" />
    </span>
  );
}

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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function parseApiPayload(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function ContactPageContent() {
  const searchParams = useSearchParams();
  const jobOfferId = (searchParams.get("job") ?? "").trim();
  const companySlug = (searchParams.get("company") ?? "").trim();
  const isApplicationMode = useMemo(() => isUuid(jobOfferId), [jobOfferId]);

  const [form, setForm] = useState<ContactFormState>(INITIAL_FORM);
  const [applicationCvFile, setApplicationCvFile] = useState<File | null>(null);
  const [motivationLetterFile, setMotivationLetterFile] = useState<File | null>(
    null
  );
  const [applicationReceiptUrl, setApplicationReceiptUrl] = useState<string | null>(
    null
  );
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"ok" | "error" | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSending(true);
    setFeedback(null);
    setFeedbackType(null);
    setApplicationReceiptUrl(null);

    try {
      if (isApplicationMode) {
        if (!applicationCvFile) {
          setFeedbackType("error");
          setFeedback("Le CV est obligatoire pour envoyer votre candidature.");
          return;
        }

        if (!motivationLetterFile) {
          setFeedbackType("error");
          setFeedback(
            "La lettre de motivation est obligatoire pour envoyer votre candidature."
          );
          return;
        }

        const payload = new FormData();
        payload.append("job_offer_id", jobOfferId);
        payload.append("candidate_name", form.fullName.trim());
        payload.append("candidate_email", form.email.trim());

        const phone = form.phone.trim();
        if (phone) {
          payload.append("candidate_phone", phone);
        }

        const coverLetterText = form.message.trim();
        if (coverLetterText) {
          payload.append("cover_letter", coverLetterText);
        }

        payload.append("cv", applicationCvFile);
        payload.append("motivation_letter", motivationLetterFile);

        const response = await fetch("/api/applications", {
          method: "POST",
          body: payload,
        });

        const parsed = await parseApiPayload(response);

        if (isApiSuccess<ApplicationResponse>(parsed)) {
          setFeedbackType("ok");
          setFeedback(
            "Votre candidature a ete envoyee avec succes. Nous vous contacterons rapidement."
          );
          setApplicationReceiptUrl(parsed.data.receipt_url);
          setForm(INITIAL_FORM);
          setApplicationCvFile(null);
          setMotivationLetterFile(null);
        } else if (isApiFailure(parsed)) {
          setFeedbackType("error");
          setFeedback(parsed.error.message);
        } else {
          setFeedbackType("error");
          setFeedback(
            "Une erreur inattendue est survenue. Merci de reessayer dans un instant."
          );
        }

        return;
      }

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: form.fullName,
          email: form.email,
          phone: form.phone || null,
          message: form.message,
        }),
      });

      const parsed = await parseApiPayload(response);

      if (isApiSuccess<ContactResponse>(parsed)) {
        setFeedbackType("ok");
        setFeedback(
          "Votre message a ete envoye avec succes. Notre equipe vous repondra rapidement."
        );
        setForm(INITIAL_FORM);
      } else if (isApiFailure(parsed)) {
        setFeedbackType("error");
        setFeedback(parsed.error.message);
      } else {
        setFeedbackType("error");
        setFeedback(
          "Une erreur inattendue est survenue. Merci de reessayer dans un instant."
        );
      }
    } catch (error) {
      setFeedbackType("error");
      setFeedback(
        error instanceof Error ? error.message : "Erreur reseau. Verifiez votre connexion."
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <SiteBanner />

      <main className="mx-auto w-full max-w-[92rem] px-[var(--page-gutter)] py-8 md:py-12">
        <section className="reveal-up rounded-3xl border border-[#223059] bg-[#0a1120] p-6 md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-yellow-300">
            {isApplicationMode ? "Candidature" : "Contact professionnel"}
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">
            {isApplicationMode
              ? "Envoyez votre candidature avec CV et lettre de motivation."
              : "Parlons de votre croissance digitale et de vos besoins entreprise."}
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-slate-300 md:text-base">
            {isApplicationMode
              ? "Ce formulaire envoie votre dossier directement a notre API de candidatures pour un traitement rapide."
              : "Une page dediee pour centraliser vos demandes, vos informations, et un formulaire clair qui envoie votre message directement par email via notre API."}
          </p>
          {isApplicationMode ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-yellow-400/60 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-200">
                Candidature en cours
              </span>
              {companySlug ? (
                <Link
                  href={`/entreprises/${companySlug}`}
                  className="rounded-full border border-[#2a3a68] px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-yellow-400 hover:text-yellow-200"
                >
                  Voir la page de l entreprise
                </Link>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <article className="reveal-up reveal-delay-1 rounded-3xl border border-[#223059] bg-[#0b1428] p-5 md:p-6">
            <h2 className="text-xl font-black text-white">Reseaux et canaux directs</h2>
            <p className="mt-2 text-sm text-slate-400">
              Choisissez le canal adapte a votre besoin: partenariat, assistance, ou demande
              commerciale.
            </p>

            <div className="mt-5 space-y-3">
              {SOCIAL_LINKS.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 transition hover:border-yellow-500"
                >
                  <div className="flex items-center gap-3">
                    <SocialLogo platform={item.platform} />
                    <div>
                      <p className="text-sm font-bold text-white">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-300">{item.subtitle}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-[#2a3a68] bg-[#121d38] p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-slate-400">Email direct</p>
              <a href="mailto:contact@cartevisite.pro" className="mt-1 block text-sm font-bold text-yellow-300">
                contact@cartevisite.pro
              </a>
              <p className="mt-2 text-xs text-slate-300">Tel: +212 6 00 00 00 00</p>
            </div>
          </article>

          <article className="reveal-up reveal-delay-2 rounded-3xl border border-[#223059] bg-[#0b1428] p-5 md:p-6">
            <h2 className="text-xl font-black text-white">
              {isApplicationMode ? "Envoyer ma candidature" : "Envoyer un message"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {isApplicationMode
                ? "Ajoutez votre CV, votre lettre de motivation et vos coordonnees."
                : "Formulaire rapide avec envoi vers l API contact pour traitement immediat."}
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.fullName}
                onChange={(event) => {
                  setForm((prev) => ({
                    ...prev,
                    fullName: event.target.value,
                  }));
                }}
                placeholder="Nom complet"
                className="w-full rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400"
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
                placeholder="Email professionnel"
                className="w-full rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400"
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
                className="w-full rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400"
              />

              <textarea
                required={!isApplicationMode}
                minLength={isApplicationMode ? undefined : 10}
                maxLength={5000}
                rows={6}
                value={form.message}
                onChange={(event) => {
                  setForm((prev) => ({
                    ...prev,
                    message: event.target.value,
                  }));
                }}
                placeholder={
                  isApplicationMode
                    ? "Message complementaire (optionnel)"
                    : "Expliquez votre besoin en detail"
                }
                className="w-full rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400"
              />

              {isApplicationMode ? (
                <>
                  <label className="block space-y-2">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">
                      CV (PDF, DOC, DOCX)
                    </span>
                    <input
                      required
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) => {
                        setApplicationCvFile(event.target.files?.[0] ?? null);
                      }}
                      className="w-full rounded-2xl border border-[#2a3a68] bg-[#121d38] px-3 py-2 text-xs text-slate-200 file:mr-4 file:rounded-full file:border-0 file:bg-yellow-500 file:px-4 file:py-2 file:text-xs file:font-black file:text-[#05070d] file:transition hover:file:bg-yellow-400"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Lettre de motivation (PDF, DOC, DOCX)
                    </span>
                    <input
                      required
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) => {
                        setMotivationLetterFile(event.target.files?.[0] ?? null);
                      }}
                      className="w-full rounded-2xl border border-[#2a3a68] bg-[#121d38] px-3 py-2 text-xs text-slate-200 file:mr-4 file:rounded-full file:border-0 file:bg-yellow-500 file:px-4 file:py-2 file:text-xs file:font-black file:text-[#05070d] file:transition hover:file:bg-yellow-400"
                    />
                  </label>
                </>
              ) : null}

              <button
                type="submit"
                disabled={isSending}
                className="w-full rounded-full border border-yellow-500 bg-yellow-500 px-6 py-3 text-sm font-black text-[#05070d] transition hover:bg-yellow-400 disabled:opacity-60"
              >
                {isSending
                  ? "Envoi..."
                  : isApplicationMode
                    ? "Envoyer la candidature"
                    : "Envoyer le message"}
              </button>

              {feedback ? (
                <p
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    feedbackType === "ok"
                      ? "border border-emerald-400/40 bg-emerald-950/20 text-emerald-200"
                      : "border border-rose-400/40 bg-rose-950/20 text-rose-200"
                  }`}
                >
                  {feedback}
                </p>
              ) : null}

              {applicationReceiptUrl ? (
                <Link
                  href={applicationReceiptUrl}
                  className="block rounded-2xl border border-yellow-400/50 bg-yellow-500/10 px-4 py-3 text-center text-sm font-semibold text-yellow-200 transition hover:border-yellow-300 hover:bg-yellow-500/20"
                >
                  Voir le recu de candidature
                </Link>
              ) : null}
            </form>
          </article>
        </section>
      </main>
    </div>
  );
}

function ContactPageFallback() {
  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <SiteBanner />
      <main className="mx-auto w-full max-w-[92rem] px-[var(--page-gutter)] py-8 md:py-12">
        <section className="rounded-3xl border border-[#223059] bg-[#0a1120] p-6 md:p-10">
          <p className="text-sm text-slate-300">Chargement...</p>
        </section>
      </main>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<ContactPageFallback />}>
      <ContactPageContent />
    </Suspense>
  );
}
