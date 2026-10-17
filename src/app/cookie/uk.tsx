import Link from "next/link";
import CookieSettings from "@/components/consent/CookieSettings";
import type { LegalSection } from "@/lib/i18n/legal";
import { OPERATOR } from "@/lib/legal-entity";

/**
 * Ukrainian version of the Cookie Policy (/cookie). The English text, the
 * metadata and the page layout live in page.tsx; this file holds the strings
 * of that layout and the Ukrainian sections. Both versions must keep the same
 * sections, numbers, links, cookie names and storage keys.
 */

/** Every fixed string the page shows outside the numbered sections. */
export interface CookieStrings {
  kicker: string;
  title: string;
  /** Keep the date in step with LEGAL_UPDATED in app/sitemap.ts. */
  lastUpdated: string;
  /** The intro paragraph, split around its Privacy Policy link. */
  introBeforeLink: string;
  introLink: string;
  introAfterLink: string;
  operatorLabel: string;
  operator: string;
  websiteLabel: string;
  website: string;
  contactLabel: string;
  contactEmail: string;
  navPrivacy: string;
  navTerms: string;
  navRefund: string;
  navHome: string;
}

export const STRINGS_UK: CookieStrings = {
  kicker: "Юридична інформація",
  title: "Політика щодо файлів cookie",
  // The date sitemap.xml gives this page: keep LEGAL_UPDATED in app/sitemap.ts in step.
  lastUpdated: "Оновлено: 17 жовтня 2026 р.",
  introBeforeLink:
    "Ця Політика щодо файлів cookie перелічує всі файли cookie та ключі сховища браузера, які фактично використовує Goo Fashion, пояснює, для чого потрібен кожен із них і як ви можете ними керувати. Вона доповнює нашу",
  introLink: "Політику конфіденційності",
  introAfterLink: ".",
  operatorLabel: "Оператор",
  operator: OPERATOR.uk.name,
  websiteLabel: "Вебсайт",
  website: "goo-fashion.com",
  contactLabel: "Контакти",
  contactEmail: "anything@goo-fashion.com",
  navPrivacy: "Політика конфіденційності",
  navTerms: "Умови використання",
  navRefund: "Політика підписки та повернення коштів",
  navHome: "Повернутися на GOO",
};

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">{children}</p>;
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2 max-md:text-[15px] max-md:font-semibold max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground)] max-md:mb-1.5">
      {children}
    </p>
  );
}

function StorageKey({ name, purpose }: { name: string; purpose: string }) {
  return (
    <li className="flex items-start gap-3 text-sm leading-relaxed max-md:text-base max-md:leading-[1.6]">
      <span className="mt-2 w-1 h-1 rounded-full bg-[var(--foreground-subtle)] shrink-0 max-md:mt-[11px]" />
      <span className="text-[var(--foreground-muted)]">
        <span className="font-mono text-xs text-[var(--foreground)] max-md:text-[13px]">{name}</span>
        {" — "}
        {purpose}
      </span>
    </li>
  );
}

export const SECTIONS_UK: LegalSection[] = [
  {
    number: "1",
    title: "Файли cookie та подібні технології",
    content: (
      <div className="space-y-3">
        <P>
          Файли cookie — це невеликі текстові файли, які вебсайт розміщує на вашому пристрої. Браузери також
          надають локальне сховище та сховище сеансу — сховища пар «ключ — значення», які залишаються на вашому
          пристрої і, на відміну від файлів cookie, не надсилаються на сервери з кожним запитом.
        </P>
        <P>
          Goo Fashion свідомо зводить використання файлів cookie до мінімуму. Більшість того, що ми
          запам’ятовуємо про ваш візит, зберігається в локальному сховищі на вашому власному пристрої, а
          аналітика, яку ми ведемо самі, працює взагалі без файлів cookie.
        </P>
      </div>
    ),
  },
  {
    number: "2",
    title: "Файли cookie, які ми встановлюємо",
    content: (
      <div className="space-y-6">
        <div>
          <SubLabel>Необхідні — вхід в обліковий запис (Clerk)</SubLabel>
          <P>
            Наш постачальник автентифікації Clerk встановлює файли cookie (файли з назвами, що починаються з{" "}
            <span className="font-mono text-xs text-[var(--foreground)] max-md:text-[13px]">__session</span>,{" "}
            <span className="font-mono text-xs text-[var(--foreground)] max-md:text-[13px]">__client_uat</span>, та інші файли з префіксом{" "}
            <span className="font-mono text-xs text-[var(--foreground)] max-md:text-[13px]">__clerk</span>), щоб
            зберігати ваш вхід в обліковий запис і захищати його від підроблених запитів. Ці файли cookie суворо
            необхідні, і їх не можна вимкнути, поки ви користуєтеся обліковим записом.
          </P>
        </div>
        <div>
          <SubLabel>Необхідні — захист (Cloudflare)</SubLabel>
          <P>
            Наш мережевий постачальник Cloudflare захищає сайт від ботів і перевантаження. Якщо він попросить
            ваш браузер пройти перевірку безпеки — рідко, наприклад під час атаки, — він встановить файл cookie{" "}
            <span className="font-mono text-xs text-[var(--foreground)] max-md:text-[13px]">cf_clearance</span>, щоб
            не питати вдруге. Він з’являється лише після такої перевірки і є суворо необхідним.
          </P>
        </div>
        <div>
          <SubLabel>Аналітичні — PostHog (лише з вашої згоди)</SubLabel>
          <P>
            Коли продуктову аналітику ввімкнено, банер запитує вашу згоду ще до того, як щось завантажиться.
            Лише після того, як ви натиснете «Прийняти», PostHog зберігає анонімний ідентифікатор відвідувача у
            файлі cookie та в локальному сховищі (з назвами, що починаються з{" "}
            <span className="font-mono text-xs text-[var(--foreground)] max-md:text-[13px]">ph_</span>), щоб розуміти, як
            використовуються функції. Дані обробляються на серверах PostHog у ЄС, і ми не пов’язуємо з
            ними ваше ім’я чи адресу електронної пошти. Якщо ви відмовитеся — або просто проігноруєте банер, —
            PostHog не завантажується взагалі й нічого не встановлює. Ви можете будь-коли змінити свій вибір у
            розділі 6 нижче.
          </P>
        </div>
      </div>
    ),
  },
  {
    number: "3",
    title: "Аналітика без файлів cookie",
    content: (
      <div className="space-y-3">
        <P>
          Наш власний облік відвідуваності працює без файлів cookie. Він використовує випадковий ідентифікатор
          сеансу, що зберігається в локальному сховищі протягом ковзного 30-хвилинного сеансу, і фіксує
          переглянуті сторінки, джерело переходу, приблизний тип пристрою та країну. Він не зберігає вашу
          IP-адресу чи повну сигнатуру браузера.
        </P>
      </div>
    ),
  },
  {
    number: "4",
    title: "Локальне сховище, яке ми використовуємо",
    content: (
      <div className="space-y-6">
        <div>
          <SubLabel>Налаштування</SubLabel>
          <ul className="list-none space-y-2">
            <StorageKey name="goo-theme" purpose="світла чи темна тема" />
            <StorageKey name="goo-cookie-consent" purpose="ваш вибір щодо аналітичних файлів cookie в банері згоди" />
            <StorageKey name="goo-currency" purpose="валюта, у якій вам показуються ціни" />
            <StorageKey name="goo-lang" purpose="мова сайту (англійська чи українська)" />
            <StorageKey name="goo-exchange-rates" purpose="кешовані курси валют (1 година)" />
            <StorageKey name="ai-tooltip-dismissed" purpose="запам’ятовує закриту підказку" />
          </ul>
        </div>
        <div>
          <SubLabel>Покупки та образи — залишаються на вашому пристрої</SubLabel>
          <ul className="list-none space-y-2">
            <StorageKey name="goo-cart" purpose="ваш кошик (ніколи не надсилається на наші сервери)" />
            <StorageKey name="goo-recently-viewed" purpose="нещодавно переглянуті товари" />
            <StorageKey name="goo-recently-viewed-outfits" purpose="нещодавно переглянуті образи" />
            <StorageKey name="goo-liked-outfits / goo-liked-products" purpose="вподобання, коли ви переглядаєте сайт як гість" />
            <StorageKey name="goo-saved-outfits / goo-synced-looks" purpose="образи з конструктора, збережені локально, і позначки синхронізації" />
          </ul>
        </div>
        <div>
          <SubLabel>Сеанс аналітики</SubLabel>
          <ul className="list-none space-y-2">
            <StorageKey name="goo_sid / goo_sid_ts" purpose="псевдонімний ідентифікатор сеансу, ковзні 30 хвилин" />
            <StorageKey name="goo_country / goo_country_ts" purpose="код вашої країни, кешується на 24 години" />
          </ul>
        </div>
        <div>
          <SubLabel>Сховище сеансу</SubLabel>
          <ul className="list-none space-y-2">
            <StorageKey name="stylist_chat_v1" purpose="зберігає вашу розмову з AI-стилістом, поки ви переходите між сторінками; очищується, коли ви закриваєте вкладку" />
          </ul>
        </div>
      </div>
    ),
  },
  {
    number: "5",
    title: "Сторонні файли cookie після переходу з нашого сайту",
    content: (
      <div className="space-y-3">
        <P>
          Посилання на магазини на Goo Fashion («Де купити») ведуть через партнерські мережі, як-от Awin.
          Після того як ви перейдете за посиланням, мережа та магазин встановлюють власні файли cookie на своїх
          доменах, щоб зарахувати перехід. На ці файли cookie поширюються їхні політики, а не наша, — ми їх
          ніколи не бачимо.
        </P>
        <P>
          Сторінки оплати розміщує monobank, який під час оплати використовує власні файли cookie на своєму
          домені.
        </P>
      </div>
    ),
  },
  {
    number: "6",
    title: "Керування файлами cookie та сховищем",
    content: (
      <div className="space-y-4">
        <P>
          Свій вибір щодо аналітичних файлів cookie ви можете переглянути й змінити просто тут — він
          застосовується одразу:
        </P>
        <CookieSettings />
        <P>
          Ви також можете будь-коли видалити чи заблокувати файли cookie та очистити локальне сховище в
          налаштуваннях браузера. Блокування необхідних файлів cookie призведе до виходу з облікового запису й
          може порушити роботу його функцій; очищення локального сховища скидає ваш кошик, вподобання та
          налаштування на цьому пристрої.
        </P>
        <P>
          Про ширші права щодо ваших персональних даних читайте в розділі «Ваші права» нашої{" "}
          <Link href="/privacy" className="text-[var(--foreground)] link-underline">Політики конфіденційності</Link>.
        </P>
      </div>
    ),
  },
  {
    number: "7",
    title: "Зміни до цієї Політики",
    content: (
      <P>
        Ми можемо час від часу оновлювати цю Політику щодо файлів cookie — наприклад, якщо додаємо або
        прибираємо якийсь інструмент. Актуальна версія завжди опублікована на цій сторінці разом із датою
        останнього оновлення.
      </P>
    ),
  },
  {
    number: "8",
    title: "Контактна інформація",
    content: (
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--foreground)] max-md:text-base">
          {OPERATOR.uk.name}
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          {OPERATOR.uk.city}
        </p>
        <p className="text-sm text-[var(--foreground-subtle)] leading-relaxed max-md:text-[15px] max-md:text-[var(--foreground-muted)]">
          {OPERATOR.uk.addressNote}
        </p>
        <p className="text-sm text-[var(--foreground-subtle)] leading-relaxed max-md:text-[15px] max-md:text-[var(--foreground-muted)]">
          {OPERATOR.uk.taxId}
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed pt-1 max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline max-md:py-3">
            anything@goo-fashion.com
          </a>
        </p>
      </div>
    ),
  },
];
