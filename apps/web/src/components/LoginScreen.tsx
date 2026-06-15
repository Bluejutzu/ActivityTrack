"use client";

import { SignIn } from "@clerk/nextjs";
import { Activity, BarChart3, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "./LangSwitcher";

/** Animated "activity" equalizer — the product's heartbeat, rendered as a live
 *  signal trace. Heights/delays are deterministic so SSR and client agree. */
function SignalBars() {
  const bars = Array.from({ length: 28 }, (_, i) => {
    const h = 18 + Math.abs(Math.sin(i * 1.7) * 78);
    const delay = (i * 90) % 1300;
    const dur = 900 + ((i * 137) % 700);
    return { h, delay, dur, i };
  });
  return (
    <div
      aria-hidden
      className="flex h-24 items-end gap-1.5 opacity-80"
      style={{ maskImage: "linear-gradient(90deg, #000, #000 75%, transparent)" }}
    >
      {bars.map((b) => (
        <span
          key={b.i}
          className="w-1.5 flex-1 rounded-full bg-gradient-to-t from-accent/30 to-accent"
          style={{
            height: `${b.h}%`,
            animation: `pulse-dot ${b.dur}ms ease-in-out ${b.delay}ms infinite`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Unauthenticated landing + Clerk sign-in. Clerk owns the credential flow; we
 * wrap it in branded, signal-themed chrome. `routing="hash"` keeps everything
 * on this page so no dedicated /sign-in routes are needed.
 */
export function LoginScreen() {
  const { t } = useI18n();

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      {/* Ambient signal glow + sweeping scan line */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[26rem] w-[26rem] rounded-full bg-info/10 blur-3xl" />
        <div className="signal-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(80%_60%_at_30%_30%,#000,transparent)]" />
        <div className="absolute inset-x-0 top-0 h-px overflow-hidden">
          <div className="h-px w-1/3 animate-sweep-x bg-signal-line" />
        </div>
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_1fr]">
        {/* Brand / value column */}
        <div className="hidden flex-col gap-9 lg:flex animate-fade-up">
          <div className="flex items-center gap-2.5">
            <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-accent/30 bg-accent/10 text-accent shadow-signal-sm">
              <Activity className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-semibold tracking-tightest text-fg">
                {t("app.name")}
              </span>
              <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.28em] text-muted">
                Signal Deck
              </span>
            </span>
          </div>

          <div>
            <p className="kicker mb-3">// Activity telemetry</p>
            <h1 className="font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tightest text-fg">
              {t("app.tagline")}
            </h1>
            <p className="mt-4 max-w-md leading-relaxed text-muted">
              {t("footer.privacy")}
            </p>
          </div>

          <SignalBars />

          <ul className="flex flex-col gap-4 text-sm">
            <li className="flex items-center gap-3 text-fg">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
                <BarChart3 className="h-[18px] w-[18px]" />
              </span>
              {t("login.feature.insights")}
            </li>
            <li className="flex items-center gap-3 text-fg">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-info/25 bg-info/10 text-info">
                <ShieldCheck className="h-[18px] w-[18px]" />
              </span>
              {t("login.feature.privacy")}
            </li>
          </ul>
        </div>

        {/* Sign-in column */}
        <div className="flex flex-col items-center gap-6 animate-scale-in">
          <div className="flex w-full max-w-sm items-center justify-between lg:hidden">
            <span className="flex items-center gap-2 font-display font-semibold tracking-tightest text-fg">
              <Activity className="h-5 w-5 text-accent" />
              {t("app.name")}
            </span>
            <LangSwitcher />
          </div>
          <SignIn
            routing="hash"
            appearance={{
              variables: {
                colorPrimary: "#c8f05a",
                colorBackground: "#10141a",
                colorInputBackground: "#0a0c0f",
                colorText: "#e9edf3",
                colorTextSecondary: "#838d9b",
                colorInputText: "#e9edf3",
                borderRadius: "0.75rem",
              },
              elements: {
                card: "bg-panel border border-border shadow-soft",
                headerTitle: "text-fg",
                headerSubtitle: "text-muted",
                socialButtonsBlockButton: "border-border",
                footerActionLink: "text-accent hover:text-accent/80",
                formButtonPrimary:
                  "bg-accent hover:bg-accent/90 text-[#0a0c0f] font-semibold normal-case",
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
