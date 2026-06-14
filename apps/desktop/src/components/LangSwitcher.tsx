import { t, type Lang } from "../i18n.js";

interface Props {
  lang: Lang;
  onChange: (lang: Lang) => void;
}

export function LangSwitcher({ lang, onChange }: Props) {
  return (
    <label className="lang">
      <span>{t("lang.label")}</span>
      <select
        id="lang"
        value={lang}
        onChange={(e) => onChange(e.target.value as Lang)}
      >
        <option value="de">Deutsch</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
