import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Core dark palette (used directly by app + shadcn-style primitives).
        bg: "#0b0d12",
        panel: "#141821",
        "panel-2": "#1a1f2b",
        border: "#232a36",
        muted: "#8b93a7",
        fg: "#e6e9ef",
        accent: "#4c8dff",
        ok: "#2ecc71",
        warn: "#e67e22",
        danger: "#e74c3c",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      gridTemplateColumns: {
        "24": "repeat(24, minmax(0, 1fr))",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.3), 0 8px 24px -12px rgba(0,0,0,0.5)",
        glow: "0 0 0 1px rgba(76,141,255,0.25), 0 8px 30px -10px rgba(76,141,255,0.35)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
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
          "50%": { opacity: "0.4", transform: "scale(0.85)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "toast-out": {
          "0%": { opacity: "1", transform: "translateX(0)" },
          "100%": { opacity: "0", transform: "translateX(12px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 220ms ease-out both",
        "scale-in": "scale-in 180ms ease-out both",
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "toast-in": "toast-in 220ms ease-out both",
        "toast-out": "toast-out 180ms ease-in both",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
