"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "./LangSwitcher";

/**
 * Password sign-in / sign-up. Convex Auth's password provider handles both
 * flows; the first account to register is promoted to it_admin server-side.
 */
export function LoginForm() {
  const { t } = useI18n();
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(false);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    form.set("flow", flow);
    try {
      await signIn("password", form);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm rounded-xl border border-border bg-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("app.name")}</h1>
        <LangSwitcher />
      </div>
      <h2 className="mb-4 text-muted">
        {flow === "signIn" ? t("login.heading") : t("login.signupHeading")}
      </h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder={t("login.email")}
          className="rounded-lg border border-border bg-bg px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder={t("login.password")}
          className="rounded-lg border border-border bg-bg px-3 py-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-3 py-2 font-medium text-white disabled:opacity-60"
        >
          {flow === "signIn" ? t("login.submit") : t("login.signupSubmit")}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-warn">{t("login.error")}</p>}
      <button
        onClick={() => {
          setFlow(flow === "signIn" ? "signUp" : "signIn");
          setError(false);
        }}
        className="mt-4 text-sm text-accent"
      >
        {flow === "signIn" ? t("login.toSignup") : t("login.toSignin")}
      </button>
      {flow === "signUp" && (
        <p className="mt-3 text-xs text-muted">{t("login.firstUserNote")}</p>
      )}
    </div>
  );
}
