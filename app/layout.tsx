import type { Metadata } from "next";
import { IBM_Plex_Mono, Sora } from "next/font/google";
import Script from "next/script";
import { SiteLanguageSync } from "@/app/ui/site-language-sync";
import "./globals.css";

const THEME_INIT_SCRIPT = `
(() => {
  try {
    const storageKey = "cartevisite.theme.v1";
    const stored = window.localStorage.getItem(storageKey);
    const theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
`;

const LANGUAGE_INIT_SCRIPT = `
(() => {
  try {
    const storageKey = "cartevisite.language.v1";
    const stored = window.localStorage.getItem(storageKey);
    const language =
      stored === "fr" || stored === "en" || stored === "ar"
        ? stored
        : "fr";

    document.documentElement.setAttribute("lang", language);
    document.documentElement.setAttribute("data-language", language);
    document.documentElement.setAttribute("dir", language === "ar" ? "rtl" : "ltr");
  } catch {
    document.documentElement.setAttribute("lang", "fr");
    document.documentElement.setAttribute("data-language", "fr");
    document.documentElement.setAttribute("dir", "ltr");
  }
})();
`;

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "carteVisitee",
  description:
    "Plateforme entreprises, offres d'emploi, et services de creation de site web.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      dir="ltr"
      data-language="fr"
      data-theme="dark"
      suppressHydrationWarning
      className={`${sora.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="cartevisite-language-init" strategy="beforeInteractive">
          {LANGUAGE_INIT_SCRIPT}
        </Script>
        <Script id="cartevisite-theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <SiteLanguageSync />
        {children}
      </body>
    </html>
  );
}
