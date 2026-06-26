import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * ActivityTrack — "Canvas" design system.
 *
 * Warm beige-grey neutrals (the Claude/Anthropic palette), white as the primary
 * surface, a single calm blue as the highlight, and a clear traffic-light status
 * set. Serif display headings for character; crisp tabular data around them.
 *
 * Both light and dark modes share these token names; their actual values live as
 * CSS custom properties in globals.css (`:root` light, `.dark` dark), so every
 * utility — including `/20`-style alpha — recolours automatically when the
 * `.dark` class is toggled on <html>. Dark is the hero; light is derived.
 *
 * ── shadcn bridge ──────────────────────────────────────────────────────────
 * Generated shadcn (new-york) components reference `bg-background`, `bg-card`,
 * `bg-primary`, `text-muted-foreground`, etc. Those are aliased below onto our
 * existing `--c-*` tokens so a freshly-added component compiles unchanged.
 * IMPORTANT COLLISION: shadcn's `accent` means a *hover surface*, but OUR
 * `accent` means the brand BLUE highlight — and ~200+ call sites depend on that.
 * We keep `accent` = brand blue. When adding a shadcn component that uses
 * `bg-accent`/`text-accent-foreground` for hover/focus, hand-edit it to use
 * `bg-hover`/`text-fg` instead. Do NOT remap `accent`.
 */

// Each colour token resolves to a CSS variable holding space-separated RGB
// channels, wrapped so Tailwind's `<alpha-value>` (e.g. `bg-ok/20`) keeps working.
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

// Easing curves shared by every motion utility (ease-out entrances,
// ease-in-out for repositioning).
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT = "cubic-bezier(0.645, 0.045, 0.355, 1)";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        // Numerals stay in the body family — tabular figures do the aligning.
        mono: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Big editorial display sizes for hero headings / KPI figures.
        "display-sm": ["1.75rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-md": ["2.25rem", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-lg": ["3rem", { lineHeight: "1", letterSpacing: "-0.025em" }],
        "display-xl": ["3.75rem", { lineHeight: "0.98", letterSpacing: "-0.03em" }],
      },
      colors: {
        // ── Our tokens (surfaces, brand, status) ──────────────────────────
        bg: c("bg"),
        "bg-2": c("bg-2"),
        panel: c("panel"),
        "panel-2": c("panel-2"),
        hover: c("panel-2"), // shadcn hover/focus surface (see header note)
        border: c("border"),
        "border-soft": c("border-soft"),
        muted: c("muted"), // a TEXT colour in our system (`text-muted`)
        fg: c("fg"),
        accent: c("accent"), // the brand BLUE highlight — do not remap
        "accent-2": c("accent-2"),
        "accent-fg": c("accent-fg"),
        signal: c("accent"),
        glass: c("glass"),
        ok: c("ok"),
        warn: c("warn"),
        idle: c("warn"),
        danger: c("danger"),
        info: c("info"),
        // ── shadcn aliases → our tokens (so generated components compile) ──
        background: c("bg"),
        foreground: c("fg"),
        card: c("panel"),
        "card-foreground": c("fg"),
        popover: c("panel"),
        "popover-foreground": c("fg"),
        primary: c("accent"),
        "primary-foreground": c("accent-fg"),
        secondary: c("panel-2"),
        "secondary-foreground": c("fg"),
        "muted-foreground": c("muted"),
        "accent-foreground": c("fg"),
        destructive: c("danger"),
        "destructive-foreground": c("accent-fg"),
        input: c("border"),
        ring: c("accent"),
      },
      borderRadius: {
        // Crisper geometry than the old "chunky" scale — cards land on xl/2xl.
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      gridTemplateColumns: {
        "24": "repeat(24, minmax(0, 1fr))",
      },
      letterSpacing: {
        tightest: "-0.025em",
        tighter: "-0.015em",
      },
      boxShadow: {
        // Soft, low elevation — hairline borders carry most of the weight, so
        // shadows stay restrained (especially welcome on the warm dark surface).
        soft: "0 1px 2px rgba(28,22,14,0.04), 0 1px 3px rgba(28,22,14,0.05)",
        // Card resting + hover elevation, with a baked-in inset top hairline so
        // dark cards read as raised (Tailwind can't stack two shadow utilities).
        card: "inset 0 1px 0 0 rgba(255,255,255,0.04), 0 1px 2px rgba(20,16,10,0.05), 0 6px 16px -12px rgba(20,16,10,0.16)",
        "card-hover":
          "inset 0 1px 0 0 rgba(255,255,255,0.05), 0 2px 4px rgba(20,16,10,0.07), 0 16px 36px -16px rgba(20,16,10,0.28)",
        // Big, soft elevation for dialogs / popovers.
        overlay:
          "inset 0 1px 0 0 rgba(255,255,255,0.05), 0 24px 60px -16px rgba(8,6,3,0.5)",
        // A gentle blue lift used on hover / primary buttons.
        glow: "0 8px 24px -10px rgba(60,120,240,0.4)",
        "glow-strong": "0 10px 30px -10px rgba(60,120,240,0.55)",
        "signal-sm": "0 0 0 1px rgba(60,120,240,0.22)",
        // Inner hairline highlight so dark cards read as raised, not painted on.
        hairline: "inset 0 1px 0 0 rgba(255,255,255,0.05)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, rgb(var(--c-accent)), rgb(var(--c-accent-2)))",
        "signal-line":
          "linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.55), transparent)",
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
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "fade-up": `fade-up 260ms ${EASE_OUT} both`,
        "fade-in": `fade-in 200ms linear both`,
        "scale-in": `scale-in 200ms ${EASE_OUT} both`,
        rise: `rise 240ms ${EASE_OUT} both`,
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "pulse-ring": `pulse-ring 2.4s ${EASE_OUT} infinite`,
        "accordion-down": `accordion-down 200ms ${EASE_OUT}`,
        "accordion-up": `accordion-up 200ms ${EASE_OUT}`,
      },
      transitionTimingFunction: {
        "out-quint": EASE_OUT,
        "in-out-cubic": EASE_IN_OUT,
      },
    },
  },
  plugins: [animate],
} satisfies Config;
