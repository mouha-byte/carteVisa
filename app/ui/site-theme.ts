export type SiteTheme = "light" | "dark";

export const SITE_THEME_STORAGE_KEY = "cartevisite.theme.v1";
export const SITE_THEME_EVENT = "cartevisite:theme-change";

export function normalizeSiteTheme(value: string | null | undefined): SiteTheme {
  return value === "light" ? "light" : "dark";
}

function getSystemTheme(): SiteTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function loadSiteThemeFromStorage(): SiteTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  try {
    const stored = window.localStorage.getItem(SITE_THEME_STORAGE_KEY);
    return stored ? normalizeSiteTheme(stored) : getSystemTheme();
  } catch {
    return getSystemTheme();
  }
}

export function applyThemeToDocument(theme: SiteTheme): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-theme", theme);
}

export function setSiteTheme(theme: SiteTheme): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SITE_THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures and still apply the theme for this session.
  }

  applyThemeToDocument(theme);
  window.dispatchEvent(
    new CustomEvent<{ theme: SiteTheme }>(SITE_THEME_EVENT, {
      detail: { theme },
    })
  );
}

export function subscribeToSiteTheme(
  listener: (theme: SiteTheme) => void
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ theme?: SiteTheme }>;
    listener(normalizeSiteTheme(customEvent.detail?.theme));
  };

  window.addEventListener(SITE_THEME_EVENT, handler as EventListener);

  return () => {
    window.removeEventListener(SITE_THEME_EVENT, handler as EventListener);
  };
}
