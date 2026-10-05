import { useCallback, useMemo } from "react";
import { formatDate, formatDateTime, formatMoney, formatMoneyRange, formatNumber, formatWhen } from "@/lib/admin-format";
import { useSetting, writeSetting } from "../_ui/settings";
import { en, type Key, type Message } from "./en";
import { ru } from "./ru";

/*
 * goo-studio speaks English and Russian (CEO decision 2026-10-05, Р5;
 * docs/ADMIN_ROADMAP.md GS4-8). Interface text lives in en.ts (the source)
 * and ru.ts (the translation); components read it through useT():
 *
 *   const t = useT();
 *   t("common.cancel")                         → "Cancel" / "Отмена"
 *   t("users.selected", { count: 3 })          → "3 users selected" / "Выбрано 3 пользователя"
 *
 * A message is a string with {name} placeholders, or plural forms picked by
 * Intl.PluralRules for vars.count — English needs one/other, Russian
 * one/few/many. A key ru.ts has not translated yet falls back to English,
 * so a new screen can ship in English before the Russian pass.
 * scripts/i18n-check.mjs checks both files and the translated screens.
 *
 * The choice is stored per browser (localStorage, goo-admin-lang) and
 * switches the whole admin at once, without a reload.
 */

export type Lang = "en" | "ru";
export type { Key };
export type Vars = Record<string, string | number>;

export const LANGS: { code: Lang; name: string }[] = [
  { code: "en", name: "English" },
  { code: "ru", name: "Русский" },
];

const LANG_KEY = "goo-admin-lang";
const DICTS: Record<Lang, Partial<Record<Key, Message>>> = { en, ru };

/** BCP 47 locale for dates and numbers in the chosen language (GS4-6). */
export const LOCALE: Record<Lang, string> = { en: "en-US", ru: "ru-RU" };

const pluralRules: Partial<Record<Lang, Intl.PluralRules>> = {};

export function translate(lang: Lang, key: Key, vars?: Vars): string {
  const message = DICTS[lang][key] ?? en[key];
  let text: string;
  if (typeof message === "string") {
    text = message;
  } else {
    const rules = (pluralRules[lang] ??= new Intl.PluralRules(LOCALE[lang]));
    const form = rules.select(Number(vars?.count ?? 0)) as keyof typeof message;
    text = message[form] ?? message.other;
  }
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

export function useLang(): Lang {
  return useSetting(LANG_KEY) === "ru" ? "ru" : "en";
}

export function setLang(lang: Lang) {
  writeSetting(LANG_KEY, lang === "en" ? null : lang);
}

export type T = (key: Key, vars?: Vars) => string;

export function useT(): T {
  const lang = useLang();
  return useCallback<T>((key, vars) => translate(lang, key, vars), [lang]);
}

/**
 * Dates, money and counts in the chosen language (GS4-6, src/lib/admin-format.ts):
 *
 *   const f = useFormat();
 *   f.date(post.publishedAt)      → "Oct 5, 2026" / "5 окт. 2026 г."
 *   f.when(user.lastActiveAt)     → "22h ago" / "22 ч назад", the date after a week
 *   f.money(898.1)                → "$898.10"; f.money(399, "UAH") → "₴399" / "399 ₴"
 *   f.moneyRange(898, 898)        → "$898"
 *   f.number(1224)                → "1,224" / "1 224"
 */
export function useFormat() {
  const lang = useLang();
  return useMemo(
    () => ({
      date: (value: Date | string | number | null | undefined) => formatDate(value, lang),
      dateTime: (value: Date | string | number | null | undefined) => formatDateTime(value, lang),
      when: (value: Date | string | number | null | undefined, never?: string) => formatWhen(value, lang, never),
      money: (amount: number | null | undefined, currency?: string) => formatMoney(amount, currency, lang),
      moneyRange: (min: number, max: number, currency?: string) => formatMoneyRange(min, max, currency, lang),
      number: (n: number | null | undefined) => formatNumber(n, lang),
    }),
    [lang],
  );
}

export type Format = ReturnType<typeof useFormat>;
