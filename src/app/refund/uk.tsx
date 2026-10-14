import Link from "next/link";
import type { LegalSection } from "@/lib/i18n/legal";
import { OPERATOR } from "@/lib/legal-entity";

/**
 * Ukrainian version of the Subscription & Refund Policy (/refund). page.tsx
 * keeps the English text and renders whichever the visitor's language picks.
 * The two must say the same thing: a change to one is a change to both.
 */

/** Every fixed string the page shows outside its numbered sections. */
export interface RefundStrings {
  kicker: string;
  title: string;
  lastUpdated: string;
  intro: string;
  operatorLabel: string;
  operatorValue: string;
  websiteLabel: string;
  websiteValue: string;
  contactLabel: string;
  contactValue: string;
  navTerms: string;
  navPrivacy: string;
  navCookie: string;
  navHome: string;
}

export const STRINGS_UK: RefundStrings = {
  kicker: "Юридична інформація",
  title: "Політика підписки та повернення коштів",
  // Same date as the English page: keep LEGAL_UPDATED in app/sitemap.ts in step.
  lastUpdated: "Оновлено: 14 жовтня 2026 р.",
  intro:
    "Ця політика пояснює, як оплачуються та продовжуються підписки Goo Fashion, як їх скасувати і коли ви маєте право на повернення коштів. Купуючи підписку, ви погоджуєтеся з цією політикою.",
  operatorLabel: "Оператор",
  operatorValue: OPERATOR.uk.name,
  websiteLabel: "Вебсайт",
  websiteValue: "goo-fashion.com",
  contactLabel: "Контакти",
  contactValue: "anything@goo-fashion.com",
  navTerms: "Умови використання",
  navPrivacy: "Політика конфіденційності",
  navCookie: "Політика щодо файлів cookie",
  navHome: "Повернутися на GOO",
};

function Bullet({ items }: { items: string[] }) {
  return (
    <ul className="list-none space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          <span className="mt-2 w-1 h-1 rounded-full bg-[var(--foreground-subtle)] shrink-0 max-md:mt-[11px]" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">{children}</p>;
}

export const SECTIONS_UK: LegalSection[] = [
  {
    number: "1",
    title: "На що поширюється ця політика",
    content: (
      <div className="space-y-3">
        <P>
          Ця політика поширюється на платні підписки Goo Fashion — цифрові послуги, як-от стилізація за
          допомогою штучного інтелекту, генерація образів та інші преміум-функції. Вона доповнює наші{" "}
          <Link href="/terms" className="text-[var(--foreground)] link-underline">Умови використання</Link>.
        </P>
        <P>
          Goo Fashion не продає фізичних товарів. Покупки у сторонніх продавців, на сайти яких ви переходите
          за посиланнями з нашого сайту, — це договори з цими продавцями: до них застосовуються власні правила
          продавців щодо оплати, доставки, повернення товарів і коштів, і ця політика на них не поширюється.
        </P>
      </div>
    ),
  },
  {
    number: "2",
    title: "Ціни та оплата",
    content: (
      <div className="space-y-3">
        <P>
          Ціни на підписку зазначено на сторінці{" "}
          <Link href="/plans" className="text-[var(--foreground)] link-underline">Тарифи</Link> та під час
          оформлення оплати. Оплата здійснюється в українській гривні (UAH); суми в будь-якій іншій валюті
          наведено приблизно, лише для зручності. Ціни вказано з урахуванням застосовних податків.
        </P>
        <P>
          Платежі обробляє monobank (Plata by mono). Дані картки ви вводите на захищеній платіжній сторінці
          monobank — повний номер вашої картки ніколи не потрапляє до Goo Fashion. Для продовження підписки
          monobank надає нам багаторазовий токен картки; ми зберігаємо лише цей токен і замаскований номер
          картки.
        </P>
      </div>
    ),
  },
  {
    number: "3",
    title: "Автоматичне продовження",
    content: (
      <div className="space-y-3">
        <P>
          Підписка оплачується щомісяця і продовжується автоматично. Наприкінці кожного розрахункового періоду
          з вашої збереженої картки списується чинна на той момент ціна вашого тарифу, а підписка
          продовжується на один місяць — доки ви її не скасуєте.
        </P>
        <P>
          Підписка стає активною лише після того, як платіжний провайдер підтвердить ваш платіж.
        </P>
      </div>
    ),
  },
  {
    number: "4",
    title: "Як скасувати підписку",
    content: (
      <div className="space-y-3">
        <P>
          Ви можете будь-коли скасувати автоматичне продовження в розділі{" "}
          <Link href="/profile" className="text-[var(--foreground)] link-underline">Профіль</Link> → Тариф →
          Скасувати підписку або надіславши нам електронного листа. Скасування набуває чинності наприкінці
          поточного оплаченого періоду:
        </P>
        <Bullet
          items={[
            "ви зберігаєте повний доступ до платних функцій до кінця оплаченого періоду",
            "після скасування жодних подальших списань не здійснюється",
            "скасування саме по собі не тягне за собою повернення коштів за поточний період (див. розділ 6)",
          ]}
        />
      </div>
    ),
  },
  {
    number: "5",
    title: "Невдалі платежі",
    content: (
      <P>
        Якщо списання за продовження підписки не вдалося, ми повторюємо спробу в наступні дні, а підписка
        отримує статус простроченої. Після трьох невдалих спроб поспіль підписку буде скасовано, а обліковий
        запис повернеться на безкоштовний тариф Free. Ви можете знову оформити підписку будь-коли.
      </P>
    ),
  },
  {
    number: "6",
    title: "Повернення коштів",
    content: (
      <div className="space-y-3">
        <P>
          Платні функції — це цифрові послуги, надання яких починається одразу після оплати. Оформлюючи
          підписку, ви просите розпочати надання послуг негайно; якщо на вас поширюється передбачене законом
          право на відмову від договору щодо цифрових послуг (наприклад, у ЄС/ЄЕЗ), ви визнаєте, що це право
          втрачається, щойно послугу повністю надано протягом строку, відведеного для такої відмови.
        </P>
        <P>
          Тому плата за підписку за розпочатий розрахунковий період, як правило, не повертається, зокрема за
          частково використані місяці. Водночас ми повернемо вам кошти, якщо:
        </P>
        <Bullet
          items={[
            "кошти було списано помилково, зокрема в разі дубльованих списань",
            "кошти було списано після того, як ви скасували підписку відповідно до розділу 4",
            "платний сервіс був недоступний протягом значного часу через збій на нашому боці",
            "повернення коштів вимагає застосовне законодавство про захист прав споживачів, зокрема Закон України «Про захист прав споживачів»",
          ]}
        />
        <P>Ніщо в цій політиці не обмежує ваших прав, гарантованих імперативними нормами законодавства.</P>
      </div>
    ),
  },
  {
    number: "7",
    title: "Як подати запит на повернення коштів",
    content: (
      <div className="space-y-3">
        <P>
          Напишіть на{" "}
          <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline">
            anything@goo-fashion.com
          </a>{" "}
          з адреси, пов’язаної з вашим обліковим записом, протягом 14 днів із дати списання та опишіть
          проблему. Будь ласка, зазначте дату й суму списання.
        </P>
        <P>
          Ми розглядаємо запити протягом 10 робочих днів. Схвалені суми повертаються через monobank на той
          самий платіжний засіб, яким було здійснено оплату; швидкість зарахування коштів залежить від вашого
          банку (зазвичай 3–10 робочих днів).
        </P>
      </div>
    ),
  },
  {
    number: "8",
    title: "Зміна цін",
    content: (
      <P>
        Ми можемо змінювати ціни на підписку. Зміни ніколи не застосовуються заднім числом до вже оплаченого
        періоду: ми повідомимо вас на сайті або електронною поштою до того, як нова ціна почне діяти з
        наступного продовження вашої підписки, і, якщо ви не згодні, ви зможете скасувати підписку до цього
        моменту.
      </P>
    ),
  },
  {
    number: "9",
    title: "Контактна інформація",
    content: (
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--foreground)] max-md:text-base">
          {OPERATOR.uk.name}
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          {OPERATOR.uk.address}
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
