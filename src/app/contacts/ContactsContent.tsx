"use client";

import Link from "next/link";
import { defineDict } from "@/lib/i18n/locale";
import { useDict } from "@/lib/context/locale-context";
import { OPERATOR, OPERATOR_EMAIL, OPERATOR_IBAN, OPERATOR_TAX_ID } from "@/lib/legal-entity";

const DICT = defineDict({
  en: {
    kicker: "Company",
    title: "Contacts",
    lead: "Questions about GOO, your subscription or a payment? Write to us.",
    email: "Email",
    details: "Operator details",
    operator: "Operator",
    taxId: "Tax ID (RNOKPP)",
    city: "City",
    bank: "Bank",
    website: "Website",
    terms: "Terms & Conditions",
    refund: "Refund Policy",
    privacy: "Privacy Policy",
    home: "Back to GOO",
    op: OPERATOR.en,
  },
  uk: {
    kicker: "Компанія",
    title: "Контакти",
    lead: "Питання про GOO, підписку чи оплату? Напишіть нам.",
    email: "Електронна пошта",
    details: "Реквізити",
    operator: "Виконавець",
    taxId: "РНОКПП",
    city: "Місто",
    bank: "Банк",
    website: "Вебсайт",
    terms: "Умови використання",
    refund: "Повернення коштів",
    privacy: "Політика конфіденційності",
    home: "Повернутися на GOO",
    op: OPERATOR.uk,
  },
});

/** One label–value row, the Operator / Website / Contact block of the legal pages. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-6 py-4 border-t border-[var(--border)] max-md:block max-md:py-3">
      <dt className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] pt-0.5 max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)] max-md:pt-0 max-md:mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-[var(--foreground)] leading-relaxed break-words max-md:text-base max-md:leading-[1.5]">
        {children}
      </dd>
    </div>
  );
}

const LINK = "text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors link-underline max-md:text-[15px] max-md:normal-case max-md:tracking-normal max-md:py-3";

export default function ContactsContent() {
  const t = useDict(DICT);
  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-5 md:px-12">
        <div className="pt-6 md:pt-24 pb-14 md:pb-32 max-w-2xl">

          {/* Header */}
          <div className="mb-8 md:mb-16 animate-fade-up">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3 max-md:hidden">
              {t.kicker}
            </p>
            <h1 className="text-5xl md:text-6xl font-black uppercase text-[var(--foreground)] mb-4 max-md:text-[28px] max-md:leading-[1.15] max-md:font-semibold max-md:normal-case max-md:mb-1.5">
              {t.title}
            </h1>
            <p className="text-base text-[var(--foreground-muted)] leading-relaxed max-md:leading-[1.6] max-md:text-[var(--foreground)]">
              {t.lead}
            </p>
          </div>

          {/* Email */}
          <div className="mb-10 md:mb-16">
            <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2 max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)] max-md:mb-1">
              {t.email}
            </p>
            <a
              href={`mailto:${OPERATOR_EMAIL}`}
              className="text-2xl md:text-3xl font-semibold text-[var(--foreground)] link-underline break-all max-md:text-[20px]"
            >
              {OPERATOR_EMAIL}
            </a>
          </div>

          {/* Operator details */}
          <h2 className="text-base font-medium text-[var(--foreground)] mb-2 max-md:text-[18px] max-md:font-semibold max-md:leading-snug">
            {t.details}
          </h2>
          <dl className="border-b border-[var(--border)]">
            <Row label={t.operator}>{t.op.name}</Row>
            <Row label={t.taxId}>{OPERATOR_TAX_ID}</Row>
            <Row label={t.city}>
              {t.op.city}
              <span className="block text-[var(--foreground-muted)]">{t.op.addressNote}</span>
            </Row>
            <Row label="IBAN">{OPERATOR_IBAN}</Row>
            <Row label={t.bank}>{t.op.bank}</Row>
            <Row label={t.website}>goo-fashion.com</Row>
          </dl>

          {/* Footer nav */}
          <div className="mt-20 pt-10 border-t border-[var(--border)] flex flex-wrap gap-6 max-md:mt-12 max-md:pt-4 max-md:gap-x-5 max-md:gap-y-0">
            <Link href="/terms" className={LINK}>{t.terms}</Link>
            <Link href="/refund" className={LINK}>{t.refund}</Link>
            <Link href="/privacy" className={LINK}>{t.privacy}</Link>
            <Link href="/" className={LINK}>{t.home}</Link>
          </div>

        </div>
      </div>
    </div>
  );
}
