/**
 * Languages of the public site.
 *
 * English is the default (CEO, 2026-10-14). Ukrainian covers the main pages —
 * home, about, plans, checkout and the legal pages — and the site chrome; the
 * rest stays in English until it is translated. The visitor's choice is kept
 * in localStorage under `goo-lang`, next to `goo-theme` and `goo-currency`
 * (listed in the Cookie Policy); an inline script in the root layout reads it
 * before hydration to set <html lang>.
 *
 * Pages stay statically rendered: the server always renders English and the
 * client switches after mount, the same way the display currency works.
 */

export type Locale = "en" | "uk";

export const LOCALES: readonly Locale[] = ["en", "uk"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "goo-lang";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "uk";
}

/**
 * A page's strings in both languages. Ukrainian must carry every key English
 * has, so a string added in one language and forgotten in the other fails the
 * type check instead of rendering blank.
 */
export function defineDict<T extends Record<string, unknown>>(dict: { en: T; uk: NoInfer<T> }): { en: T; uk: T } {
  return dict;
}

/** Ukrainian plural: 1 товар, 2 товари, 5 товарів (also 11–14 → many, 21 → one). */
export function pluralUk(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
