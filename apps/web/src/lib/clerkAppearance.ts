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
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorText: "#1b2027",
    colorTextSecondary: "#5b6573",
    colorInputText: "#1b2027",
    colorPrimary: "#2e6cf6",
  },
  dark: {
    colorBackground: "#161c24",
    colorInputBackground: "#1e252f",
    colorText: "#e6eaf0",
    colorTextSecondary: "#8e9aa9",
    colorInputText: "#e6eaf0",
    colorPrimary: "#588eff",
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
