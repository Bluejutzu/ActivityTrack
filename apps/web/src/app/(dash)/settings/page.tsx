"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";

export default function SettingsPage() {
  const { t } = useI18n();
  const isSet = useQuery(api.settings.debugPasswordIsSet);
  const setDebugPassword = useAction(api.settings.setDebugPassword);

  const [pw, setPw] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    if (pw.length < 6) {
      setError(t("settings.debugPw.tooShort"));
      return;
    }
    await setDebugPassword({ password: pw });
    setPw("");
    setSaved(true);
  }

  return (
    <section className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">{t("settings.heading")}</h1>

      <div className="rounded-xl border border-border bg-panel p-4">
        <h2 className="font-medium">{t("settings.debugPw.heading")}</h2>
        <p className="mt-1 text-sm text-muted">{t("settings.debugPw.hint")}</p>
        <p className="mt-2 text-sm">
          {isSet === undefined
            ? t("common.loading")
            : isSet
              ? `✓ ${t("settings.debugPw.set")}`
              : t("settings.debugPw.unset")}
        </p>

        <form onSubmit={onSave} className="mt-4 flex gap-2">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={t("settings.debugPw.new")}
            className="flex-1 rounded-md border border-border bg-bg px-3 py-2"
          />
          <button className="rounded-md bg-accent px-4 py-2 text-white">
            {t("settings.debugPw.save")}
          </button>
        </form>
        {saved && <p className="mt-3 text-sm text-ok">{t("settings.debugPw.saved")}</p>}
        {error && <p className="mt-3 text-sm text-warn">{error}</p>}
      </div>
    </section>
  );
}
