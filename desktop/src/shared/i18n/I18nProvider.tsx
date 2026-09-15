import * as React from "react";
import type { Locale, TranslationDict } from "./types";
import { ru } from "./locales/ru";
import { en } from "./locales/en";

const STORAGE_KEY = "buzz-locale";

const dictionaries: Record<Locale, TranslationDict> = {
  ru,
  en,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: <S extends keyof TranslationDict, K extends keyof TranslationDict[S]>(
    section: S,
    key: K,
  ) => TranslationDict[S][K];
  dict: TranslationDict;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

function getSavedLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ru" || saved === "en") return saved;
  } catch {
    // ignore
  }
  return "ru";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(getSavedLocale);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const dict = React.useMemo(() => dictionaries[locale] ?? ru, [locale]);

  const t = React.useCallback(
    <S extends keyof TranslationDict, K extends keyof TranslationDict[S]>(
      section: S,
      key: K,
    ): TranslationDict[S][K] => {
      const sectionObj = dict[section] ?? ru[section];
      if (sectionObj && key in sectionObj) {
        return sectionObj[key];
      }
      return (ru[section]?.[key] ?? key) as TranslationDict[S][K];
    },
    [dict],
  );

  const value = React.useMemo(
    () => ({
      locale,
      setLocale,
      t,
      dict,
    }),
    [locale, setLocale, t, dict],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) {
    // Graceful fallback for components or tests outside I18nProvider
    return {
      locale: "ru",
      setLocale: () => {},
      t: (section, key) => (ru[section]?.[key] ?? key) as any,
      dict: ru,
    };
  }
  return ctx;
}
