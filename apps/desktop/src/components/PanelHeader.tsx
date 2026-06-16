import { t, type Lang } from "../i18n.js";
import { LangSwitcher } from "./LangSwitcher.js";
import { ThemeToggle } from "./ThemeToggle.js";

interface Props {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
}

export function PanelHeader({ lang, onLangChange }: Props) {
  return (
    <header>
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        <span className="brand-text">
          <span className="brand-name">{t("app.title")}</span>
          <span className="brand-sub">Tracker</span>
        </span>
      </div>
      <div className="header-controls">
        <LangSwitcher lang={lang} onChange={onLangChange} />
        <ThemeToggle />
      </div>
    </header>
  );
}
