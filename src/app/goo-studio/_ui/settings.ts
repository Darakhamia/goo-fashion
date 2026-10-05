import { useSyncExternalStore } from "react";

/*
 * Admin preferences (theme, menu order, folded menu groups, open help panels)
 * live in localStorage and are read through useSyncExternalStore: the server
 * render and hydration use the defaults, the saved values apply right after,
 * and there is no hydration mismatch. The one exception is the dark theme,
 * which THEME_BOOT_SCRIPT in layout.tsx puts on the admin root before the
 * first paint. When storage is blocked (private mode, quota) a written value
 * is kept in memory, so it still applies until reload.
 */
const settingListeners = new Set<() => void>();
const memorySettings = new Map<string, string | null>();

export function readSetting(key: string): string | null {
  if (memorySettings.has(key)) return memorySettings.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSetting(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    memorySettings.delete(key);
  } catch {
    memorySettings.set(key, value);
  }
  settingListeners.forEach((notify) => notify());
}

function subscribeSettings(onChange: () => void) {
  settingListeners.add(onChange);
  // Another admin tab changed a preference.
  window.addEventListener("storage", onChange);
  return () => {
    settingListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSetting(key: string): string | null {
  return useSyncExternalStore(
    subscribeSettings,
    () => readSetting(key),
    () => null
  );
}
