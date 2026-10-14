"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_STORAGE_KEY, type Locale } from "@/lib/i18n/locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

// The saved choice lives in localStorage. Components in this tab are told
// about a change through `listeners`; other tabs through the storage event.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOCALE_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function readLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

// The server — and the first client render, which must match its HTML —
// always uses the default language; React switches to the saved one right
// after hydration.
const serverLocale = (): Locale => DEFAULT_LOCALE;

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, readLocale, serverLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try { localStorage.setItem(LOCALE_STORAGE_KEY, next); } catch { /* ignore */ }
    listeners.forEach((notify) => notify());
  }, []);

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

/** The current language's half of a `defineDict` dictionary. */
export function useDict<T>(dict: { en: T; uk: T }): T {
  return dict[useLocale().locale];
}
