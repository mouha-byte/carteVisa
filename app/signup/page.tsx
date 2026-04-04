"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";

import { SiteBanner } from "@/app/ui/site-banner";

type SupabasePublicConfig = {
  supabaseUrl: string;
  anonKey: string;
};

type SupabaseSignupResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  session?: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;
  error_description?: string;
  msg?: string;
};

type StoredAuthSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
};

const AUTH_SESSION_STORAGE_KEY = "cartevisite.auth.session.v1";

function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    anonKey,
  };
}

function saveStoredSession(session: StoredAuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function toStoredSession(payload: SupabaseSignupResponse): StoredAuthSession | null {
  const accessToken = payload.access_token ?? payload.session?.access_token;
  if (!accessToken) {
    return null;
  }

  const refreshToken = payload.refresh_token ?? payload.session?.refresh_token;
  const expiresIn = payload.expires_in ?? payload.session?.expires_in;

  return {
    accessToken,
    refreshToken: refreshToken ?? null,
    expiresAt: typeof expiresIn === "number" ? Date.now() + expiresIn * 1000 : null,
  };
}

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"ok" | "error" | null>(null);

  const nextPath = useMemo(() => {
    const candidate = (searchParams.get("next") ?? "").trim();
    if (candidate.startsWith("/") && !candidate.startsWith("//")) {
      return candidate;
    }

    return "/";
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const config = getSupabasePublicConfig();
    if (!config) {
      setFeedbackType("error");
      setFeedback("Configuration Supabase manquante.");
      return;
    }

    if (password.length < 8) {
      setFeedbackType("error");
      setFeedback("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }

    if (password !== passwordConfirm) {
      setFeedbackType("error");
      setFeedback("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    setFeedbackType(null);

    try {
      const response = await fetch(`${config.supabaseUrl}/auth/v1/signup`, {
        method: "POST",
        headers: {
          apikey: config.anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          data: {
            full_name: fullName.trim(),
          },
        }),
        cache: "no-store",
      });

      const payload = (await response.json()) as SupabaseSignupResponse;

      if (!response.ok) {
        setFeedbackType("error");
        setFeedback(payload.error_description || payload.msg || "Inscription impossible.");
        return;
      }

      const session = toStoredSession(payload);
      if (session) {
        saveStoredSession(session);
        setFeedbackType("ok");
        setFeedback("Compte cree et connecte. Redirection...");
        window.setTimeout(() => {
          router.push(nextPath);
        }, 300);
        return;
      }

      setFeedbackType("ok");
      setFeedback(
        "Compte cree. Verifiez votre email pour activer votre acces, puis connectez-vous."
      );
    } catch {
      setFeedbackType("error");
      setFeedback("Erreur reseau. Reessayez dans quelques instants.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <SiteBanner />

      <main className="mx-auto flex w-full max-w-[92rem] items-center justify-center px-[var(--page-gutter)] py-10 md:py-14">
        <section className="w-full max-w-xl rounded-3xl border border-[#223059] bg-[#0b1428] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.35)] md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-yellow-300">
            Espace compte
          </p>
          <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">Inscription</h1>
          <p className="mt-2 text-sm text-slate-400">
            Creez votre compte pour publier votre entreprise et suivre vos candidatures.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <input
              required
              minLength={2}
              maxLength={120}
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
              }}
              placeholder="Nom complet"
              className="w-full rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400"
            />

            <input
              required
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              placeholder="Email"
              className="w-full rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400"
            />

            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              placeholder="Mot de passe (min 8 caracteres)"
              className="w-full rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400"
            />

            <input
              required
              type="password"
              minLength={8}
              value={passwordConfirm}
              onChange={(event) => {
                setPasswordConfirm(event.target.value);
              }}
              placeholder="Confirmer le mot de passe"
              className="w-full rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full border border-yellow-500 bg-yellow-500 px-6 py-3 text-sm font-black text-[#05070d] transition hover:bg-yellow-400 disabled:opacity-60"
            >
              {isSubmitting ? "Inscription..." : "Creer mon compte"}
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
          </form>

          <div className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-400">
            <p>Deja un compte ?</p>
            <Link
              href={nextPath === "/" ? "/login" : `/login?next=${encodeURIComponent(nextPath)}`}
              className="font-semibold text-yellow-300 hover:text-yellow-200"
            >
              Se connecter
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function SignupPageFallback() {
  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <SiteBanner />
      <main className="mx-auto flex w-full max-w-[92rem] items-center justify-center px-[var(--page-gutter)] py-10 md:py-14">
        <section className="w-full max-w-xl rounded-3xl border border-[#223059] bg-[#0b1428] p-6 md:p-8">
          <p className="text-sm text-slate-300">Chargement...</p>
        </section>
      </main>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupPageFallback />}>
      <SignupPageContent />
    </Suspense>
  );
}