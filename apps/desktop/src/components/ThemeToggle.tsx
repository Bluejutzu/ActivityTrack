import { useState } from "react";
import { t } from "../i18n.js";
import { getTheme, setTheme, type Theme } from "../theme.js";

/**
 * Light/dark toggle. Self-contained: applying the theme sets `data-theme` on
 * <html>, so the CSS variables do the recolouring — only this button needs to
 * re-render (to flip its icon/label).
 */
export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const isDark = theme === "dark";

  const toggle = () => {
    const next: Theme = isDark ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

  const label = t(isDark ? "theme.toLight" : "theme.toDark");
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {isDark ? "☀" : "☾"}
    </button>
  );
}
