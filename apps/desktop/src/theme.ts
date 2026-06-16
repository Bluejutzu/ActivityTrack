/**
 * Tiny light/dark theme helper for the tray UI, mirroring i18n.ts. The choice is
 * applied as `data-theme` on <html> (which flips the CSS variables in styles.css)
 * and persists in localStorage. An inline script in index.html applies the
 * saved/system theme before first paint to avoid a flash; this keeps it in sync.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "activitytrack.theme";

let current: Theme = loadTheme();

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function getTheme(): Theme {
  return current;
}

export function setTheme(theme: Theme): void {
  current = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  document.documentElement.dataset.theme = theme;
}
