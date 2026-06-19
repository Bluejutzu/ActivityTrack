"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Lightweight i18n for the dashboard. German is the default (German
 * workspace); English is selectable from the header. The choice persists in
 * localStorage. Keys are flat strings; missing keys fall back to English then
 * the key itself, so a partial translation never renders blank.
 */
export type { Lang } from "./locales/types";
import type { Lang, Dict } from "./locales/types";
import { de } from "./locales/de";
import { en } from "./locales/en";

const DICTS: Record<Lang, Dict> = { de, en };
const STORAGE_KEY = "activitytrack.lang";

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate `key`, interpolating `{name}`-style placeholders from `vars`. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === "de" || saved === "en") setLangState(saved);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const raw = DICTS[lang][key] ?? DICTS.en[key] ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
        name in vars ? String(vars[name]) : `{${name}}`,
      );
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
