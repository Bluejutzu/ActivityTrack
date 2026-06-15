import { t, type Lang } from "../i18n.js";
import { LangSwitcher } from "./LangSwitcher.js";

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
          <span className="brand-sub">Signal Deck</span>
        </span>
      </div>
      <LangSwitcher lang={lang} onChange={onLangChange} />
    </header>
  );
}
