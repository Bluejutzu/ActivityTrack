"use client";

import { useI18n, type Lang } from "@/lib/i18n";

/** German/English toggle shown in the header and on the login screen. */
export function LangSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      {/* Hide the word on small screens so the header never squishes. */}
      <span className="hidden sm:inline">{t("lang.label")}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label={t("lang.label")}
        className="h-9 rounded-md border border-border bg-bg px-2 text-fg transition-colors hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <option value="de">Deutsch</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
