"use client";

import { FormEvent, useEffect, useState } from "react";

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

type ServiceCard = {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  points: string[];
};

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

type CaptchaChallenge = {
  left: number;
  right: number;
  answer: number;
};

type ServiceFormState = {
  fullName: string;
  email: string;
  phone: string;
  serviceType: string;
  objective: string;
  message: string;
};

const SERVICE_CARDS: ServiceCard[] = [
  {
    id: "strategy",
    badge: "ST",
    title: "Strategie et conseil",
    subtitle:
      "Diagnostic business, priorites claires et feuille de route realiste.",
    points: [
      "Audit complet de votre activite",
      "Plan d action concret sur 90 jours",
      "Suivi de performance avec indicateurs",
    ],
  },
  {
    id: "digital",
    badge: "DX",
    title: "Transformation digitale",
    subtitle:
      "Optimisation de vos processus pour gagner en productivite et en qualite.",
    points: [
      "Cartographie des processus internes",
      "Automatisation des taches repetitives",
      "Mise en place de tableaux de pilotage",
    ],
  },
  {
    id: "marketing",
    badge: "MK",
    title: "Marketing et communication",
    subtitle:
      "Positionnement, visibilite et acquisition clients sur les canaux utiles.",
    points: [
      "Clarification de l offre et du message",
      "Campagnes digitales ciblees",
      "Suivi des leads et taux de conversion",
    ],
  },
  {
    id: "training",
    badge: "TR",
    title: "Formation et accompagnement",
    subtitle:
      "Montez en competence avec un cadre pratique adapte a votre equipe.",
    points: [
      "Parcours de formation metier",
      "Coaching operationnel des equipes",
      "Methode simple de progression continue",
    ],
  },
  {
    id: "market",
    badge: "MS",
    title: "Etudes de marche et analyse concurrentielle",
    subtitle: "Lecture claire du marche pour mieux positionner votre offre.",
    points: [
      "Sondages terrain et entretiens clients",
      "Analyse concurrence et signaux prix",
      "Recommandations actionnables pour la croissance",
    ],
  },
  {
    id: "events",
    badge: "EV",
    title: "Organisation d evenements professionnels",
    subtitle:
      "Conferences, forums et rencontres B2B pour accelerer vos opportunites.",
    points: [
      "Planification logistique de A a Z",
      "Coordination des intervenants et partenaires",
      "Mesure d impact et rapport post-evenement",
    ],
  },
];

const SERVICE_OPTIONS = [
  "Strategie et conseil",
  "Transformation digitale",
  "Marketing et communication",
  "Formation et accompagnement",
  "Etudes de marche et analyse concurrentielle",
  "Organisation d evenements professionnels",
];

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "duration",
    question: "Quelle est la duree moyenne d un accompagnement ?",
    answer:
      "Selon votre besoin: de 1 semaine pour un audit rapide a 3 mois pour un programme complet.",
  },
  {
    id: "followup",
    question: "Proposez-vous un suivi apres la mission ?",
    answer:
      "Oui, nous pouvons mettre en place un suivi mensuel avec indicateurs et ajustements.",
  },
  {
    id: "pricing",
    question: "Comment est calcule le tarif ?",
    answer:
      "Le tarif depend du perimetre, du niveau d expertise mobilise et du delai demande.",
  },
];

const INITIAL_FORM: ServiceFormState = {
  fullName: "",
  email: "",
  phone: "",
  serviceType: "",
  objective: "",
  message: "",
};

const INITIAL_CAPTCHA: CaptchaChallenge = {
  left: 2,
  right: 3,
  answer: 5,
};

function createCaptchaChallenge(): CaptchaChallenge {
  const left = Math.floor(Math.random() * 8) + 2;
  const right = Math.floor(Math.random() * 8) + 2;

  return {
    left,
    right,
    answer: left + right,
  };
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

export default function ServicesPage() {
  const [form, setForm] = useState<ServiceFormState>(INITIAL_FORM);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"ok" | "error" | null>(null);
  const [captcha, setCaptcha] = useState<CaptchaChallenge>(INITIAL_CAPTCHA);
  const [captchaInput, setCaptchaInput] = useState("");

  const refreshCaptcha = () => {
    setCaptcha(createCaptchaChallenge());
    setCaptchaInput("");
  };

  useEffect(() => {
    refreshCaptcha();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setFeedback(null);
    setFeedbackType(null);

    const parsedCaptcha = Number.parseInt(captchaInput.trim(), 10);
    if (!Number.isFinite(parsedCaptcha) || parsedCaptcha !== captcha.answer) {
      setFeedbackType("error");
      setFeedback("Verification anti-spam invalide. Merci de recalculer la somme.");
      refreshCaptcha();
      return;
    }

    setIsSending(true);

    try {
      const composedMessage = [
        `Demande de service: ${form.serviceType}`,
        form.objective.trim() ? `Objectif: ${form.objective.trim()}` : null,
        form.message.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: form.fullName,
          email: form.email,
          phone: form.phone || null,
          message: composedMessage,
        }),
      });

      const parsed = await parseApiPayload(response);

      if (isApiSuccess<ContactResponse>(parsed)) {
        setFeedbackType("ok");
        setFeedback(
          "Votre message a ete envoye avec succes. Notre equipe vous repondra rapidement."
        );
        setForm(INITIAL_FORM);
        refreshCaptcha();
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
    <div className="service-page min-h-screen">
      <SiteBanner />

      <main className="mx-auto w-full max-w-[92rem] px-[var(--page-gutter)] py-8 md:py-12">
        <section className="service-panel rounded-3xl border p-6 md:p-10">
          <p className="service-kicker text-xs font-semibold uppercase tracking-[0.14em]">
            Service
          </p>
          <h1 className="service-heading mt-2 text-3xl font-black md:text-5xl">
            Services professionnels
          </h1>
          <p className="service-muted mt-4 max-w-3xl text-sm md:text-base">
            Decouvrez nos expertises et choisissez la formule qui correspond a votre besoin.
            Cette page centralise les informations essentielles et un formulaire rapide pour
            demander un accompagnement.
          </p>
        </section>

        <section className="service-panel mt-6 rounded-3xl border p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="service-heading text-2xl font-black">Nos prestations</h2>
            <span className="service-count-badge rounded-full border px-3 py-1 text-xs font-semibold">
              {SERVICE_CARDS.length} services
            </span>
          </div>

          <ol className="mb-4 grid gap-2 text-sm font-semibold sm:grid-cols-2">
            {SERVICE_CARDS.map((service, index) => (
              <li
                key={`service-list-${service.id}`}
                className="service-soft-panel rounded-xl border px-3 py-2"
              >
                {index + 1}. {service.title}
              </li>
            ))}
          </ol>

          <div className="grid gap-4 md:grid-cols-2">
            {SERVICE_CARDS.map((service) => (
              <article
                key={service.id}
                className="service-soft-panel rounded-2xl border p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="service-subheading text-lg font-black">{service.title}</h3>
                  <span className="service-badge grid h-9 w-9 place-items-center rounded-xl text-xs font-black">
                    {service.badge}
                  </span>
                </div>
                <p className="service-muted text-sm">{service.subtitle}</p>
                <ul className="service-list-text mt-3 space-y-2 text-sm">
                  {service.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <span className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                        ✓
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-6">
            <article className="service-panel rounded-3xl border p-5 md:p-6">
              <h2 className="service-heading text-xl font-black">Comment ca marche</h2>
              <p className="service-muted mt-2 text-sm">
                Un process simple pour aller vite et obtenir une reponse claire.
              </p>

              <div className="mt-5 space-y-3">
                <div className="service-soft-panel rounded-2xl border p-4">
                  <p className="service-subheading text-sm font-bold">01 Analyse du besoin</p>
                  <p className="service-muted mt-1 text-sm">
                    Nous comprenons votre contexte, vos objectifs et vos contraintes.
                  </p>
                </div>
                <div className="service-soft-panel rounded-2xl border p-4">
                  <p className="service-subheading text-sm font-bold">02 Proposition detaillee</p>
                  <p className="service-muted mt-1 text-sm">
                    Vous recevez une proposition avec plan, delais et resultat attendu.
                  </p>
                </div>
                <div className="service-soft-panel rounded-2xl border p-4">
                  <p className="service-subheading text-sm font-bold">03 Lancement accompagne</p>
                  <p className="service-muted mt-1 text-sm">
                    Nous executons avec un suivi regulier jusqu aux livrables.
                  </p>
                </div>
              </div>
            </article>

            <article className="service-panel rounded-3xl border p-5 md:p-6">
              <h2 className="service-heading text-xl font-black md:text-2xl">Questions frequentes</h2>
              <div className="mt-4 space-y-3">
                {FAQ_ITEMS.map((item) => (
                  <article
                    key={item.id}
                    className="service-soft-panel rounded-2xl border p-4"
                  >
                    <h3 className="service-subheading text-sm font-black md:text-base">{item.question}</h3>
                    <p className="service-muted mt-2 text-sm">{item.answer}</p>
                  </article>
                ))}
              </div>
            </article>
          </div>

          <article className="service-panel rounded-3xl border p-5 md:p-6">
            <h2 className="service-heading text-xl font-black">Demander plus d informations</h2>
            <p className="service-muted mt-2 text-sm">
              Choisissez le service qui vous interesse et envoyez votre demande en quelques
              secondes.
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
                className="service-input w-full rounded-xl border px-4 py-3 text-sm outline-none transition"
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
                className="service-input w-full rounded-xl border px-4 py-3 text-sm outline-none transition"
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
                className="service-input w-full rounded-xl border px-4 py-3 text-sm outline-none transition"
              />

              <select
                required
                value={form.serviceType}
                onChange={(event) => {
                  setForm((prev) => ({
                    ...prev,
                    serviceType: event.target.value,
                  }));
                }}
                className="service-input w-full rounded-xl border px-4 py-3 text-sm outline-none transition"
              >
                <option value="">Choisir un service</option>
                {SERVICE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <input
                value={form.objective}
                onChange={(event) => {
                  setForm((prev) => ({
                    ...prev,
                    objective: event.target.value,
                  }));
                }}
                placeholder="Objectif principal (optionnel)"
                className="service-input w-full rounded-xl border px-4 py-3 text-sm outline-none transition"
              />

              <textarea
                required
                minLength={10}
                maxLength={5000}
                rows={5}
                value={form.message}
                onChange={(event) => {
                  setForm((prev) => ({
                    ...prev,
                    message: event.target.value,
                  }));
                }}
                placeholder="Decrivez votre besoin, votre contexte et le resultat attendu"
                className="service-input w-full rounded-xl border px-4 py-3 text-sm outline-none transition"
              />

              <div className="service-soft-panel rounded-2xl border p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="service-subheading text-sm font-bold">Verification anti-spam</p>
                  <button
                    type="button"
                    onClick={refreshCaptcha}
                    className="service-ghost-btn rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
                  >
                    Actualiser
                  </button>
                </div>

                <label className="service-muted block text-sm">
                  <span className="service-subheading mb-2 block font-semibold">
                    Calculez: {captcha.left} + {captcha.right}
                  </span>
                  <input
                    required
                    inputMode="numeric"
                    value={captchaInput}
                    onChange={(event) => {
                      setCaptchaInput(event.target.value.replace(/[^0-9]/g, ""));
                    }}
                    placeholder="Votre reponse"
                    className="service-input w-full rounded-xl border px-4 py-3 text-sm outline-none transition"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="w-full rounded-xl border border-[#2f64d8] bg-[#2f64d8] px-5 py-3 text-sm font-black text-white transition hover:bg-[#2754b5] disabled:opacity-60"
              >
                {isSending ? "Envoi..." : "Envoyer la demande de service"}
              </button>

              {feedback ? (
                <p
                  className={`rounded-xl px-4 py-3 text-sm ${
                    feedbackType === "ok"
                      ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border border-rose-300 bg-rose-50 text-rose-700"
                  }`}
                >
                  {feedback}
                </p>
              ) : null}
            </form>
          </article>
        </section>
      </main>
    </div>
  );
}
