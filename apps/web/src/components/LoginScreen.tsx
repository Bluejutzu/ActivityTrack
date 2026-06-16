"use client";

import { SignIn } from "@clerk/nextjs";
import { Activity, BarChart3, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "./LangSwitcher";

/** A small, friendly preview of exactly what the dashboard shows: a few people
 *  and their plain-language status. Concrete beats abstract on a sign-in page. */
function StatusPreview() {
  const { t } = useI18n();
  const rows = [
    { name: "Anna K.", tone: "ok", live: true, label: t("overview.working") },
    { name: "Marco B.", tone: "warn", live: false, label: t("overview.idleNow") },
    { name: "Priya R.", tone: "muted", live: false, label: t("overview.offline") },
  ] as const;

  const pill: Record<string, string> = {
    ok: "bg-ok/10 text-ok",
    warn: "bg-warn/10 text-warn",
    muted: "bg-panel-2 text-muted",
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-panel p-4 shadow-card">
      <p className="px-1 pb-3 text-sm font-medium text-muted">
        {t("overview.heading")}
      </p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li
            key={r.name}
            className="flex items-center justify-between rounded-xl bg-bg px-3 py-2.5"
          >
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-panel-2 text-xs font-semibold text-muted">
                {r.name.charAt(0)}
              </span>
              {r.name}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${pill[r.tone]}`}
            >
              {r.live && <span className="signal-dot !h-1.5 !w-1.5" />}
              {r.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Unauthenticated landing + Clerk sign-in. Clerk owns the credential flow; we
 * wrap it in calm, light chrome. `routing="hash"` keeps everything on this page
 * so no dedicated /sign-in routes are needed.
 */
export function LoginScreen() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-12 px-6 py-12 lg:grid-cols-[1.05fr_1fr]">
        {/* Brand / value column */}
        <div className="hidden flex-col gap-8 lg:flex animate-fade-up">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white shadow-sm">
              <Activity className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tightest text-fg">
              {t("app.name")}
            </span>
          </div>

          <div>
            <h1 className="text-[2.4rem] font-semibold leading-[1.1] tracking-tightest text-fg">
              {t("app.tagline")}
            </h1>
            <p className="mt-4 max-w-md leading-relaxed text-muted">
              {t("footer.privacy")}
            </p>
          </div>

          <StatusPreview />

          <ul className="flex flex-col gap-4 text-sm">
            <li className="flex items-center gap-3 text-fg">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                <BarChart3 className="h-[18px] w-[18px]" />
              </span>
              {t("login.feature.insights")}
            </li>
            <li className="flex items-center gap-3 text-fg">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ok/10 text-ok">
                <ShieldCheck className="h-[18px] w-[18px]" />
              </span>
              {t("login.feature.privacy")}
            </li>
          </ul>
        </div>

        {/* Sign-in column */}
        <div className="flex flex-col items-center gap-6 animate-scale-in">
          <div className="flex w-full max-w-sm items-center justify-between lg:hidden">
            <span className="flex items-center gap-2 font-semibold tracking-tightest text-fg">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-white">
                <Activity className="h-4 w-4" />
              </span>
              {t("app.name")}
            </span>
            <LangSwitcher />
          </div>
          <SignIn
            routing="hash"
            appearance={{
              variables: {
                colorPrimary: "#2e6cf6",
                colorBackground: "#ffffff",
                colorInputBackground: "#ffffff",
                colorText: "#1b2027",
                colorTextSecondary: "#5b6573",
                colorInputText: "#1b2027",
                borderRadius: "0.75rem",
              },
              elements: {
                card: "bg-panel border border-border shadow-card",
                headerTitle: "text-fg",
                headerSubtitle: "text-muted",
                socialButtonsBlockButton: "border-border",
                footerActionLink: "text-accent hover:text-accent/80",
                formButtonPrimary:
                  "bg-accent hover:bg-accent/90 text-white font-semibold normal-case",
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
