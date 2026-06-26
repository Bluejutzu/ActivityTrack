import type { Theme } from "@/lib/theme";

/**
 * Clerk's widgets are themed via explicit colour variables — they render in
 * their own tree and can't read our `--c-*` CSS variables — so we hand them the
 * resolved hex palette per theme. Kept in step with globals.css; switch with
 * `useTheme()` so Clerk follows the dashboard's light/dark toggle.
 */
export const CLERK_VARS: Record<
  Theme,
  {
    colorBackground: string;
    colorInputBackground: string;
    colorText: string;
    colorTextSecondary: string;
    colorInputText: string;
    colorPrimary: string;
  }
> = {
  light: {
    colorBackground: "#fffffe",
    colorInputBackground: "#fffffe",
    colorText: "#25221e",
    colorTextSecondary: "#6d665b",
    colorInputText: "#25221e",
    colorPrimary: "#2b60e8",
  },
  dark: {
    colorBackground: "#22201d",
    colorInputBackground: "#2d2a26",
    colorText: "#f0eee8",
    colorTextSecondary: "#a59e93",
    colorInputText: "#f0eee8",
    colorPrimary: "#6096f8",
  },
};

/** Full Clerk `appearance` for the current theme (variables + shared elements). */
export function clerkAppearance(theme: Theme) {
  return {
    variables: { ...CLERK_VARS[theme], borderRadius: "0.75rem" },
    elements: {
      card: "bg-panel border border-border shadow-card",
      headerTitle: "text-fg",
      headerSubtitle: "text-muted",
      socialButtonsBlockButton: "border-border",
      footerActionLink: "text-accent hover:text-accent/80",
      formButtonPrimary:
        "bg-accent hover:bg-accent/90 text-white font-semibold normal-case",
    },
  };
}
