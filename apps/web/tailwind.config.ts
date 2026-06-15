import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * "Signal" — a precision telemetry command deck.
 *
 * The product detects the *signal* of human activity, so the active state IS the
 * brand colour: a sharp signal-lime against deep ink. Dominant dark surfaces +
 * one decisive accent (per the design brief) instead of a timid, even palette.
 * Type system: Bricolage Grotesque (display) · IBM Plex Sans (body) · IBM Plex
 * Mono (every numeral, id and timestamp — the data layer).
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: [
          "var(--font-display)",
          "var(--font-sans)",
          "ui-sans-serif",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        // ── Ink surfaces (dominant) ──────────────────────────────────────
        bg: "#0A0C0F",
        "bg-2": "#0C0F13",
        panel: "#10141A",
        "panel-2": "#161C24",
        border: "#1F2630",
        "border-soft": "#161B22",
        muted: "#838D9B",
        fg: "#E9EDF3",
        // ── The signal (sharp accent = the "active" state = the brand) ───
        accent: "#C8F05A",
        signal: "#C8F05A",
        ok: "#C8F05A",
        // ── Other telemetry states ───────────────────────────────────────
        warn: "#F5B544",
        idle: "#F5B544",
        danger: "#FB6A5B",
        info: "#5CD0DE",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      gridTemplateColumns: {
        "24": "repeat(24, minmax(0, 1fr))",
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.45), 0 18px 44px -22px rgba(0,0,0,0.85)",
        // Card surface: depth + a hairline top highlight in one declaration so a
        // single utility carries both (stacked shadow-* classes don't combine).
        card: "0 1px 2px rgba(0,0,0,0.45), 0 18px 44px -22px rgba(0,0,0,0.85), inset 0 1px 0 0 rgba(255,255,255,0.045)",
        glow: "0 0 0 1px rgba(200,240,90,0.30), 0 14px 48px -14px rgba(200,240,90,0.28)",
        "signal-sm": "0 0 0 1px rgba(200,240,90,0.25)",
        hairline: "inset 0 1px 0 0 rgba(255,255,255,0.045)",
      },
      backgroundImage: {
        "signal-line":
          "linear-gradient(90deg, transparent, rgba(200,240,90,0.7), transparent)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.82)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.7)", opacity: "0.7" },
          "80%, 100%": { transform: "scale(2.4)", opacity: "0" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(900%)" },
        },
        "sweep-x": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateX(12px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        "toast-out": {
          "0%": { opacity: "1", transform: "translateX(0)" },
          "100%": { opacity: "0", transform: "translateX(12px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 260ms cubic-bezier(0.16,1,0.3,1) both",
        "scale-in": "scale-in 200ms cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.16,1,0.3,1) infinite",
        scan: "scan 7s linear infinite",
        "sweep-x": "sweep-x 5.5s ease-in-out infinite",
        "toast-in": "toast-in 240ms cubic-bezier(0.16,1,0.3,1) both",
        "toast-out": "toast-out 180ms ease-in both",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
