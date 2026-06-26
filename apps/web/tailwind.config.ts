import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * "Aurora" — a focused, modern operations dashboard.
 *
 * Layered surfaces with real depth (a dark rail, a lighter content plane, cards
 * that lift above it), chunky rounded corners, and a blurple-leaning brand blue
 * that carries every action, link and focus ring. Chrome stays quiet; the data —
 * numbers, status, charts — is what pops. Status reads as a plain traffic light:
 * green is working, amber is idle, grey is offline.
 *
 * Both light and dark modes share these token names; their actual values live as
 * CSS custom properties in globals.css (`:root` for light, `.dark` for dark), so
 * every utility — including `/20`-style alpha — recolours automatically when the
 * `.dark` class is toggled on <html>.
 */

// Each colour token resolves to a CSS variable holding space-separated RGB
// channels, wrapped so Tailwind's `<alpha-value>` (e.g. `bg-ok/20`) keeps working.
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

// Easing curves shared by every motion utility (per the animation guidance:
// ease-out for entrances, ease-in-out for repositioning).
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT = "cubic-bezier(0.645, 0.045, 0.355, 1)";

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
        // ── Surfaces (bg = page/rail, bg-2 = top bar, panel = card) ────────
        bg: c("bg"),
        "bg-2": c("bg-2"),
        panel: c("panel"),
        "panel-2": c("panel-2"),
        border: c("border"),
        "border-soft": c("border-soft"),
        muted: c("muted"),
        fg: c("fg"),
        // ── Brand (every action, link, focus ring) + indigo companion ──────
        accent: c("accent"),
        "accent-2": c("accent-2"),
        signal: c("accent"),
        // ── Status (traffic light) ───────────────────────────────────────
        ok: c("ok"),
        warn: c("warn"),
        idle: c("warn"),
        danger: c("danger"),
        info: c("info"),
      },
      borderRadius: {
        // Chunkier scale for the "Discord" feel — soft, friendly corners.
        sm: "0.5rem",
        md: "0.625rem",
        lg: "0.875rem",
        xl: "1.125rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      gridTemplateColumns: {
        "24": "repeat(24, minmax(0, 1fr))",
      },
      letterSpacing: {
        tightest: "-0.02em",
        tighter: "-0.015em",
      },
      boxShadow: {
        // Soft, low elevation — surfaces lift off the page without shouting.
        soft: "0 1px 2px rgba(16,24,40,0.05), 0 1px 3px rgba(16,24,40,0.07)",
        // Card resting + hover elevation. The leading inset hairline gives a top
        // highlight so dark cards read as raised, not painted on (Tailwind can't
        // stack two shadow utilities, so it's baked in here).
        card: "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 1px 2px rgba(8,12,20,0.06), 0 8px 20px -12px rgba(8,12,20,0.18)",
        "card-hover":
          "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 4px rgba(8,12,20,0.08), 0 18px 40px -16px rgba(8,12,20,0.32)",
        // Big, soft elevation for dialogs / popovers.
        overlay:
          "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 24px 60px -16px rgba(4,8,16,0.55)",
        // A gentle blue lift used on hover / primary buttons.
        glow: "0 8px 24px -8px rgba(56,99,244,0.45)",
        "glow-strong": "0 10px 30px -8px rgba(56,99,244,0.6)",
        "signal-sm": "0 0 0 1px rgba(56,99,244,0.25)",
        // Inner hairline highlight so dark cards read as raised, not painted on.
        hairline: "inset 0 1px 0 0 rgba(255,255,255,0.06)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, rgb(var(--c-accent)), rgb(var(--c-accent-2)))",
        "signal-line":
          "linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.6), transparent)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // Dialog/sheet entrance: a small rise + scale, GPU-only properties.
        rise: {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
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
      },
      animation: {
        // Entrances: 200–300ms, ease-out (per the animation guidance).
        "fade-up": `fade-up 260ms ${EASE_OUT} both`,
        "fade-in": `fade-in 200ms linear both`,
        "scale-in": `scale-in 200ms ${EASE_OUT} both`,
        rise: `rise 240ms ${EASE_OUT} both`,
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "pulse-ring": `pulse-ring 2.4s ${EASE_OUT} infinite`,
      },
      transitionTimingFunction: {
        "out-quint": EASE_OUT,
        "in-out-cubic": EASE_IN_OUT,
      },
    },
  },
  plugins: [animate],
} satisfies Config;
