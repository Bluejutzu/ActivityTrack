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
  const [error, setError] = useState<"generic" | "password" | false>(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(false);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    form.set("flow", flow);
    try {
      await signIn("password", form);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(flow === "signUp" && msg.includes("Invalid password") ? "password" : "generic");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm rounded-xl border border-border bg-panel p-6 animate-fade-up">
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
          className="rounded-lg border border-border bg-bg px-3 py-2 transition-colors duration-150 focus:border-accent/60 placeholder:text-muted/60"
        />
        <div className="flex flex-col gap-1">
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder={t("login.password")}
            className="rounded-lg border border-border bg-bg px-3 py-2 transition-colors duration-150 focus:border-accent/60 placeholder:text-muted/60"
          />
          {flow === "signUp" && (
            <p className="text-xs text-muted">{t("login.passwordHint")}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 font-medium text-white transition-colors duration-150 hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy && (
            <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          )}
          {flow === "signIn" ? t("login.submit") : t("login.signupSubmit")}
        </button>
      </form>
      {error && (
        <p className="mt-3 text-sm text-warn animate-fade-up">
          {error === "password" ? t("login.passwordHint") : t("login.error")}
        </p>
      )}
      <button
        onClick={() => {
          setFlow(flow === "signIn" ? "signUp" : "signIn");
          setError(false as const);
        }}
        className="mt-4 text-sm text-accent transition-colors duration-150 hover:text-accent/80 underline-offset-2 hover:underline"
      >
        {flow === "signIn" ? t("login.toSignup") : t("login.toSignin")}
      </button>
      {flow === "signUp" && (
        <p className="mt-3 text-xs text-muted">{t("login.firstUserNote")}</p>
      )}
    </div>
  );
}
