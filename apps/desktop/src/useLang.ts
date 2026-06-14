import { useCallback, useState } from "react";
import { getLang, setLang, type Lang } from "./i18n.js";

/**
 * Wraps the module-level i18n state so changing the language triggers a
 * re-render of the whole tree. The chosen language still persists via
 * `setLang` (localStorage), exactly as before.
 */
export function useLang(): { lang: Lang; changeLang: (next: Lang) => void } {
  const [lang, setLangState] = useState<Lang>(() => getLang());
  const changeLang = useCallback((next: Lang) => {
    setLang(next);
    setLangState(next);
  }, []);
  return { lang, changeLang };
}
