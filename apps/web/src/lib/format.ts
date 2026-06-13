import type { Lang } from "./i18n";

export type Role = "it_admin" | "manager" | "viewer";

const RANK: Record<Role, number> = { viewer: 0, manager: 1, it_admin: 2 };

export function roleAtLeast(role: Role | undefined, min: Role): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

/** "3h 42m" / "3 Std. 42 Min." style duration from seconds. */
export function formatDuration(totalSeconds: number, lang: Lang): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const u =
    lang === "de"
      ? { h: "Std.", m: "Min.", s: "Sek." }
      : { h: "h", m: "m", s: "s" };
  if (h > 0) return `${h} ${u.h} ${m} ${u.m}`;
  if (m > 0) return `${m} ${u.m}`;
  return `${s} ${u.s}`;
}

export function formatTime(ms: number | null | undefined, lang: Lang): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(lang);
}

/** YYYY-MM-DD for an instant in a given tz offset (minutes, JS convention). */
export function localDay(at: number, tzOffsetMinutes = 0): string {
  return new Date(at - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** Today's local-day string in the browser's timezone. */
export function todayLocalDay(): string {
  return localDay(Date.now(), new Date().getTimezoneOffset());
}
