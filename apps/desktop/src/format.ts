import { t, getLang } from "./i18n.js";

export function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} ${t("units.seconds")}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} ${t("units.minutes")}`;
  const h = Math.floor(m / 60);
  return `${h} ${t("units.hours")} ${m % 60} ${t("units.minutes")}`;
}

export function fmtTime(ms: number | null): string {
  if (!ms) return t("status.never");
  return new Date(ms).toLocaleTimeString(getLang());
}

/** Map a tracker error code to a localized label, falling back to the raw code. */
export function errorLabel(code: string): string {
  const key = `error.code.${code}`;
  const label = t(key);
  return label === key ? code : label;
}
