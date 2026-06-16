"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";

/** Light/dark toggle shown in the header and on the login screen. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t(isDark ? "theme.toLight" : "theme.toDark")}
      title={t(isDark ? "theme.toLight" : "theme.toDark")}
      className="grid h-9 w-9 place-items-center rounded-md border border-border bg-bg text-muted transition-colors hover:bg-panel-2 hover:text-fg"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
