import Link from "next/link";
import type { LegalSection } from "@/lib/i18n/legal";
import { OPERATOR, OPERATOR_IBAN } from "@/lib/legal-entity";

/**
 * Ukrainian version of the Terms & Conditions (/terms). page.tsx keeps the
 * English text and renders whichever the visitor's language picks. The two
 * must say the same thing: a change to one is a change to both.
 */

/** Every fixed string the page shows outside its numbered sections. */
export interface TermsStrings {
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
  navPrivacy: string;
  navCookie: string;
  navRefund: string;
  navHome: string;
}

export const STRINGS_UK: TermsStrings = {
  kicker: "Юридична інформація",
  title: "Умови використання",
  // Same date as the English page: keep LEGAL_UPDATED in app/sitemap.ts in step.
  lastUpdated: "Оновлено: 14 жовтня 2026 р.",
  intro:
    "Ці Умови використання регулюють ваш доступ до Goo Fashion і користування ним, зокрема нашим вебсайтом, цифровими інструментами, функціями стилізації на основі ШІ, конструктором образів, збереженими образами, функціями пошуку товарів, партнерськими посиланнями та пов’язаними сервісами. Користуючись Goo Fashion, ви погоджуєтеся з цими Умовами. Якщо ви не погоджуєтеся, будь ласка, не користуйтеся вебсайтом або сервісами.",
  operatorLabel: "Оператор",
  operatorValue: OPERATOR.uk.name,
  websiteLabel: "Вебсайт",
  websiteValue: "goo-fashion.com",
  contactLabel: "Контакти",
  contactValue: "anything@goo-fashion.com",
  navPrivacy: "Політика конфіденційності",
  navCookie: "Політика щодо файлів cookie",
  navRefund: "Політика підписки та повернення коштів",
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

export const SECTIONS_UK: LegalSection[] = [
  {
    number: "1",
    title: "Про Goo Fashion",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Goo Fashion — це fashion-tech платформа, яка допомагає користувачам знаходити модні речі, складати образи, генерувати ідеї для стилю та отримувати доступ до посилань на сторонніх продавців модних товарів.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Goo Fashion не продає безпосередньо модні товари, що відображаються на сайті, якщо прямо не зазначено інше. Товари, представлені на вебсайті, надаються сторонніми продавцями, брендами, маркетплейсами або партнерами за партнерськими програмами.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Коли ви переходите за посиланням на товар і залишаєте Goo Fashion, будь-яка покупка здійснюється безпосередньо у стороннього продавця, а не в Goo Fashion.
        </p>
      </div>
    ),
  },
  {
    number: "2",
    title: "Право на користування сервісом",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Щоб користуватися Goo Fashion, вам має виповнитися щонайменше 16 років.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Якщо ви не досягли віку повноліття, встановленого у вашій країні, ви можете користуватися сервісом лише з дозволу одного з батьків або законного опікуна.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Сервіс не призначений для дітей віком до 13 років.
        </p>
      </div>
    ),
  },
  {
    number: "3",
    title: "Реєстрація облікового запису",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Для деяких функцій може знадобитися обліковий запис. Створюючи обліковий запис, ви погоджуєтеся надавати точну та актуальну інформацію. Ви несете відповідальність за безпечне зберігання своїх даних для входу та за всі дії, що здійснюються у вашому обліковому записі.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Якщо ви вважаєте, що до вашого облікового запису отримали доступ без вашого дозволу, негайно зверніться до нас за адресою{" "}
          <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline">
            anything@goo-fashion.com
          </a>
          .
        </p>
      </div>
    ),
  },
  {
    number: "4",
    title: "Товари та продавці третіх осіб",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Goo Fashion може відображати зображення товарів, їхні назви, ціни, описи, назви брендів, наявність, а також посилання на сторонні вебсайти. Ми не гарантуємо, що:
        </p>
        <Bullet
          items={[
            "ціни на товари завжди правильні",
            "товари залишаються в наявності",
            "описи товарів повні або точні",
            "зображення повністю відповідають кінцевому товару",
            "сторонні продавці належним чином виконають ваше замовлення",
            "доставка, повернення товарів, повернення коштів або підтримка з боку сторонніх продавців відповідатимуть вашим очікуванням",
          ]}
        />
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Усі покупки, здійснені через сторонні вебсайти, регулюються власними умовами та політиками відповідної третьої особи. Goo Fashion не несе відповідальності за сторонні вебсайти, товари, послуги, платежі, доставку, повернення товарів, повернення коштів або спори.
        </p>
      </div>
    ),
  },
  {
    number: "5",
    title: "Партнерські посилання та комерційні відносини",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Деякі посилання на Goo Fashion можуть бути партнерськими. Це означає, що Goo Fashion може отримати комісійну або іншу винагороду, якщо ви перейдете за посиланням або здійсните покупку через нього.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Партнерські відносини можуть впливати на те, як товари, бренди чи продавці відображаються, ранжуються або рекомендуються.
        </p>
      </div>
    ),
  },
  {
    number: "6",
    title: "Інтелектуальна власність",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Увесь оригінальний контент, дизайн, брендинг, макет, інтерфейс, програмне забезпечення, тексти, графіка, логотипи та матеріали, створені Goo Fashion, належать Goo Fashion або ліцензіарам Goo Fashion.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Ви не можете копіювати, відтворювати, поширювати, змінювати, піддавати зворотній розробці, автоматизовано вивантажувати (скрейпити) чи експлуатувати будь-яку частину платформи без попереднього письмового дозволу.
        </p>
      </div>
    ),
  },
  {
    number: "7",
    title: "Зображення, бренди та контент третіх осіб",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Goo Fashion може відображати зображення товарів, логотипи, торговельні марки, назви, описи та пов’язані матеріали третіх осіб. Усі такі матеріали залишаються власністю відповідних правовласників.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Їх відображення на Goo Fashion не означає схвалення, партнерства, права власності чи афіліації, якщо це прямо не зазначено.
        </p>
      </div>
    ),
  },
  {
    number: "8",
    title: "Контент користувачів",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Користувачі можуть завантажувати, зберігати, надсилати або публікувати контент, зокрема комбінації образів, речі з гардероба, зображення, промпти та коментарі. Ви зберігаєте право власності на свій Контент користувача.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Завантажуючи Контент користувача, ви надаєте Goo Fashion обмежену ліцензію, що діє в усьому світі, на використання, обробку, зберігання, відображення та зміну такого контенту виключно з метою забезпечення роботи та вдосконалення сервісу.
        </p>
      </div>
    ),
  },
  {
    number: "9",
    title: "Правила щодо контенту користувачів",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Ви не можете завантажувати контент, який:
        </p>
        <Bullet
          items={[
            "порушує права третіх осіб",
            "містить матеріали незаконного, шкідливого, відвертого, ненависницького чи оманливого характеру",
            "містить шкідливе програмне забезпечення або шкідливий код",
            "неправдиво вказує на зв’язок із брендом або продавцем",
          ]}
        />
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Goo Fashion може видаляти контент на власний розсуд.
        </p>
      </div>
    ),
  },
  {
    number: "10",
    title: "Функції ШІ та згенерований контент",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Goo Fashion може надавати генерацію образів на основі ШІ, рекомендації щодо стилю та візуальні результати. Контент, згенерований ШІ, надається виключно з інформаційною метою та для натхнення.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Ми не гарантуємо:
        </p>
        <Bullet
          items={[
            "точність результатів роботи ШІ",
            "наявність запропонованих товарів",
            "придатність рекомендацій",
            "оригінальність згенерованого контенту",
          ]}
        />
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Користувачі покладаються на результати, згенеровані ШІ, на власний ризик.
        </p>
      </div>
    ),
  },
  {
    number: "11",
    title: "Завантаження зображень та обробка за допомогою ШІ",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
        Завантажуючи зображення, ви підтверджуєте, що маєте на це права та дозволи. Завантажені зображення можуть оброблятися Goo Fashion або сторонніми постачальниками ШІ-рішень і технологій виключно для забезпечення роботи функцій сервісу.
      </p>
    ),
  },
  {
    number: "12",
    title: "Заборонене використання",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Ви погоджуєтеся, що не будете:
        </p>
        <Bullet
          items={[
            "використовувати Goo Fashion у незаконний спосіб",
            "автоматизовано збирати (скрейпити) дані чи контент",
            "використовувати ботів або засоби автоматизації без дозволу",
            "втручатися в роботу систем безпеки платформи",
            "завантажувати шкідливий контент або контент, що порушує права інших осіб",
            "зловживати партнерськими системами",
            "створювати конкурентні сервіси з використанням даних, контенту чи інтерфейсу Goo Fashion",
          ]}
        />
      </div>
    ),
  },
  {
    number: "13",
    title: "Скарги щодо авторського права та інтелектуальної власності",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Якщо ви вважаєте, що контент на Goo Fashion порушує ваші права, напишіть на{" "}
          <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline">
            anything@goo-fashion.com
          </a>{" "}
          і зазначте:
        </p>
        <Bullet
          items={[
            "ваші контактні дані",
            "ідентифікацію матеріалу, що порушує права",
            "підтвердження права власності або інших прав",
            "пояснення щодо несанкціонованого використання",
          ]}
        />
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          На час розгляду ми можемо видалити спірний контент.
        </p>
      </div>
    ),
  },
  {
    number: "14",
    title: "Підписки та платні функції",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Goo Fashion пропонує платні тарифні плани з щомісячною оплатою. Ціни вказано на сторінці «Тарифи»
          та під час оформлення оплати; валюта розрахунків — українська гривня (UAH). Платежі обробляє monobank
          (Plata by mono) на власній захищеній платіжній сторінці — Goo Fashion ніколи не отримує повного номера
          вашої картки.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Підписка автоматично продовжується щомісяця, доки її не скасовано. Ви можете будь-коли скасувати
          автоматичне продовження у своєму Профілі; доступ до платних функцій зберігається до кінця оплаченого
          періоду. Повні відомості про оплату, скасування та продовження наведено в нашій{" "}
          <Link href="/refund" className="text-[var(--foreground)] link-underline">
            Політиці підписки та повернення коштів
          </Link>
          .
        </p>
      </div>
    ),
  },
  {
    number: "15",
    title: "Повернення коштів",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
        Платні функції є цифровими послугами, надання яких розпочинається одразу після оплати, тому плата за
        розпочатий розрахунковий період, як правило, не повертається — за винятком помилкових або повторних
        списань, суттєвої недоступності сервісу, спричиненої нами, або випадків, коли повернення коштів вимагає
        застосовне законодавство про захист прав споживачів. Повні правила, зокрема порядок подання запиту на
        повернення коштів, наведено в нашій{" "}
        <Link href="/refund" className="text-[var(--foreground)] link-underline">
          Політиці підписки та повернення коштів
        </Link>
        .
      </p>
    ),
  },
  {
    number: "16",
    title: "Конфіденційність",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
        Користування Goo Fashion регулюється нашою{" "}
        <Link href="/privacy" className="text-[var(--foreground)] link-underline">
          Політикою конфіденційності
        </Link>
        .
      </p>
    ),
  },
  {
    number: "17",
    title: "Файли cookie та відстеження",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
        Goo Fashion використовує необхідні файли cookie, аналітику та технології відстеження партнерських переходів, як описано в нашій{" "}
        <Link href="/cookie" className="text-[var(--foreground)] link-underline">
          Політиці щодо файлів cookie
        </Link>
        .
      </p>
    ),
  },
  {
    number: "18",
    title: "Доступність сервісу",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
        Ми не гарантуємо безперебійної, безпечної чи безпомилкової роботи сервісу. Ми можемо будь-коли змінити, призупинити або припинити роботу сервісу.
      </p>
    ),
  },
  {
    number: "19",
    title: "Відмова від гарантій",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
        Goo Fashion надається «як є» та «у міру доступності». Ми відмовляємося від усіх гарантій у максимальному обсязі, дозволеному законом. Ви користуєтеся платформою на власний ризик.
      </p>
    ),
  },
  {
    number: "20",
    title: "Обмеження відповідальності",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          У максимальному обсязі, дозволеному законом, Goo Fashion не несе відповідальності за непрямі, випадкові, похідні або штрафні збитки.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Наша сукупна відповідальність не може перевищувати більшої з таких сум: суми, сплаченої вами Goo Fashion за попередні 12 місяців, або <span className="text-[var(--foreground)] font-medium">100 USD</span>.
        </p>
      </div>
    ),
  },
  {
    number: "21",
    title: "Відшкодування",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Ви погоджуєтеся відшкодувати Goo Fashion шкоду за претензіями, що виникли внаслідок:
        </p>
        <Bullet
          items={[
            "неналежного використання вами платформи",
            "завантаженого вами контенту",
            "вчинених вами порушень закону",
            "порушення прав третіх осіб",
          ]}
        />
      </div>
    ),
  },
  {
    number: "22",
    title: "Припинення доступу",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
        Ми можемо призупинити або припинити ваш доступ, якщо ви порушуєте ці Умови або створюєте правові чи операційні ризики.
      </p>
    ),
  },
  {
    number: "23",
    title: "Зміни до Умов",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
        Ми можемо будь-коли оновлювати ці Умови. Подальше користування Goo Fashion після оновлень означає їх прийняття.
      </p>
    ),
  },
  {
    number: "24",
    title: "Застосовне право",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
        Ці Умови регулюються законодавством <span className="text-[var(--foreground)]">України</span>. Обов’язкові права споживачів, передбачені застосовним законодавством, залишаються в силі.
      </p>
    ),
  },
  {
    number: "25",
    title: "Контактна інформація",
    content: (
      <div className="space-y-1">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed font-medium text-[var(--foreground)] max-md:text-base max-md:leading-[1.6]">
          {OPERATOR.uk.name}
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          {OPERATOR.uk.address}
        </p>
        <p className="text-sm text-[var(--foreground-subtle)] leading-relaxed max-md:text-[15px] max-md:text-[var(--foreground-muted)]">
          {OPERATOR.uk.taxId}
        </p>
        <p className="text-sm text-[var(--foreground-subtle)] leading-relaxed max-md:text-[15px] max-md:text-[var(--foreground-muted)]">
          IBAN {OPERATOR_IBAN}, {OPERATOR.uk.bank}
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
