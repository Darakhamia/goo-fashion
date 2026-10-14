"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { defineDict } from "@/lib/i18n/locale";
import { useDict } from "@/lib/context/locale-context";

const DICT = defineDict({
  en: {
    about: "About",
    heroTitle1: "Style, simplified",
    heroTitle2: "by intelligence.",
    heroLead: "GOO is an AI-powered fashion platform built to simplify the way people create outfits and discover clothing.",
    ideaLabel: "The idea",
    ideaLead: "Finding what to wear shouldn't take hours of browsing through different websites, comparing items, and trying to imagine how everything fits together.",
    ideaBody: "We built GOO to solve this. One platform, one AI, everything you need to go from idea to outfit.",
    whatLabel: "What we do",
    whatLead: "GOO combines artificial intelligence, outfit generation, and fashion discovery into one platform. Instead of jumping between multiple websites, you do everything in one place.",
    cards: [
      {
        number: "01",
        title: "Generate outfits instantly",
        body: "Describe a vibe or select pieces — AI composes a full look and renders it.",
      },
      {
        number: "02",
        title: "Build manually",
        body: "Use the outfit builder to drag and drop pieces from 50+ brands into a single look.",
      },
      {
        number: "03",
        title: "AI styling assistant",
        body: "Chat with your stylist. Get real-time recommendations based on your taste and wardrobe.",
      },
      {
        number: "04",
        title: "Visualize before you buy",
        body: "See the full outfit rendered before committing — on a mannequin or as an editorial flat-lay.",
      },
    ],
    whyLabel: "Why GOO",
    whyLead: "Most fashion tools are limited.",
    whyBody1: "They help you store clothes, browse items, or get basic suggestions. GOO goes further.",
    whyBody2: "Our AI doesn't just recommend — it helps you think, explore, and create. It combines inspiration, logic, and creativity to build outfits that actually make sense.",
    whyGoal1: "The goal is not just to suggest clothes,",
    whyGoal2: "but to help you develop your own style.",
    whoLabel: "Who it's for",
    whoLead: "Anyone who wants to look better without overcomplicating the process.",
    whoBody: "Men and women. Fashion-forward or fashion-curious. Whether you already care deeply about style or just want quick outfit ideas — the platform adapts to your needs, your taste, and your wardrobe.",
    missionLabel: "Our mission",
    missionTitle: "Style should be simple.",
    missionBody: "Our mission is to make it easier for everyone to create outfits, experiment with fashion, and feel confident in what they wear. With AI, this becomes possible.",
    teamLabel: "Built by founders",
    teamLead: "A small team. A big idea.",
    teamBody1: "GOO is built by a small founding team focused on creating a modern, AI-first fashion experience. We are constantly improving the platform, adding new features, and exploring how technology can change the way people interact with fashion.",
    teamBody2: "We move fast, care about design, and ship things that matter.",
    contact: "Get in touch →",
    ctaTitle: "Ready to start?",
    ctaBody: "Build your first outfit in minutes.",
    ctaStart: "Start exploring",
    ctaPlans: "See plans",
  },
  uk: {
    about: "Про нас",
    heroTitle1: "Стиль без зусиль —",
    heroTitle2: "завдяки інтелекту.",
    heroLead: "GOO — модна платформа на основі AI, яка допомагає легко складати образи й знаходити одяг.",
    ideaLabel: "Ідея",
    ideaLead: "Вибір одягу не має забирати години: гортати різні сайти, порівнювати речі й намагатися уявити, як усе поєднається разом.",
    ideaBody: "Ми створили GOO саме для цього. Одна платформа, один AI і все потрібне, щоб від ідеї дійти до готового образу.",
    whatLabel: "Що ми робимо",
    whatLead: "GOO поєднує штучний інтелект, генерацію образів і пошук модних речей на одній платформі. Не треба перемикатися між різними сайтами — усе відбувається в одному місці.",
    cards: [
      {
        number: "01",
        title: "Образи за мить",
        body: "Опишіть настрій або виберіть речі — AI збере повний образ і покаже його.",
      },
      {
        number: "02",
        title: "Збирайте самі",
        body: "У конструкторі образів перетягуйте речі від 50+ брендів і поєднуйте їх в один образ.",
      },
      {
        number: "03",
        title: "AI-стиліст",
        body: "Спілкуйтеся зі своїм стилістом. Отримуйте поради в реальному часі з урахуванням вашого смаку й гардероба.",
      },
      {
        number: "04",
        title: "Побачте, перш ніж купити",
        body: "Перегляньте готовий образ ще до покупки — на манекені або як редакційний flat-lay.",
      },
    ],
    whyLabel: "Чому GOO",
    whyLead: "Більшість модних сервісів обмежені.",
    whyBody1: "Вони допомагають зберігати одяг, переглядати речі чи отримувати базові поради. GOO йде далі.",
    whyBody2: "Наш AI не просто радить — він допомагає думати, шукати й створювати. Він поєднує натхнення, логіку та креативність, щоб збирати образи, які справді мають сенс.",
    whyGoal1: "Мета — не просто підказати одяг,",
    whyGoal2: "а допомогти вам розвинути власний стиль.",
    whoLabel: "Для кого",
    whoLead: "Для всіх, хто хоче виглядати краще без зайвих складнощів.",
    whoBody: "Чоловіки й жінки. Ті, хто живе модою, і ті, хто лише придивляється. Неважливо, чи ви вже захоплюєтеся стилем, чи просто шукаєте швидкі ідеї для образу, — платформа підлаштовується під ваші потреби, смак і гардероб.",
    missionLabel: "Наша місія",
    missionTitle: "Стиль має бути простим.",
    missionBody: "Наша місія — допомогти кожному легше створювати образи, експериментувати з модою й почуватися впевнено у своєму одязі. З AI це стає можливим.",
    teamLabel: "Створено засновниками",
    teamLead: "Невелика команда. Велика ідея.",
    teamBody1: "GOO створює невелика команда засновників, яка робить сучасний модний сервіс з AI в основі. Ми постійно вдосконалюємо платформу, додаємо нові функції й досліджуємо, як технології можуть змінити взаємодію людей із модою.",
    teamBody2: "Ми рухаємося швидко, дбаємо про дизайн і запускаємо те, що справді важливо.",
    contact: "Написати нам →",
    ctaTitle: "Готові почати?",
    ctaBody: "Зберіть перший образ за лічені хвилини.",
    ctaStart: "Почати",
    ctaPlans: "Тарифи",
  },
});

export default function AboutPage() {
  const t = useDict(DICT);
  return (
    <div className="min-h-screen">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="max-w-[1440px] mx-auto px-5 md:px-12 pt-6 md:pt-32 pb-12 md:pb-32">
        <motion.div
          className="max-w-3xl"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6 max-md:hidden">
            {t.about}
          </p>
          <h1 className="text-5xl md:text-7xl font-black uppercase text-[var(--foreground)] leading-[1.05] mb-8 max-md:text-[28px] max-md:font-semibold max-md:normal-case max-md:leading-[1.15] max-md:mb-3">
            {t.heroTitle1}<br />{t.heroTitle2}
          </h1>
          <p className="text-lg md:text-xl text-[var(--foreground-muted)] leading-relaxed max-w-xl max-md:text-[17px] max-md:leading-[1.5]">
            {t.heroLead}
          </p>
        </motion.div>
      </section>

      {/* ── Origin ─────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-5 md:px-12 py-10 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3 md:gap-20 items-start">
            <div className="md:pt-1">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] max-md:font-sans max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)]">
                {t.ideaLabel}
              </p>
            </div>
            <motion.div
              className="space-y-5"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <p className="text-2xl md:text-3xl font-light text-[var(--foreground)] leading-relaxed max-md:text-[22px] max-md:leading-[1.35]">
                {t.ideaLead}
              </p>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
                {t.ideaBody}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── What We Do ─────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-[1440px] mx-auto px-5 md:px-12 py-10 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3 md:gap-20 items-start">
            <div className="md:pt-1">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] max-md:font-sans max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)]">
                {t.whatLabel}
              </p>
            </div>
            <div>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed mb-10 max-md:mb-6">
                {t.whatLead}
              </p>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                variants={{ show: { transition: { staggerChildren: 0.09 } } }}
              >
                {t.cards.map((item) => (
                  <motion.div
                    key={item.number}
                    variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-7 hover:border-[var(--foreground-muted)] hover:shadow-sm transition-colors duration-200 max-md:rounded-2xl max-md:border-0 max-md:p-5"
                  >
                    <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] mb-4 max-md:font-sans max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)] max-md:mb-2">
                      {item.number}
                    </p>
                    <p className="text-sm font-medium text-[var(--foreground)] mb-2 max-md:text-base max-md:mb-1">{item.title}</p>
                    <p className="text-xs text-[var(--foreground-muted)] leading-relaxed max-md:text-[15px] max-md:leading-[1.5]">{item.body}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why GOO ────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-5 md:px-12 py-10 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3 md:gap-20 items-start">
            <div className="md:pt-1">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] max-md:font-sans max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)]">
                {t.whyLabel}
              </p>
            </div>
            <div className="space-y-6">
              <p className="text-2xl md:text-3xl font-light text-[var(--foreground)] leading-relaxed max-md:text-[22px] max-md:leading-[1.35]">
                {t.whyLead}
              </p>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
                {t.whyBody1}
              </p>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
                {t.whyBody2}
              </p>
              <div className="pt-4 border-t border-[var(--border)]">
                <p className="text-base text-[var(--foreground)] font-medium leading-relaxed">
                  {t.whyGoal1}<br />{t.whyGoal2}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Who it's for ───────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-[1440px] mx-auto px-5 md:px-12 py-10 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3 md:gap-20 items-start">
            <div className="md:pt-1">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] max-md:font-sans max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)]">
                {t.whoLabel}
              </p>
            </div>
            <div className="space-y-5">
              <p className="text-2xl md:text-3xl font-light text-[var(--foreground)] leading-relaxed max-md:text-[22px] max-md:leading-[1.35]">
                {t.whoLead}
              </p>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
                {t.whoBody}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Mission ────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-5 md:px-12 py-10 md:py-28">
          <motion.div
            className="max-w-2xl mx-auto text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-8 max-md:font-sans max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)] max-md:mb-3">
              {t.missionLabel}
            </p>
            <p className="text-4xl md:text-5xl font-black uppercase text-[var(--foreground)] leading-[1.1] mb-8 max-md:text-[24px] max-md:font-semibold max-md:normal-case max-md:leading-[1.2] max-md:mb-3">
              {t.missionTitle}
            </p>
            <p className="text-base text-[var(--foreground-muted)] leading-relaxed max-w-lg mx-auto">
              {t.missionBody}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Team ───────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-[1440px] mx-auto px-5 md:px-12 py-10 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3 md:gap-20 items-start">
            <div className="md:pt-1">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] max-md:font-sans max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)]">
                {t.teamLabel}
              </p>
            </div>
            <div className="space-y-5">
              <p className="text-2xl md:text-3xl font-light text-[var(--foreground)] leading-relaxed max-md:text-[22px] max-md:leading-[1.35]">
                {t.teamLead}
              </p>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
                {t.teamBody1}
              </p>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
                {t.teamBody2}
              </p>
              <div className="pt-2 md:pt-6">
                <a
                  href="mailto:anything@goo-fashion.com"
                  className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] border border-[var(--border)] px-8 py-4 rounded-xl hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors duration-200 inline-block max-md:inline-flex max-md:h-11 max-md:items-center max-md:px-5 max-md:py-0 max-md:rounded-full max-md:border-0 max-md:bg-[var(--fg-overlay-08)] max-md:text-[15px] max-md:normal-case max-md:tracking-normal"
                >
                  {t.contact}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-5 md:px-12 py-10 md:py-28">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 md:gap-8">
            <div>
              <p className="text-3xl md:text-4xl font-bold uppercase text-[var(--foreground)] mb-2 max-md:text-[24px] max-md:font-semibold max-md:normal-case max-md:leading-[1.2] max-md:mb-1">
                {t.ctaTitle}
              </p>
              <p className="text-sm text-[var(--foreground-muted)] max-md:text-[15px]">
                {t.ctaBody}
              </p>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <Link
                href="/browse"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 rounded-xl hover:opacity-80 transition-opacity duration-200 max-md:inline-flex max-md:h-11 max-md:items-center max-md:px-5 max-md:py-0 max-md:rounded-full max-md:text-[15px] max-md:font-semibold max-md:normal-case max-md:tracking-normal"
              >
                {t.ctaStart}
              </Link>
              <Link
                href="/plans"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] border border-[var(--border)] px-8 py-4 rounded-xl hover:border-[var(--foreground)] transition-colors duration-200 max-md:inline-flex max-md:h-11 max-md:items-center max-md:px-5 max-md:py-0 max-md:rounded-full max-md:border-0 max-md:bg-[var(--fg-overlay-08)] max-md:text-[15px] max-md:normal-case max-md:tracking-normal"
              >
                {t.ctaPlans}
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
