"use client";

import { useEffect, useState } from "react";
import { getStoredConsent, setStoredConsent, type CookieConsent } from "@/lib/consent";
import { defineDict } from "@/lib/i18n/locale";
import { useDict } from "@/lib/context/locale-context";

const DICT = defineDict({
  en: {
    title: "Analytics cookies",
    allowed: "Currently allowed. Analytics stops the moment you decline.",
    declined: "Currently declined. No analytics cookie is set.",
    none: "No choice saved yet — analytics stays off until you allow it.",
    accepted_label: "Allow",
    declined_label: "Decline",
  },
  uk: {
    title: "Аналітичні файли cookie",
    allowed: "Зараз дозволено. Аналітика вимикається, щойно ви відмовитеся.",
    declined: "Зараз відхилено. Аналітичний файл cookie не встановлюється.",
    none: "Вибір ще не збережено — аналітика вимкнена, доки ви її не дозволите.",
    accepted_label: "Дозволити",
    declined_label: "Відхилити",
  },
});

const OPTIONS: CookieConsent[] = ["accepted", "declined"];

/** Lets a visitor review and change their analytics-cookie choice on the Cookie Policy page. */
export default function CookieSettings() {
  const t = useDict(DICT);
  const [choice, setChoice] = useState<CookieConsent | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(getStoredConsent());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const select = (value: CookieConsent) => {
    setStoredConsent(value);
    setChoice(value);
  };

  return (
    // Phones: a plaque without the frame, a plain heading and 44px pills.
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 max-md:rounded-2xl max-md:border-0 max-md:p-4">
      <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-2 max-md:text-[15px] max-md:font-semibold max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground)] max-md:mb-1">
        {t.title}
      </p>
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-4 max-md:text-[15px] max-md:leading-[1.5] max-md:mb-3.5">
        {choice === "accepted" ? t.allowed : choice === "declined" ? t.declined : t.none}
      </p>
      <div className="flex gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option}
            onClick={() => select(option)}
            aria-pressed={choice === option}
            className={`px-4 py-2 rounded-full border text-[11px] tracking-[0.12em] uppercase font-medium transition-colors duration-200 max-md:h-11 max-md:px-5 max-md:py-0 max-md:text-[15px] max-md:normal-case max-md:tracking-normal ${
              choice === option
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] max-md:border-transparent max-md:bg-[var(--fg-overlay-08)] max-md:text-[var(--foreground)]"
            }`}
          >
            {t[`${option}_label`]}
          </button>
        ))}
      </div>
    </div>
  );
}
