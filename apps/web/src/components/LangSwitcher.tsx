"use client";

import { useI18n, type Lang } from "@/lib/i18n";

/** German/English toggle shown in the header and on the login screen. */
export function LangSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span>{t("lang.label")}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="rounded-md border border-border bg-bg px-2 py-1 text-fg"
      >
        <option value="de">Deutsch</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
