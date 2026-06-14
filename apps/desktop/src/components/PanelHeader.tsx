import { t, type Lang } from "../i18n.js";
import { LangSwitcher } from "./LangSwitcher.js";

interface Props {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
}

export function PanelHeader({ lang, onLangChange }: Props) {
  return (
    <header>
      <h1>{t("app.title")}</h1>
      <LangSwitcher lang={lang} onChange={onLangChange} />
    </header>
  );
}
