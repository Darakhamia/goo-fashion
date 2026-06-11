"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
/** What the user picked. "system" follows the OS preference live. */
export type ThemePreference = "light" | "dark" | "system";

interface ThemeContextValue {
  /** Resolved theme actually applied to the document ("light" | "dark"). */
  theme: Theme;
  /** The user's stored choice — may be "system". */
  preference: ThemePreference;
  /** Pick a theme preference; applied immediately and persisted. */
  setPreference: (p: ThemePreference) => void;
  /** Legacy helper: flip the currently-resolved theme to its opposite. */
  toggleTheme: () => void;
}

const STORAGE_KEY = "goo-theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  preference: "dark",
  setPreference: () => {},
  toggleTheme: () => {},
});

function getSystemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to "dark" (GOO's default) until the stored preference is read.
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [systemTheme, setSystemTheme] = useState<Theme>("dark");

  // Restore the saved preference and current system theme on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
      if (stored === "light" || stored === "dark" || stored === "system") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPreferenceState(stored);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSystemTheme(getSystemTheme());
  }, []);

  // Track OS theme changes so "system" updates live.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "dark" : "light");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const theme: Theme = preference === "system" ? systemTheme : preference;

  // Apply the resolved theme to <html>.
  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [theme]);

  // Persist the user's choice (the inline script in layout.tsx reads this on boot).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {}
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => setPreferenceState(p), []);

  const toggleTheme = useCallback(() => {
    setPreferenceState((prev) => {
      const current = prev === "system" ? getSystemTheme() : prev;
      return current === "dark" ? "light" : "dark";
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
