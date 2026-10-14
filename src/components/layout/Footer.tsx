"use client";

import Link from "next/link";
import { categoryPath } from "@/lib/landing-paths";
import { defineDict } from "@/lib/i18n/locale";
import { useDict } from "@/lib/context/locale-context";
import LanguageSwitch from "@/components/i18n/LanguageSwitch";

type FooterLink = { label: string; href: string };

// Landing pages linked from every page, so a crawler reaches the catalogue's
// category and brand pages from anywhere (docs/SEO_PLAN.md, SEO-19). Ids of the
// category tree's groups; keep to groups that have products — Dresses has
// none yet.
function shopLinks(t: FooterStrings): FooterLink[] {
  return [
    { label: t.outerwear, href: categoryPath("outerwear") },
    { label: t.tops, href: categoryPath("tops") },
    { label: t.bottoms, href: categoryPath("bottoms") },
    { label: t.footwear, href: categoryPath("footwear") },
    { label: t.accessories, href: categoryPath("accessories") },
    { label: t.allBrands, href: "/brands" },
  ];
}

// Phones get shorter labels so each group fits on a line or two (DESIGN_SYSTEM.md §12.13).
function mobileLinks(t: FooterStrings): { group: string; links: FooterLink[] }[] {
  return [
    { group: t.shop, links: shopLinks(t) },
    { group: t.platform, links: [
      { label: t.browse, href: "/browse" }, { label: t.builder, href: "/builder" }, { label: t.saved, href: "/saved" },
      { label: t.plans, href: "/plans" }, { label: t.profile, href: "/profile" },
    ] },
    { group: t.company, links: [{ label: t.journal, href: "/blog" }, { label: t.about, href: "/about" }] },
    { group: t.legal, links: [
      { label: t.privacyShort, href: "/privacy" }, { label: t.termsShort, href: "/terms" }, { label: t.cookiesShort, href: "/cookie" },
      { label: t.refundsShort, href: "/refund" }, { label: t.sitemap, href: "/sitemap-page" },
    ] },
  ];
}

function footerLinks(t: FooterStrings): { group: string; links: FooterLink[] }[] {
  return [
    { group: t.shop, links: shopLinks(t) },
    { group: t.platform, links: [
      { label: t.browse,  href: "/browse" },
      { label: t.builder, href: "/builder" },
      { label: t.saved,   href: "/saved" },
      { label: t.plans,   href: "/plans" },
      { label: t.profile, href: "/profile" },
    ] },
    { group: t.company, links: [
      { label: t.blog,  href: "/blog" },
      { label: t.about, href: "/about" },
    ] },
    { group: t.legal, links: [
      { label: t.privacy, href: "/privacy" },
      { label: t.terms,   href: "/terms" },
      { label: t.cookies, href: "/cookie" },
      { label: t.refunds, href: "/refund" },
      { label: t.sitemap, href: "/sitemap-page" },
    ] },
  ];
}

const DICT = defineDict({
  en: {
    tagline: "Your personal AI stylist. Curated outfits, premium fashion, one platform.",
    taglineShort: "Your personal AI stylist. Curated outfits, premium fashion.",
    rights: "All rights reserved.",
    aggregating: "Aggregating fashion from 50+ brands worldwide.",
    taxes: "Prices shown include all applicable taxes.",
    language: "Language",
    shop: "Shop", platform: "Platform", company: "Company", legal: "Legal",
    outerwear: "Outerwear", tops: "Tops", bottoms: "Bottoms", footwear: "Footwear", accessories: "Accessories", allBrands: "All brands",
    browse: "Browse", builder: "Builder", saved: "Saved", plans: "Plans", profile: "Profile",
    blog: "Blog", journal: "Journal", about: "About",
    privacy: "Privacy Policy", terms: "Terms of Service", cookies: "Cookie Policy", refunds: "Refund Policy", sitemap: "Sitemap",
    privacyShort: "Privacy", termsShort: "Terms", cookiesShort: "Cookies", refundsShort: "Refunds",
  },
  uk: {
    tagline: "Ваш персональний AI-стиліст. Добірки образів і преміальна мода на одній платформі.",
    taglineShort: "Ваш персональний AI-стиліст. Добірки образів і преміальна мода.",
    rights: "Усі права захищено.",
    aggregating: "Мода від 50+ брендів світу в одному місці.",
    taxes: "Ціни вказано з урахуванням усіх податків.",
    language: "Мова",
    shop: "Одяг", platform: "Платформа", company: "Компанія", legal: "Правова інформація",
    outerwear: "Верхній одяг", tops: "Верх", bottoms: "Низ", footwear: "Взуття", accessories: "Аксесуари", allBrands: "Усі бренди",
    browse: "Каталог", builder: "Конструктор", saved: "Збережене", plans: "Тарифи", profile: "Профіль",
    blog: "Журнал", journal: "Журнал", about: "Про нас",
    privacy: "Політика конфіденційності", terms: "Умови використання", cookies: "Політика cookie", refunds: "Повернення коштів", sitemap: "Карта сайту",
    privacyShort: "Конфіденційність", termsShort: "Умови", cookiesShort: "Cookie", refundsShort: "Повернення",
  },
});
type FooterStrings = typeof DICT.en;

export default function Footer() {
  const t = useDict(DICT);
  return (
    <footer className="mt-8 md:mt-32 md:border-t md:border-[var(--border)] md:bg-[var(--surface)]">
      <div className="max-w-[1440px] mx-auto px-3 md:px-12 md:py-24">

        {/* Mobile layout: one plaque on the page, no full-width band (DESIGN_SYSTEM.md §12.13) */}
        <div className="md:hidden rounded-2xl bg-[var(--surface)] px-[18px] pt-5 pb-4">
          <Link
            href="/"
            style={{ fontFamily: "var(--font-poppins), sans-serif", fontWeight: 800 }}
            className="relative text-[17px] tracking-[0.16em] text-[var(--foreground)] hover:opacity-70 transition-opacity duration-200 after:absolute after:inset-x-0 after:-inset-y-[10px]"
          >
            GOO
          </Link>
          <p className="mt-1.5 text-[13px] leading-snug text-[var(--foreground-muted)]">
            {t.taglineShort}
          </p>

          {mobileLinks(t).map(({ group, links }) => (
            <nav key={group} aria-label={group} className="mt-4">
              <p className="text-[12px] text-[var(--foreground-muted)]">{group}</p>
              <ul className="flex flex-wrap gap-x-[18px]">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="relative min-h-11 flex items-center text-[14px] text-[var(--foreground)] after:absolute after:-inset-x-[9px] after:inset-y-0">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[12px] text-[var(--foreground-muted)]">{t.language}</p>
            <LanguageSwitch touch />
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-[12px] text-[var(--foreground-muted)]">
            <p>© {new Date().getFullYear()} GOO. {t.rights}</p>
            <span className="opacity-60">v{new Date().toISOString().slice(0, 10)}</span>
          </div>
        </div>

        {/* Desktop layout */}
        <div className="hidden md:block">
          <div className="grid grid-cols-6 gap-8">
            {/* Brand */}
            <div className="col-span-2">
              <Link
                href="/"
                className="text-3xl font-black tracking-[0.2em] text-[var(--foreground)] hover:opacity-70 transition-opacity duration-200"
              >
                GOO
              </Link>
              <p className="mt-4 text-sm text-[var(--foreground-muted)] leading-relaxed max-w-xs">
                {t.tagline}
              </p>
              <p className="mt-8 text-xs text-[var(--foreground-subtle)] tracking-[0.06em]">
                © {new Date().getFullYear()} GOO. {t.rights}
              </p>
            </div>

            {/* Links */}
            {footerLinks(t).map(({ group, links }) => (
              <div key={group}>
                <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
                  {group}
                </p>
                <ul className="flex flex-col gap-3">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="mt-16 pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <p className="text-xs text-[var(--foreground-subtle)] tracking-[0.06em]">
              {t.aggregating}
            </p>
            <div className="flex items-center gap-6">
              <span className="text-xs text-[var(--foreground-subtle)]">
                {t.taxes}
              </span>
              <LanguageSwitch />
              <span className="text-xs text-[var(--foreground-subtle)] opacity-40">
                v{new Date().toISOString().slice(0, 10)}
              </span>

            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
