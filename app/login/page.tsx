"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { SiteBanner } from "@/app/ui/site-banner";

type SupabasePublicConfig = {
  supabaseUrl: string;
  anonKey: string;
};

type SupabaseAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
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

function toStoredSession(payload: SupabaseAuthTokenResponse): StoredAuthSession | null {
  if (!payload.access_token) {
    return null;
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt:
      typeof payload.expires_in === "number"
        ? Date.now() + payload.expires_in * 1000
        : null,
  };
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    setIsSubmitting(true);
    setFeedback(null);
    setFeedbackType(null);

    try {
      const response = await fetch(
        `${config.supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            apikey: config.anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
          cache: "no-store",
        }
      );

      const payload = (await response.json()) as SupabaseAuthTokenResponse;

      if (!response.ok) {
        setFeedbackType("error");
        setFeedback(
          payload.error_description || payload.msg || "Connexion invalide."
        );
        return;
      }

      const session = toStoredSession(payload);
      if (!session) {
        setFeedbackType("error");
        setFeedback("Session invalide recue depuis le serveur auth.");
        return;
      }

      saveStoredSession(session);
      setFeedbackType("ok");
      setFeedback("Connexion reussie. Redirection...");

      window.setTimeout(() => {
        router.push(nextPath);
      }, 300);
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
          <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">Connexion</h1>
          <p className="mt-2 text-sm text-slate-400">
            Connectez-vous a votre compte pour gerer votre entreprise et vos candidatures.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
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
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              placeholder="Mot de passe"
              className="w-full rounded-2xl border border-[#2a3a68] bg-[#121d38] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full border border-yellow-500 bg-yellow-500 px-6 py-3 text-sm font-black text-[#05070d] transition hover:bg-yellow-400 disabled:opacity-60"
            >
              {isSubmitting ? "Connexion..." : "Se connecter"}
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
            <p>Pas encore de compte ?</p>
            <Link
              href={nextPath === "/" ? "/signup" : `/signup?next=${encodeURIComponent(nextPath)}`}
              className="font-semibold text-yellow-300 hover:text-yellow-200"
            >
              Creer un compte
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}