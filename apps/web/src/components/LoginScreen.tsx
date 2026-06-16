"use client";

import { SignIn } from "@clerk/nextjs";
import { Activity, BarChart3, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "./LangSwitcher";

/**
 * Unauthenticated landing + Clerk sign-in. Clerk owns the credential flow; we
 * wrap it in branded, dark-themed chrome. `routing="hash"` keeps everything on
 * this page so no dedicated /sign-in routes are needed.
 */
export function LoginScreen() {
  const { t } = useI18n();

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-ok/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-10 px-6 py-12 lg:grid-cols-2">
        {/* Brand / value column */}
        <div className="hidden flex-col gap-8 lg:flex animate-fade-up">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent">
              <Activity className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold text-fg">
              {t("app.name")}
            </span>
          </div>
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-fg">
              {t("app.tagline")}
            </h1>
            <p className="mt-3 max-w-md text-muted">{t("footer.privacy")}</p>
          </div>
          <ul className="flex flex-col gap-4 text-sm text-muted">
            <li className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-accent" />
              {t("login.feature.insights")}
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-ok" />
              {t("login.feature.privacy")}
            </li>
          </ul>
        </div>

        {/* Sign-in column */}
        <div className="flex flex-col items-center gap-6 animate-scale-in">
          <div className="flex w-full max-w-sm items-center justify-between lg:hidden">
            <span className="flex items-center gap-2 font-semibold text-fg">
              <Activity className="h-5 w-5 text-accent" />
              {t("app.name")}
            </span>
            <LangSwitcher />
          </div>
          <SignIn
            routing="hash"
            appearance={{
              variables: {
                colorPrimary: "#4c8dff",
                colorBackground: "#141821",
                borderRadius: "0.75rem",
              },
              elements: {
                card: "bg-panel border border-border shadow-soft",
                headerTitle: "text-fg",
                headerSubtitle: "text-muted",
                socialButtonsBlockButton: "border-border",
                footerActionLink: "text-accent hover:text-accent/80",
                formButtonPrimary:
                  "bg-accent hover:bg-accent/90 text-white normal-case",
              },
            }}
          />
          <div className="hidden lg:block">
            <LangSwitcher />
          </div>
        </div>
      </div>
    </div>
  );
}
