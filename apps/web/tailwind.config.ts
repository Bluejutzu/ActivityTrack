import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * "Daylight" — a calm, friendly operations dashboard.
 *
 * Built for the person running a small team, not a security analyst. Light, airy
 * surfaces and generous whitespace replace the old dark command deck. One calm
 * brand blue carries every action and link; status reads as a plain traffic
 * light — green is working, amber is idle, grey is offline — so anyone can scan
 * the room at a glance. Inter sets the whole interface for a clean, modern feel.
 *
 * Both light and dark modes share these token names; their actual values live as
 * CSS custom properties in globals.css (`:root` for light, `.dark` for dark), so
 * every utility — including `/20`-style alpha — recolours automatically when the
 * `.dark` class is toggled on <html>.
 */

// Each colour token resolves to a CSS variable holding space-separated RGB
// channels, wrapped so Tailwind's `<alpha-value>` (e.g. `bg-ok/20`) keeps working.
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
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
        // Numerals stay in the same family — tabular figures do the aligning, so
        // the data layer never has to look like a terminal.
        mono: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // ── Surfaces ─────────────────────────────────────────────────────
        bg: c("bg"),
        "bg-2": c("bg-2"),
        panel: c("panel"),
        "panel-2": c("panel-2"),
        border: c("border"),
        "border-soft": c("border-soft"),
        muted: c("muted"),
        fg: c("fg"),
        // ── Brand (every action, link, focus ring) ───────────────────────
        accent: c("accent"),
        signal: c("accent"),
        // ── Status (traffic light) ───────────────────────────────────────
        ok: c("ok"),
        warn: c("warn"),
        idle: c("warn"),
        danger: c("danger"),
        info: c("info"),
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
        tightest: "-0.02em",
      },
      boxShadow: {
        // Soft, low elevation — surfaces lift off the page without shouting.
        soft: "0 1px 2px rgba(16,24,40,0.05), 0 1px 3px rgba(16,24,40,0.07)",
        card: "0 1px 2px rgba(16,24,40,0.04), 0 6px 16px -8px rgba(16,24,40,0.10)",
        // A gentle blue lift used on hover / primary buttons.
        glow: "0 6px 18px -6px rgba(46,108,246,0.28)",
        "signal-sm": "0 0 0 1px rgba(46,108,246,0.20)",
        hairline: "inset 0 1px 0 0 rgba(255,255,255,0.6)",
      },
      backgroundImage: {
        "signal-line":
          "linear-gradient(90deg, transparent, rgba(46,108,246,0.55), transparent)",
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
          "50%": { opacity: "0.5", transform: "scale(0.85)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.7)", opacity: "0.5" },
          "80%, 100%": { transform: "scale(2.2)", opacity: "0" },
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
        "toast-in": "toast-in 240ms cubic-bezier(0.16,1,0.3,1) both",
        "toast-out": "toast-out 180ms ease-in both",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
