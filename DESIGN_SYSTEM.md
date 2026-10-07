# Дизайн-система Goo Fashion

Этот файл — описание того, что **уже есть** в коде `goo-fashion`, а не пожелание на будущее. Он нужен разработчику (человеку или агенту), который собирается добавить новый элемент интерфейса: прочитал — и сделал так, чтобы новое было неотличимо от существующего.

Все правила выведены из фактического кода со ссылками вида `файл:строка`. Если у чего-то канонического примера в коде нет — здесь так и написано, а не придумано.

> **Сверено с кодом 2026-09-26**, после UX-правок 2026-09-12 и код-ревью сентября 2026 (`docs/CODE_REVIEW_2026-09.md`); 2026-09-27 упоминания мёртвых файлов переведены в прошедшее время — они удалены коммитом `7898c3f`. Разделы 1, 6, 9, 10 и 11 перепроверены целиком. В разделах 2–8 исправлены найденные устаревшие утверждения (кольцо фокуса, токены и классы движения, `dark:`, Poppins, мёртвые источники рецептов) и обновлены ссылки на `ProductCard`, `OutfitCard`, `Navigation`, модалки и скримы, но остальные номера строк и часть счётчиков там сняты ещё 2026-08-20 и местами сдвинулись: `saved/page.tsx` с тех пор разнесён на `saved/page.tsx` и `src/components/look/MyLooksPanel.tsx`, шаг выбора стиля билдера переехал в `src/components/look/StylePicker.tsx`, `builder`, `browse` и `ProductClient` переписывались. Ищи рецепт по фрагменту класса, а не по номеру строки.

Характер дизайна: editorial-минимализм. Тёплый светлый фон (`#F4F2EE`) и почти чёрный тёмный (`#0A0A0A`), **тёмная тема — по умолчанию**, один шрифт (Inter Tight), монохром без акцентного цвета, крупные плотно-трекованные заголовки и мелкие uppercase-подписи, глубина выражается границей в 1px, а не тенью.

---

## 1. Токены — единственный источник цвета

Определены в `src/app/globals.css:43-85`: светлый набор — в блоке `:root, .admin-theme-light`, тёмный — в блоке `.dark, .admin-theme-dark`. Вторые селекторы нужны админке, у которой своя тема (раздел 9). Светлый блок обязан стоять раньше тёмного: `:root` и `.dark` равны по специфичности, и на `<html>` побеждает правило, записанное позже (комментарий `globals.css:37-42`).

| Переменная | Light (`:root`, `.admin-theme-light`) | Dark (`.dark`, `.admin-theme-dark`) | Назначение |
|---|---|---|---|
| `--background` | `#F4F2EE` | `#0A0A0A` | Фон страницы, «земля» |
| `--surface` | `#FFFFFF` | `#141414` | Поверхность карточки/панели, поднятой над фоном |
| `--foreground` | `#0A0A0A` | `#F0EEE8` | Основной текст; заливка primary-кнопки |
| `--foreground-muted` | `#6B6B6B` | `#888884` | Вторичный текст, описания, неактивные ссылки |
| `--foreground-subtle` | `#A8A8A8` | `#6E6E6A` | Третичный текст: eyebrow, даты, метаданные |
| `--border` | `#E8E6E0` | `#222220` | Обычная граница 1px, разделители |
| `--border-strong` | `#C0BEB8` | `#3A3A38` | Усиленная граница: hover, outline-кнопки, скроллбар |
| `--bg-overlay-90` | `rgba(244,242,238,.90)` | `rgba(10,10,10,.90)` | Полупрозрачный фон поверх фото (бейджи, оверлеи) |
| `--bg-overlay-95` | `rgba(244,242,238,.95)` | `rgba(10,10,10,.95)` | То же, плотнее: панели навигации, нижний оверлей карточки |
| `--fg-overlay-05` | `rgba(10,10,10,.05)` | `rgba(240,238,232,.05)` | Лёгкая hover-заливка |
| `--fg-overlay-08` | `rgba(10,10,10,.08)` | `rgba(240,238,232,.08)` | Активная заливка, hover-скрим на изображении |
| `--fg-on-dark-60` / `-70` / `-80` | `rgba(244,242,238,.6/.7/.8)` | `rgba(10,10,10,.6/.7/.8)` | Текст на инвертированной поверхности (карточка тарифа, залитая `--foreground`) |
| `--home-nav-h` | `66px` | — | Высота плавающего хедера; синхронизируется из `HomeFullPageScroll` (`globals.css:194-201`) |
| `--home-bottom-nav-h` | `calc(4.5rem + env(safe-area-inset-bottom))` | — | Полоса под мобильную нижнюю навигацию |

Токены движения (`--ease-*`, `--dur-*`) лежат в отдельном блоке `:root` выше, вместе со шрифтами (`globals.css:13-35`, движение — `:19-34`), и описаны в разделе 7. В админке они не переобъявляются.

Блок `@theme inline` (`globals.css:6-11`) теперь держит только кривые движения `--ease-out` / `--ease-in-out` / `--ease-drawer`, из которых Tailwind делает утилиты `ease-out`, `ease-in-out`, `ease-drawer`. shadcn-имена `--color-background`, `--color-muted-foreground` и остальные `--color-*` удалены при ревью 2026-09. Классы `bg-background`, `text-muted-foreground`, `bg-primary`, `bg-accent` и подобные жили только в двух мёртвых файлах, `src/components/ui/button.tsx` и `src/components/blocks/hero-section-1.tsx`; оба удалены 2026-09-27 (раздел 6), в `src/` этих классов больше нет, и ни во что они не компилируются. Не используй их.

### Жёсткое правило цвета

```tsx
// ДА
className="bg-[var(--surface)] text-[var(--foreground-muted)] border border-[var(--border)]"

// НЕТ
className="bg-neutral-900 text-gray-500 border-zinc-800"
style={{ background: "#0a0a0a", color: "rgba(255,255,255,0.6)" }}
```

Никаких `text-gray-*`, `bg-neutral-*`, `border-zinc-*`, никаких hex/rgba литералов в стилях компонентов. Единственные легитимные исключения, подтверждённые кодом:

1. **`bg-white` под фотографией товара.** Это осознанная конвенция для вырезанных каталожных снимков: `src/components/product/ProductCard.tsx:94` и `src/components/product/ProductClient.tsx:180, 196`. Белая подложка нужна и в тёмной теме.

   **Замеренный фон снимка перекрывает `bg-white`.** Фото каталога приходят от десятка ретейлеров, и каждый снимает на своём фоне. При `object-contain` в боксе фиксированной пропорции по двум сторонам остаётся подложка бокса — то есть снимок на тёплом сером сидит в белой рамке с видимым швом. Поэтому цвет фона снимка замеряется на сервере (`src/lib/server/bg-color.ts`) и хранится в `products.bg_color`, а бокс изображения красится им:

   ```tsx
   import { photoBackdrop } from "@/lib/image";

   <div className="relative bg-white overflow-hidden aspect-[3/4]" style={photoBackdrop(product.bgColor)}>
   ```

   Правила:
   - Это **единственный** случай, когда сырой цвет попадает в `style`: он не про дизайн, а про данные товара, поэтому переменной, в которой он мог бы жить, не существует.
   - Только через `photoBackdrop()`. Функция пропускает исключительно `#rrggbb`, поэтому испорченная строка в базе не превратится в произвольный CSS.
   - Класс `bg-white` **остаётся** и работает как fallback: у товара без замера (`bg_color` пуст или `'none'`) поведение прежнее.
   - Красится **только бокс изображения**. Тело карточки остаётся на `bg-[var(--surface)]` — иначе карточка перестанет быть частью темы.
   - Если на экране фото цветового варианта, брать `bgColor` варианта: это отдельная строка товара, снятая, возможно, на другом фоне.
2. **`bg-black/NN` для контрола, лежащего поверх фото.** `ProductCard.tsx:154,169` — кнопки корзины и лайка на десктопе. Здесь фон не тема, а фотография. На телефоне контрол на фото светлый — `bg-white/80 text-black` (§12.6, `ProductCard.tsx:171`).
3. **Семантические статусы** (`emerald` / `amber` / `red`) — токенов для них в системе **нет**. В админке для них есть устоявшийся рецепт (раздел 9), на публичном сайте — нет (раздел 11).

### Зачем `--*-overlay-*` и когда их брать

Комментарий в `globals.css:54` объясняет причину: «pre-computed semi-transparent variants (avoids Tailwind v4 opacity modifier issues with CSS vars)». Проектная договорённость — **не писать `bg-[var(--foreground)]/70`**, а брать готовую переменную.

Практическое замечание, где данные расходятся: на Tailwind v4 (в проекте `tailwindcss ^4`) модификатор непрозрачности на `var()` компилируется в `color-mix()` и технически работает — так что `src/app/builder/page.tsx:1728` ничего не ломает. Но конвенция остаётся: берём предвычисленный токен, потому что он даёт одинаковый результат в обеих темах и не зависит от версии Tailwind.

Когда что:

- фон бейджа/оверлея поверх изображения → `bg-[var(--bg-overlay-90)]` (`OutfitCard.tsx:70`, от `md`; на телефоне — светлый контрол §12.6);
- плотная панель поверх фото → `bg-[var(--bg-overlay-95)]` (`ProductCard.tsx:139`). Плавающие панели телефона — нижнее меню и полосы покупки — на `--surface-overlay-92` (§12.2, `MobileBottomNav.tsx:40`);
- hover-заливка кнопки/строки → `hover:bg-[var(--fg-overlay-05)]` (`browse/page.tsx:93`, `StylistDrawer.tsx:739`);
- активное состояние, hover-скрим на картинке → `bg-[var(--fg-overlay-08)]` (`OutfitCard.tsx:83`, `MobileBottomNav.tsx:60`);
- текст на поверхности, залитой `--foreground` → `text-[var(--fg-on-dark-60)]` / `-70` / `-80` (`plans/page.tsx:218,253`, `profile/page.tsx:1019`; на телефоне выбранная карточка тарифа не заливается, §12.13).

---

## 2. Типографика

Шрифт **один** — Inter Tight, подключённый через `next/font`. `globals.css:15-17` присваивает `--font-body`, `--font-display` и `--font-mono` одно и то же семейство.

Следствие: **класс `font-mono` — визуальный no-op.** Он встречается в `src/` около 180 раз (`MobileBottomNav.tsx`, `plans/page.tsx`, `StylePicker.tsx` и т.д.) и не даёт никакого контраста. Не добавляй `font-mono` ради «технического» вида — он ничего не делает. Существующие использования читай как семантический маркер, не как шрифт.

Отдельно: `var(--font-poppins)` применяется инлайновым `style` в четырёх местах — вордмарк в хедере (`Navigation.tsx:171`, weight 800), вордмарк формы входа (`AuthForm.tsx:294`), крупная «404» на `not-found.tsx:8` и вордмарк GOO на `error.tsx:21` (пятое, мёртвая `/coming-soon`, удалено 2026-09-27). Для нового UI Poppins не берём.

### Базовый текст

```css
/* src/app/globals.css:193-200 */
body {
  font-size: 14px;
  line-height: 1.6;
  letter-spacing: 0.01em;
}
```

### Шкала

Размеры пишутся **в bracket-px** (`text-[13px]`), это доминирующая форма (около 1200 против 840 именованных на 2026-09-26). Именованные классы Tailwind (`text-sm`, `text-xs`) допустимы, но в пределах файла держись одной формы.

| Роль | Рецепт | Источник |
|---|---|---|
| Hero-вордмарк | `text-[72px] md:text-[100px] lg:text-[128px] font-bold tracking-[-0.04em]` | `HeroSection.tsx:34-35` |
| H1 списковой страницы | `text-4xl md:text-5xl font-black uppercase` | `saved/page.tsx:213`, `profile/page.tsx:190` |
| H1 legal / sitemap | `text-5xl md:text-6xl font-black uppercase` | `privacy/page.tsx:176`, `sitemap-page/page.tsx:47` |
| H1 editorial (about/blog) | `text-5xl md:text-7xl font-black uppercase leading-[0.95] tracking-tight` | `about/page.tsx:21`, `blog/page.tsx:64` |
| H1 детальной страницы (PDP/образ) | `text-3xl md:text-4xl font-bold leading-tight` | `ProductClient.tsx:254`, `outfit/[id]/page.tsx:141` (там ещё `uppercase`) |
| H2 секции главной | `text-[30px] sm:text-4xl md:text-5xl lg:text-[56px] font-bold tracking-[-0.04em] leading-[1.04]` | `src/app/page.tsx:57` (`SectionH2`) |
| H2 секции под фолдом | `text-2xl md:text-3xl font-bold uppercase` | `ProductClient.tsx:502` |
| Заголовок карточки | `text-[15px] font-semibold leading-snug truncate` | `ProductCard.tsx:176`, `OutfitCard.tsx:104` |
| Подзаголовок карточки | `text-[13px] text-[var(--foreground-muted)]` | `ProductCard.tsx:180` |
| Цена в карточке | `text-[14px] font-medium text-[var(--foreground)]` | `ProductCard.tsx:184` |
| Мета в карточке | `text-[12px] text-[var(--foreground-subtle)]` | `ProductCard.tsx:192` (число цветов) |
| Основной текст блока | `text-sm text-[var(--foreground-muted)] leading-relaxed` | `terms/page.tsx:13`, `plans/page.tsx:170` |
| Eyebrow / надзаголовок | `text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]` | `saved/page.tsx:210`, `about/page.tsx:18` |
| Микро-подпись, чип | `text-[9px] tracking-[0.16em] uppercase` | `outfit/[id]/page.tsx:175` |

**Пол шкалы — 10px.** Размеры 8px существуют (`plans/page.tsx:197`, `ProductClient.tsx:390`), но это отклонения, повторять не надо.

### Класс `.label`

```css
/* src/app/globals.css:339-345 */
.label {
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--foreground-muted);
  font-weight: 500;
}
```

Честно: **`.label` не применён нигде** — поиск `className="label"` по `src/` даёт ноль. Компонент `src/components/ui/SectionLabel.tsx`, кодировавший тот же рецепт, никем не импортировался и удалён 2026-09-27. Все ~129 eyebrow написаны руками, и половина из них берёт `--foreground-subtle`, а не `--foreground-muted` из утилиты (66 против 56 на 2026-09-26; на публичном сайте почти все — `--foreground-subtle`, `--foreground-muted` дают в основном шапки таблиц админки). То есть утилита и реальность расходятся по цвету — это открытый вопрос, а не решённый.

Для нового кода: пиши eyebrow строкой `text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]` — это фактическое большинство. Не изобретай новый tracking.

### Правило tracking

- Uppercase-подписи всегда с положительным tracking. Каноническое значение — **`0.18em`** (около 160 использований на 2026-09-26; то же значение указано в `.label`).
- Допустимые исторические значения: `0.14em` (ссылки навигации `Navigation.tsx:163`, CTA), `0.12em`, `0.16em`. Новых значений не вводить; `0.22em`, `0.2em`, `0.15em`, `0.1em` в коде есть, но это разброс, а не шкала.
- Крупные заголовки — наоборот, отрицательный tracking: `tracking-[-0.04em]` — константа display-типографики (`page.tsx:57`, `gooey-text-morphing.tsx`).
- С 2026-09-12 трекинг крупных именованных кеглей проставляется автоматически (`globals.css:748-775`): `text-3xl`/`text-4xl` → `-0.015em`, `text-5xl`/`text-6xl` → `-0.022em`, `text-7xl`…`text-9xl` → `-0.03em`. Правило срабатывает только там, где у элемента нет своего `tracking-*`, и не покрывает кегли в bracket-px (`text-[56px]`) и `clamp()` — там трекинг пишется руками.

---

## 3. Сетка, отступы, контейнеры

### Контейнер страницы

Единственный рецепт внешнего контейнера во всём сайте:

```tsx
<div className="min-h-screen">
  <div className="max-w-[1440px] mx-auto px-3 md:px-12">
    {/* ... */}
  </div>
</div>
```

Источники: `Navigation.tsx:189`, `Footer.tsx:42`, `product/[id]/page.tsx:104`, `saved/page.tsx:211`, `profile/page.tsx:198`, `blog/page.tsx:24` — около 20 файлов.

От `md` поле везде `md:px-12`. Ниже `md` оно зависит от экрана (мобильный трек, §12):
- `px-3` (12 px, край совпадает с капсулой шапки) — шапка, подвал, страницы с карточками и плашками: товар, образ, лайки, профиль, корзина, журнал;
- `px-4` — главная (`max-w-[1280px]`) и статья журнала;
- `px-5` (20 px) — текстовые страницы: правила, «О нас», карта сайта (`about/page.tsx:11`), по макету «Б · Правовая страница».

До мобильного трека везде было `px-6`.

`max-w-7xl` в коде **не встречается ни разу** (единственное вхождение было в мёртвом `hero-section-1.tsx:79`, удалён 2026-09-27). `max-w-2xl/3xl/4xl/5xl/6xl` — только внутренние меры текста (например, `privacy/page.tsx:372`: `pt-6 md:pt-24 pb-14 md:pb-32 max-w-2xl`), никогда не внешний контейнер.

Главная страница использует более узкую внутреннюю меру: `max-w-[1280px] mx-auto px-4 md:px-12` (`page.tsx:125`, `HowItWorksSection.tsx:223`, `AIStylistShowcase.tsx:524`).

### Брейкпоинты

Стандартные Tailwind. Реально используются `sm` (640), `md` (768) — главный переключатель мобильный/десктоп, `lg` (1024), `xl` (1280) редко. `md` — точка, где меняется всё: паддинги (`px-3 md:px-12`), сетки, размер overlay-контролов, показ/скрытие нижней навигации.

### Вертикальный ритм

- Начало контента списковой страницы: `md:pt-16` (`saved/page.tsx:212`); на телефоне спокойный заголовок начинается под шапкой — `pt-4` (§12.1 п. 7).
- Начало контента детальной страницы после хлебных крошек: `md:mt-12` (`ProductClient.tsx:162`); на телефоне — `mt-3`.
- Секция под фолдом: `md:mt-28` (`ProductClient.tsx:679`); на телефоне — `mt-10`.
- Секция с данными, отбитая линейкой: `mt-16 border-t border-[var(--border)] pt-10`. Оба источника рецепта, `PriceHistoryChart.tsx:52` и `ProductReviews.tsx:123`, после ревью 2026-09 сняты со страницы товара и удалены 2026-09-27; живого примера рецепта сейчас нет.
- Полноширинная секция контентной страницы: `border-t border-[var(--border)]` + `md:py-28` (`about/page.tsx:58-59`); на телефоне — `py-10`.
- Футер: `md:mt-32`, `md:py-24` (`Footer.tsx:41-42`); на телефоне — плашка с `mt-8` (§12.13).
- Сетка карточек: `md:gap-4` — везде; на телефоне `gap-2.5`.

### Сетки карточек

```tsx
// каталог: browse/page.tsx:1807
"grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-2.5 md:gap-4"
// saved: saved/page.tsx:272, MyLooksPanel.tsx:1570 (связанные товары PDP — grid-cols-2 md:grid-cols-4, ProductClient.tsx:688)
"grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 md:gap-4"
```

Две формулы, различие исторические. Для нового каталожного грида бери второй вариант — `xl:grid-cols-4` в первом дублирует `lg` и ничего не даёт.

### `.home-section` — экран главной

```css
/* src/app/globals.css:151-170 */
.home-section {
  min-height: 100svh;
  padding-top: var(--home-nav-h);
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow-x: clip;
}
@media (max-width: 767px) { .home-section { padding-bottom: var(--home-bottom-nav-h); } }
```

Новый блок главной оборачивается в `<HomeSection>` (`src/components/home/HomeSection.tsx:113`), который выдаёт `data-home-section` для `HomeFullPageScroll` и масштабирует не помещающееся содержимое вместо обрезки. Фон секции вешается на `HomeSection`, а не на внутренний `<section>`:

```tsx
<HomeSection className="bg-[var(--background)]">
  <section className="py-4 md:py-12">
    <div className="max-w-[1280px] mx-auto px-4 md:px-12">{/* ... */}</div>
  </section>
</HomeSection>
```

Источник: `src/app/page.tsx:123-125`.

### Safe area

```tsx
// src/app/layout.tsx:55-59
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
// src/components/layout/MobileBottomNav.tsx:37 — капсула меню на 6 px выше safe area
"fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6px)]"
// зазор под нижнюю навигацию (или полосу покупки), задан один раз: ConditionalSiteLayout.tsx:79
"pb-[calc(env(safe-area-inset-bottom)+68px)]"   // с полосой покупки — +82px
```

### Z-index

Шкалы нет — все значения литеральные. Фактическая лестница:

| Слой | Значение | Пример |
|---|---|---|
| Нижняя навигация, полосы покупки на телефоне, скрим корзины | 40 | `MobileBottomNav.tsx:37`, `ProductClient.tsx:723`, `Navigation.tsx:594` |
| Sticky-хедер, дропдауны, drawer, листы корзины и фильтров на телефоне | 50 | `Navigation.tsx:188,277,596,665`, `browse/page.tsx:1068,1588` |
| Скрим стилиста на телефоне | 55 | `StylistDrawer.tsx:672` |
| Подменю валют, панель стилиста, баннер cookies | 60 | `Navigation.tsx:485`, `StylistDrawer.tsx:657-659`, `CookieConsentBanner.tsx:47` |
| Модалка выбора стиля (на телефоне — лист) | 70 | `StylePicker.tsx:71,285` |
| UpgradeModal, модалка сохранения образа (на телефоне — лист) | 80 | `UpgradeModal.tsx:81`, `builder/page.tsx:2345,2461` |
| Модалка выхода | 200 | `Navigation.tsx:705` |

Новый оверлей — вписывай в эту лестницу, не выдумывай промежуточных значений.

---

## 4. Радиусы, границы, поверхности

### Шкала радиусов

| Класс | px | Применение | Источник |
|---|---|---|---|
| `rounded-lg` | 8 | Инпуты, миниатюры, мелкие плашки | `browse/page.tsx:776`, `ProductClient.tsx:139` |
| `rounded-xl` | 12 | **Карточка товара**, кнопки, списки опций, обёртка ячейки грида | `ProductCard.tsx:80`, `browse/page.tsx:570` |
| `rounded-2xl` | 16 | Крупные панели, модалки, drawer, пустое состояние | `ProductClient.tsx:195`, `MyLooksPanel.tsx:800` |
| `rounded-full` | — | Пилюли, чипы, круглые иконки, бейджи-счётчики | ~330 использований |
| `rounded-[28px]` | 28 | Полноширинная showcase-панель главной | `AIStylistShowcase.tsx:560` |

`rounded-md` встречается 6 раз — оверлей-бейджи в `saved/page.tsx:68`, `MyLooksPanel.tsx:716,1037` и три элемента админки: плашка плана и миниатюра на дашборде, бейдж «Admin» в меню (см. раздел 11); ещё 4 вхождения были в мёртвых `ui/button.tsx` и `OutfitCarousel.tsx`, удалённых 2026-09-27. Он не является частью языка — это остатки shadcn. Не использовать.

Единственный конфликт в коде: `ProductCard` — `rounded-xl` (`ProductCard.tsx:80`), `OutfitCard` — `rounded-2xl` (`OutfitCard.tsx:40`). Они лежат в одних и тех же сетках. Канон — `rounded-xl` (обёртка ячейки грида везде `rounded-xl`: `browse/page.tsx:1331,1351`, `ProductClient.tsx:553,574`, `RecentlyViewed.tsx:74`), `OutfitCard` — отклонение.

### Что такое «поверхность»

Глубина в системе выражается **границей, а не тенью**. Токена тени нет вообще; там, где тень встречается, это либо Tailwind `shadow-md`, либо инлайновый rgba.

- **Карточка** — поднята над страницей: `rounded-xl border border-[var(--border)] bg-[var(--surface)]` (`ProductCard.tsx:80`).
- **Панель** — крупный контейнер контента: `rounded-2xl border border-[var(--border)]` + паддинг `px-6 md:px-10 py-8 md:py-12` (`ProductClient.tsx:195`).
- **Плавающая панель** (дропдаун, drawer, модалка): `rounded-2xl border border-[var(--border)] bg-[var(--background)] overflow-hidden` + `boxShadow: "0 8px 32px rgba(0,0,0,0.28)"` (`Navigation.tsx:375-376`).
- **Внутренние разделители** — не вложенные карточки, а линейки: `border-b border-[var(--border)]` с `mb-8 pb-8` (`ProductClient.tsx:210`). Аккордеонов на PDP нет.
- **Hover-состояние поверхности**: `hover:border-[var(--border-strong)] hover:bg-[var(--surface)] transition-colors duration-200` (`ProductClient.tsx:398`).

Заливка панели `bg-[var(--background)]` (равная фону страницы) встречается — `ProductClient.tsx:195`, `plans/page.tsx:191` — но противоречит канону `bg-[var(--surface)]` из `ProductCard`. Для новой карточки бери `--surface`.

---

## 5. Компоненты — канонические рецепты

### 5.1 Карточка товара — `ProductCard`

Канон. Не дублируй разметку, импортируй компонент: `import ProductCard from "@/components/product/ProductCard"`.

```tsx
// src/components/product/ProductCard.tsx:79-84, 92-97, 161, 174-185
<motion.div
  className="group relative flex flex-col overflow-hidden rounded-xl bg-[var(--surface)] border border-[var(--border)]"
  initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
  whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
  viewport={{ once: true, margin: "-40px" }}
  transition={{ type: 'spring', bounce: 0.2, duration: 0.8 }}
>
  <Link href={linkHref} className="block">
    {/* style — замеренный фон снимка, см. раздел 1; bg-white остаётся fallback'ом */}
    <div
      className="relative bg-white overflow-hidden aspect-[3/4]"
      style={photoBackdrop(shown.bgColor)}  // shown — показанный цветовой вариант или сам товар
    >{/* image */}</div>
  </Link>

  {/* overlay-контрол: всегда виден на мобиле, по hover на десктопе */}
  <button className="absolute top-3 right-3 z-20 w-9 h-9 md:w-7 md:h-7 flex items-center justify-center
                     bg-black/80 backdrop-blur-sm rounded-full transition-opacity duration-200
                     md:opacity-0 md:group-hover:opacity-100 opacity-100" />

  <Link href={linkHref} className="block px-5 pt-4 pb-5">
    <h3 className="text-[15px] font-semibold text-[var(--foreground)] truncate leading-snug">{brand}</h3>
    <p className="text-[13px] text-[var(--foreground-muted)] truncate mt-0.5 leading-snug">{name}</p>
    <p className="text-[14px] font-medium text-[var(--foreground)] mt-2">{price}</p>
  </Link>
</motion.div>
```

Ячейка грида вокруг карточки:

```tsx
// browse/page.tsx:1331, ProductClient.tsx:553, RecentlyViewed.tsx:74
<div className="rounded-xl bg-[var(--background)] hover:shadow-md transition-colors duration-200">
```

Расхождение, которое надо знать: заливка overlay-контрола в `ProductCard.tsx:161` — сырой `bg-black/80` с `text-white`, а в `OutfitCard.tsx:89` — токенизированный `bg-[var(--bg-overlay-90)]`. Для новых контролов поверх фото правильнее токен, но размер бери из `ProductCard` (`w-9 h-9 md:w-7 md:h-7`).

### 5.2 Карточка образа — `OutfitCard`

```tsx
// src/components/outfit/OutfitCard.tsx:39-47, 81, 102-108
<motion.div className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
  <Link href={`/outfit/${outfit.id}`} className="block relative">
    <div className="img-zoom relative bg-[var(--surface)] overflow-hidden aspect-[3/4]">
      <OutfitCollage outfit={outfit} sizes="(max-width: 768px) 50vw, 25vw" />
      <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--fg-overlay-08)] transition-colors duration-500 z-10" />
    </div>
  </Link>
  <Link href={`/outfit/${outfit.id}`} className="block px-5 pt-4 pb-5">
    <h3 className="text-[15px] font-semibold text-[var(--foreground)] truncate leading-snug">{outfit.name}</h3>
    <p className="text-[13px] text-[var(--foreground-muted)] mt-1">{price}</p>
  </Link>
</motion.div>
```

Коллаж всегда через `OutfitCollage` (`src/components/outfit/OutfitCollage.tsx`) — в `saved/page.tsx`, `MyLooksPanel.tsx` и `builder/page.tsx` он переписан руками пять раз и копии разошлись, см. раздел 11.

### 5.3 Кнопки

**Primary (заливка-инверсия)** — доминирующий рецепт, 69 совпадений:

```tsx
className="text-xs tracking-[0.14em] uppercase font-medium
           text-[var(--background)] bg-[var(--foreground)]
           px-8 py-4 rounded-xl hover:opacity-80 transition-opacity duration-200
           disabled:opacity-40 disabled:cursor-not-allowed"
// about/page.tsx:238, profile/page.tsx:766, StylistPersonalizationModal.tsx:277
```

Компактная форма для карточек (фиксированная высота):

```tsx
className="w-full h-11 md:h-10 rounded-xl flex items-center justify-center gap-2
           text-[11px] tracking-[0.1em] uppercase font-semibold
           bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity
           disabled:opacity-30"
// saved/page.tsx:99, MyLooksPanel.tsx:762
```

**Secondary (outline)** — 30 совпадений:

```tsx
className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)]
           border border-[var(--border)] px-8 py-4 rounded-xl
           hover:border-[var(--foreground)] transition-colors duration-200"
// about/page.tsx:244
```

Компактная форма:

```tsx
className="flex-1 h-10 md:h-8 rounded-xl md:rounded-lg border border-[var(--border)]
           flex items-center justify-center gap-1.5 text-[12px] md:text-[11px] font-medium
           text-[var(--foreground-muted)] hover:text-[var(--foreground)]
           hover:border-[var(--border-strong)] transition-colors"
// MyLooksPanel.tsx:1246, 1255
```

**Ghost (текстовая)**:

```tsx
className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]
           transition-colors underline underline-offset-4"
// src/app/page.tsx:127
// либо анимированное подчёркивание утилитой .link-underline (globals.css:348)
className="text-xs text-[var(--foreground)] link-underline"   // browse/page.tsx:1476
```

**Icon (круглая)**:

```tsx
className="w-8 h-8 rounded-full flex items-center justify-center
           text-[var(--foreground-muted)] hover:text-[var(--foreground)]
           hover:bg-[var(--fg-overlay-05)] transition-colors"
// StylistDrawer.tsx:719
```

Иконка внутри — всегда инлайновый SVG, библиотеки иконок в проекте нет:

```tsx
<svg width="13" height="13" viewBox="0 0 16 16" fill="none"
     stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
```

### 5.4 Поле ввода

```tsx
className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5
           text-base md:text-[13px] text-[var(--foreground)]
           placeholder:text-[var(--foreground-subtle)]
           outline-none focus:border-[var(--border-strong)] transition-colors"
// browse/page.tsx:776
```

`text-base md:text-[13px]` — обязательно: 16px на мобильном не даёт iOS зумить страницу при фокусе.

Подпись над полем:

```tsx
<label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5">
```

Фокус поля выражается **цветом границы**: у поля стоит `outline-none`, и общее кольцо `:focus-visible` (раздел 5.12) на нём не рисуется.

### 5.5 Модалка

```tsx
// src/components/look/MyLooksPanel.tsx:892-902 (подтверждение удаления образа)
<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
     onClick={close}>
  <motion.div
    initial={{ opacity: 0, scale: 0.92 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.92 }}
    transition={{ duration: 0.15 }}
    className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-6 max-w-xs w-full"
    onClick={(e) => e.stopPropagation()}
  >
    {/* ... */}
  </motion.div>
</div>
```

Нижний лист на мобильном — тот же контейнер с `rounded-t-2xl`, ручкой `w-8 h-[3px] rounded-full bg-[var(--border-strong)]` и классом `animate-slide-up` (`builder/page.tsx:2414-2417`).

### 5.6 Drawer

```tsx
// src/app/browse/page.tsx:930-946
<motion.div
  initial={{ x: -280, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: -280, opacity: 0 }}
  transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.8 }}
  className="fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-[var(--background)]
             border-r border-[var(--border)] flex flex-col"
>
  <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
    {/* заголовок + круглая кнопка закрытия */}
  </div>
</motion.div>
```

Плюс отдельный скрим на `z-40` с `transition={{ duration: 0.2 }}`, блокировка скролла через `useScrollLock(open)` и закрытие по Escape.

Единого рецепта скрима нет: в коде живут `bg-black/20` (`browse/page.tsx:930`, `Navigation.tsx:558`), `bg-black/40` (`StylistDrawer.tsx:667`, `MyLooksPanel.tsx:47`), `bg-black/50` (`MyLooksPanel.tsx:792,893`), `bg-black/60` (`MyLooksPanel.tsx:929`, `StylePicker.tsx:66`, `UpgradeModal.tsx:80`) и `bg-black/70` (`builder/page.tsx:2296,3017,3078`). Для новой модалки бери **`bg-black/60 backdrop-blur-sm`**: среди модалок сайта он вровень с `/70` по числу мест, но им собраны `UpgradeModal` на общем рецепте `.ov-*` и 12 из 14 скримов админки.

### 5.7 Чип / пилюля

Выбираемый чип:

```tsx
className={`px-4 py-2 rounded-full border text-[11px] tracking-[0.12em] uppercase font-medium
            transition-colors duration-200 ${
  active
    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
    : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
}`}
// profile/page.tsx:869, browse/page.tsx:1084-1086
```

Пилюля-контрол тулбара:

```tsx
className="shrink-0 flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase font-bold
           border rounded-full px-3 sm:px-5 py-2.5 transition-colors duration-200"
// browse/page.tsx:982, 1087
```

Информационный чип (не кликабельный):

```tsx
className="text-[9px] tracking-[0.16em] uppercase border border-[var(--border)]
           text-[var(--foreground-muted)] px-3 py-1.5 rounded-full capitalize"
// outfit/[id]/page.tsx:175
```

Расхождение: только в `browse/page.tsx` живут три несовместимые шкалы чипов (9px/`--foreground`, 10-11px/`--border`, 12px/`--border-strong`). Для нового кода — вариант 11px/`0.12em`/`--border-strong`.

### 5.8 Сегментированный контрол (табы)

Лучшая реализация в проекте:

```tsx
// src/app/saved/page.tsx:218-235
<div className="flex gap-0 bg-[var(--surface)] rounded-full p-1 border border-[var(--border)] w-fit">
  {tabs.map((t) => (
    <button
      key={t.id}
      onClick={() => setView(t.id)}
      className="relative shrink-0 px-5 py-2 text-[10px] tracking-[0.16em] uppercase font-medium
                 rounded-full z-10 transition-colors duration-200"
      style={{ color: view === t.id ? "var(--background)" : "var(--foreground-muted)" }}
    >
      {view === t.id && (
        <motion.div
          layoutId="saved-tab-pill"
          className="absolute inset-0 rounded-full bg-[var(--foreground)]"
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          style={{ zIndex: -1 }}
        />
      )}
      {t.label}
    </button>
  ))}
</div>
```

(Размер подписи приведён к `profile/page.tsx:217`; в `saved/page.tsx:224` он `text-xs tracking-[0.12em]` — расхождение, см. раздел 11.)

Смена содержимого таба:

```tsx
<AnimatePresence mode="wait">
  <motion.div key={tab}
    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.18 }}>
```

### 5.9 Скелетон загрузки

Каноническая идея — повторить реальный layout и залить блоки `bg-[var(--surface)] animate-pulse`:

```tsx
// src/app/look/[id]/loading.tsx:9-13
<div className="rounded-2xl border border-[var(--border)] p-6">
  <div className="h-3 w-24 rounded-lg bg-[var(--surface)] animate-pulse" />
</div>
```

Каталожный скелетон карточки:

```tsx
// browse/page.tsx:1311-1318 (с исправлением поверхностей, см. раздел 11)
<div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
  <div className="animate-pulse p-2">
    <div className="bg-[var(--fg-overlay-05)] aspect-[3/4] w-full mb-3 rounded-lg" />
    <div className="bg-[var(--fg-overlay-05)] h-3 w-3/4 mb-2 rounded-lg" />
    <div className="bg-[var(--fg-overlay-05)] h-3 w-1/2 rounded-lg" />
  </div>
</div>
```

Шиммера в проекте формально нет для карточек: класс `.animate-shimmer` (`globals.css:429`) существует, но для скелетонов не применяется — везде `animate-pulse`.

### 5.10 Пустое состояние

```tsx
// src/app/browse/page.tsx:1467-1478
<div className="py-24 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)] mx-2">
  <p className="text-xl font-semibold text-[var(--foreground)] mb-2">No {noun} found</p>
  <p className="text-sm text-[var(--foreground-muted)] mb-4">Try adjusting your search or filters</p>
  <button className="text-xs text-[var(--foreground)] link-underline">Clear all filters</button>
</div>
```

Расширенный вариант с CTA-кнопкой — `saved/page.tsx:281`, `MyLooksPanel.tsx:1577`: `py-20 px-8`, заголовок `text-2xl font-bold`, `mb-8` и primary-кнопка.

### 5.11 Бейдж

Оверлей-бейдж поверх фото:

```tsx
className="absolute top-4 left-4 text-[9px] tracking-[0.16em] uppercase font-medium
           bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)]
           rounded-full px-3 py-1.5"
// ProductClient.tsx:169
```

Бейдж-счётчик (корзина, лайки):

```tsx
className="absolute -top-1 -right-1 w-4 h-4 rounded-full
           bg-[var(--foreground)] text-[var(--background)]
           text-[8px] font-bold flex items-center justify-center"
// browse/page.tsx:986, Navigation.tsx:263-274 (значение клампится до "9+")
```

### 5.12 Чего канонического рецепта НЕТ

Прямо и без выдумок:

- **Focus-ring — теперь есть** (с 2026-09-12, поэтому пункт больше не «дыра»). Глобальное правило `globals.css:216-220`: `:focus-visible { outline: 2px solid var(--border-strong); outline-offset: 2px; border-radius: 2px }`, при `prefers-contrast: more` — 3px цветом `--foreground` (`globals.css:644-648`). Кольцо рисуется только при клавиатурном фокусе, мышиный сценарий не меняется. Элемент со своей индикацией фокуса отказывается от кольца сам, через `outline-none` рядом со своим стилем (так сделаны поля ввода). `outline-none` без замены не ставь.
- **Токены статусов** (успех/предупреждение/ошибка). В токенном слое их нет. В админке рецепт устоялся (раздел 9). На публичном сайте единого рецепта нет: плашки ошибки собраны на `red-500/8`…`/15` с `text-red-400` в разных сочетаниях (`report/page.tsx:351`, `AuthForm.tsx`, `StylistDrawer.tsx`, `MyLooksPanel.tsx`).
- **Токен тени.** `--shadow-*` не существует. В коде — `shadow-md`, `shadow-xl`, `shadow-2xl` и инлайновые rgba (`StylistDrawer.tsx:681`, `Navigation.tsx:376`). Для плавающей панели бери `boxShadow: "0 8px 32px rgba(0,0,0,0.28)"` как в `Navigation.tsx:376`.
- **Токен z-index.** См. лестницу в разделе 3.
- **Toast/уведомление на публичном сайте.** Общего компонента нет; каждое место рисует своё (`builder/page.tsx:2933`, `subscribe/page.tsx:296`). В админке рецепт тоста есть (раздел 9).

---

## 6. Кнопки: особый случай

**Статус:** shadcn-кнопка `src/components/ui/button.tsx` и её единственный импортёр `src/components/blocks/hero-section-1.tsx` удалены 2026-09-27 по итогам код-ревью 2026-09, с разрешения CEO (коммит `7898c3f`, `docs/CODE_REVIEW_2026-09.md`). Вместе с ними ушли пакеты `@radix-ui/react-slot` и `class-variance-authority`. Общего компонента кнопки в проекте нет. Ниже — история, почему файл не стал основой системы.

Каким он был (история, до 2026-09-27):

- `src/components/ui/button.tsx` — shadcn-примитив с `cva`: 6 вариантов × 4 размера, базовый класс `rounded-md text-sm` (`button.tsx:8`). Кольцо фокуса в проекте даёт не он, а глобальное правило `:focus-visible` (с 2026-09-12, раздел 5.12).
- Импортировал его **ровно один файл** во всём `src/`: `src/components/blocks/hero-section-1.tsx:6`.
- Этот файл, в свою очередь, **не импортировал никто**.
- Значит, `<Button>` не рендерился нигде. Ноль живых использований против **~510 сырых `<button>` в 61 файле** (счёт 2026-09-26).
- Его варианты не совпадали с реальным языком: `rounded-md` — 10 использований в проекте на тот момент против ~290 `rounded-xl` и ~330 `rounded-full`; `text-sm` / `h-10` вообще не соответствовали uppercase-tracked рецептам.
- Его семантические классы (`bg-primary`, `bg-accent`, `border-input` и т.д.) после удаления `--color-*` из `@theme inline` (раздел 1) ни во что не компилировались: импортированный `<Button>` отрисовался бы без фона и цвета.

`hero-section-1.tsx` экспортировал имя `HeroSection`, совпадавшее с живым `src/components/home/HeroSection.tsx:8`, и вместе с `button.tsx` был единственным носителем shadcn-семантических классов (`bg-muted`, `text-muted-foreground` и т.п.). Оба выглядели как дизайн-система, но не отгружались.

### Одно правило для новых кнопок

**Собирай кнопку из рецептов раздела 5.3, дословно копируя один из четырёх вариантов (primary / secondary / ghost / icon) и меняя только текст и обработчик.** В админке — рецепты раздела 9. Не заводи общий примитив кнопки со своими вариантами в обход рецептов (именно так появился и умер `button.tsx`). Если рецепт не подходит — это повод обсудить расширение системы, а не написать одиннадцатый вариант инлайном.

---

## 7. Движение и анимация

### Кривые: токены в CSS, старый канон в JS

С 2026-09-12 кривые в CSS названы токенами (`globals.css:19-29`, продублированы в `@theme inline` `:6-11`, поэтому доступны и как утилиты `ease-out` / `ease-in-out` / `ease-drawer`):

| Токен | Значение | Когда |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | вход, выход, всё интерфейсное по умолчанию |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | перемещение уже видимого элемента |
| `--ease-drawer` | выдвижные панели и нижние листы (кривая Ionic/iOS) | `cubic-bezier(0.32, 0.72, 0, 1)` |

Сырых `cubic-bezier(...)` в правилах `globals.css` больше нет — только в объявлениях токенов. Утилита Tailwind `ease-out` тоже теперь даёт `--ease-out` проекта, а не стандартную кривую Tailwind.

В JS (framer-motion) живёт прежняя кривая `[0.25, 0.46, 0.45, 0.94]`: локальный `const EASE` в `OutfitExamplesCarousel.tsx:8` (в `AIStylistShowcase.tsx` ушёл вместе с `FadeCard`, мобильный трек R-21) плюс инлайном в `FadeInView.tsx`, `OutfitCard.tsx`, `HeroSection.tsx`, `AuthForm.tsx`, `about`, `plans`, `browse` (ещё три копии жили в мёртвых `FeaturesBento.tsx`, `AIStylistChat.tsx`, `HowItWorksGrid.tsx`, удалённых 2026-09-27). Общего JS-модуля motion-токенов нет, и JS-кривая не совпадает с CSS-токеном `--ease-out`. Для нового framer-кода бери ту же `[0.25, 0.46, 0.45, 0.94]`, что у соседей, — выбор единой кривой для CSS и JS не сделан.

### Длительности

Шкала-токены (`globals.css:31-34`): `--dur-press` 160ms (отклик на нажатие), `--dur-fast` 150ms, `--dur-base` 200ms, `--dur-slow` 260ms. Комментарий там же: интерфейс живёт под 300 мс, drawer и модалки — до 500.

В классах: `150ms` — opacity-переключения; `200ms` — стандартный hover (`transition-colors duration-200`); `300ms` — раскрытия, slide-переходы и зум фото `.img-zoom`; `500ms` — hover-скрим на изображении карточки образа. `duration-[260ms]` (`ProductClient.tsx:281`) — единственная произвольная длительность в классах; то же значение в CSS теперь названо `--dur-slow`.

Свойство перехода в классах названо явно: `transition-all` убран правкой 2026-09-12 (`ca206c4`, 123 → 0; сейчас одно вхождение, полоса прогресса `EmbeddingsCard.tsx:178`). В коде стоят `transition-colors`, `transition-opacity`, `transition-transform` или список свойств `transition-[…]`, если меняется раскладка (`transition-[width]`, `transition-[left]` у бегунка переключателя).

### Отклик на нажатие

Глобальное правило `globals.css:294-307`: любой `button`, `[role="button"]` и `summary` при `:active` получает `scale: 0.97` за `--dur-press`. Используется независимое свойство `scale`, а не `transform`, поэтому центрирование через `-translate-x-1/2` не ломается. Отказ — класс `.no-press` или собственный `active:scale-*` на элементе. Новой кнопке писать отклик руками не нужно.

### Оверлеи: `.ov-*` и `useOverlayPresence`

Общий рецепт входа и выхода хромы (`globals.css:722-829`) — переходы с `@starting-style`, узел снимается по `transitionend` хуком `src/lib/hooks/useOverlayPresence.ts`:

| Класс | Что | Вход / выход |
|---|---|---|
| `.ov-scrim` | затемнение фона | opacity, `--dur-base` / `--dur-fast` |
| `.ov-panel` | модалка по центру | opacity + `scale(0.97)`, `--dur-slow` / `--dur-fast` |
| `.ov-pop` / `.ov-pop-up` | выпадашка от триггера (вниз / вверх) | opacity + `scale(0.98)`, `--dur-fast` / 120ms |
| `.ov-rise` | полоса снизу (баннер, нижний лист) | translateY, `--dur-slow` / `--dur-base`, кривая `--ease-drawer` |

Закрывающееся состояние — класс `.is-closing`. Сейчас рецепт применён в `UpgradeModal`, `CartPanel`, `CookieConsentBanner`, `StylistPersonalizationModal` (без выхода — у неё нет своего `open`), в листах телефона — корзина (`Navigation`), «Sort & filter» (`browse/page.tsx`), выбор стиля (`StylePicker`), листы конструктора (`builder/page.tsx`) — и в общих компонентах админки (`src/components/admin/`: `Modal`, `SidePanel`, `ConfirmDialog`, `SaveBar`, `Menu`, `FilterBar`, `Toast`). Остальные модалки сайта анимируются по-старому (framer-motion или `.animate-*`).

### Классы `.animate-*` из `globals.css`

| Класс | Определение | Назначение |
|---|---|---|
| `.animate-fade-up` | `fadeUp 0.5s var(--ease-out) forwards` (`:365`) | Появление статичного блока снизу на 12px |
| `.animate-fade-in` | `fadeIn 0.4s ease forwards` (`:389`) | Простое появление оверлея/панели |
| `.animate-scale-in` | `scaleIn 0.4s var(--ease-out)`, `scale(0.97) → 1` (`:465`) | Появление карточки/модалки |
| `.animate-slide-up` | `slide-up 0.28s var(--ease-drawer) both` (`:642`) — дубль снят 2026-09-12 | Нижний лист на мобильном (билдер) |
| `.animate-slide-in-right` | `slideInRight 0.38s var(--ease-out)` (`:449`) | Drawer справа |
| `.stylist-drawer-animate` | `slideUp 0.32s` на мобильном, `slideInRight 0.38s` с `md` (`:647-654`) | Drawer стилиста |
| `.animate-shimmer` | `shimmer-sweep 1.8s infinite` (`:494`) | Бегущий блик (в скелетонах не используется) |
| `.animate-progress-bar` | `progress-indeterminate 1.6s infinite` (`:503`) | Неопределённый прогресс |
| `.animate-scroll-hint` | `scroll-hint 2s infinite` (`:670`) | Стрелка «листай вниз» на hero |
| `.ai-pulse` | `aiPulseRing 1.6s infinite` (`:385`) | Пульсирующее кольцо AI-кнопки |
| `.stagger-children` | задержки 0…420ms по `nth-child` (`:394-401`) | Каскад для CSS-анимаций |
| `.img-zoom` / `.card-zoom-layer` | `transform 300ms var(--ease-out)`, `scale(1.05)` по hover — **только при настоящем курсоре** `(hover: hover) and (pointer: fine)` (`:336-351`) | Зум фото в карточке; на тач-экране не залипает |
| `.link-underline` | `::after` `scaleX(0 → 1)` за `--dur-base`, тоже только при настоящем курсоре (`:413-437`) | Подчёркивание ссылки по hover |

Удалены 2026-09-12 как мёртвые: `.animate-slide-in-left`, `.animate-overlay-in` (кейфреймы `overlayIn` оставлены — на них инлайновый стиль в `StylistDrawer`), `.animate-hero-fade-in` / `.animate-hero-fade-up`, `.hero-stagger`, `.noise-overlay`. Не ссылайся на них.

### Framer-motion: появление карточек

Канонический паттерн — spring с блюром, на самой карточке:

```tsx
initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
viewport={{ once: true, margin: "-40px" }}
transition={{ type: 'spring', bounce: 0.2, duration: 0.8 }}
// src/components/product/ProductCard.tsx:81-84
```

Каскад в сетке задаётся на родителе, без повторного объявления анимации на детях:

```tsx
<motion.div
  initial="hidden" animate="show"
  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
>
// browse/page.tsx:1342-1346
```

Второй, tween-вариант для контентных секций (about, plans, главная):

```tsx
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, margin: "-60px" }}
transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
// src/components/ui/FadeInView.tsx:17-20
```

**Правило:** для карточек товаров/образов — spring из `ProductCard`; для контентных секций — `FadeInView`. Локальная копия `FadeCard` была дубликатом `FadeInView` с разошедшимися значениями: в `AIStylistShowcase.tsx` её заменил `FadeInView` (мобильный трек R-21, 2026-10-07), вторая жила в мёртвом `FeaturesBento.tsx`, удалённом 2026-09-27. Не возвращай её.

Другие spring, реально применяемые: `{ stiffness: 400, damping: 35 }` — пилюля таба (`saved/page.tsx:234-236`); `{ stiffness: 380-500, damping: 38-42, mass: 0.8 }` — drawer и сегментированный переключатель.

### prefers-reduced-motion и другие системные настройки

Глобальный guard есть и покрывает все CSS-анимации, включая инлайновые `<style>`. С 2026-09-12 он убирает **движение, но не отзывчивость**: цвет, прозрачность и подсветка фокуса продолжают плавно меняться.

```css
/* src/app/globals.css:676-693 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-property: opacity, color, background-color, border-color,
                         box-shadow, outline-color, fill, stroke !important;
    transition-duration: var(--dur-fast) !important;
  }
}
```

Отклик на нажатие (`scale`) при этом выключается сам: `scale`/`transform` нет в списке переходимых свойств. Оверлеи `.ov-*` под reduced-motion только проявляются, без сдвига и масштаба (`globals.css:816-829`).

Ещё два системных сигнала (`globals.css:701-720`): `prefers-reduced-transparency: reduce` снимает `backdrop-filter` со всего, что несёт `backdrop-blur`, и подкладывает `--background`; `prefers-contrast: more` делает то же, добавляет границу `--foreground` и утолщает кольцо фокуса до 3px.

Дополнительно декоративные компоненты гасят себя сами: `FloatLoop.tsx:26`, `gooey-text-morphing.tsx:42-52`, `etheral-shadow.tsx:70`. **Любая новая непрерывная (loop) анимация обязана иметь такой же собственный guard** — глобальное правило обрежет длительность CSS-анимации, но логику rAF-цикла или framer-motion не остановит.

---

## 8. Тёмная тема

- Тёмная тема — **по умолчанию**: `src/app/layout.tsx:74` отдаёт `<html className="dark ...">`.
- Скрипт без вспышки — `src/app/layout.tsx:80`:

```js
(function(){try{
  var t=localStorage.getItem('goo-theme');
  var dark = t==='dark' || (t==='system' && matchMedia('(prefers-color-scheme: dark)').matches) || (t!=='light' && t!=='system');
  document.documentElement.classList[dark?'add':'remove']('dark');
}catch(e){document.documentElement.classList.add('dark')}})()
```

Обрати внимание на логику: тёмная тема выбирается при **любом** значении, кроме `'light'` и `'system'`, и при ошибке. Пустой localStorage у нового посетителя → тёмная.

- Дальше состояние примиряет `ThemeProvider` (`src/lib/context/theme-context.tsx:61-71`), ключ хранения — `goo-theme`.
- Тема переключается **каскадом CSS**, а не JS. Компоненты, которые ветвятся на `useTheme()` и подставляют инлайновые стили (`Navigation.tsx:123-134`; нижнее меню ветвилось так же, пока мобильный трек R-04 не перевёл его на токены), — исключение, а не образец. Единственный оправданный императивный случай — подмена растрового ассета, который нельзя переключить переменной.
- **Tailwind-вариант `dark:` к теме сайта не подключён.** В `globals.css` нет `@custom-variant dark`, поэтому на Tailwind v4 `dark:` срабатывает по системной настройке ОС (`@media (prefers-color-scheme: dark)`), а не по классу `.dark` на `<html>` и не по теме админки. Пользователь со светлой ОС и тёмной темой сайта (а это умолчание) `dark:`-стилей не увидит. Не используй `dark:` — тематизируй через токены. В коде `dark:`-классов сейчас нет (последние жили в мёртвых `PriceHistoryChart.tsx` и `blocks/hero-section-1.tsx`, удалённых 2026-09-27).

### Правило

**Любой новый элемент проверяется в обеих темах перед коммитом.** Практический чек: если ты написал `text-white`, `bg-black/NN`, `#hex` или `rgba(255,255,255,α)` — ответь на вопрос «что это будет в светлой теме на `#F4F2EE`?». Если ответ «невидимо» или «инвертировано» — это баг. В разделе 11 половина подтверждённых high-расхождений — ровно этот случай.

---

## 9. goo-studio (админка)

`src/app/goo-studio/**` — **отдельный диалект на том же токенном слое**, а не дрейф. Это сознательное решение, его надо уважать.

Целевой дизайн админки — `docs/ADMIN_DESIGN.md`, утверждён CEO 5 октября 2026 (развилки Р4, Р14–Р17 в `docs/ADMIN_ROADMAP.md`). **Этот раздел описывает то, что уже в коде.** Он переписан 2026-10-05 вместе с GS4-1 «Основа» и GS4-2 «Оболочка». Каждая следующая задача этапа 4 (компоненты, таблицы, формы, экраны) дописывает сюда свою часть. Чего здесь ещё нет, того в коде тоже нет, даже если оно есть на макетах.

Что общего с сайтом: цвет только через CSS-переменные. Во всех 20 страницах админки ноль `text-gray-*` / `bg-neutral-*` / `border-zinc-*`, ноль `dark:` и с 2026-10-05 ноль сырых `emerald-*` / `amber-*` / `red-*`. Единственное исключение — жёлтая метка кадра в `ImageCropEditor`.

### Тема админки

У админки своя тема, независимая от темы сайта на `<html>` (там по умолчанию тёмная).

- **Класс на корне.** Корень админки (`goo-studio/_ui/AdminShell.tsx:662`; до GS4-7 — `goo-studio/layout.tsx`) несёт `.admin-theme-light` или `.admin-theme-dark` (карта `THEME_CLASS`, `AdminShell.tsx:270-273`).
- **Общий набор токенов.** Токены обеих тем объявлены в `globals.css` в тех же блоках, что и тема сайта: `:root, .admin-theme-light` (`:43-62`) и `.dark, .admin-theme-dark` (`:64-82`). Класс на корне переобъявляет **весь** набор, включая `--bg-overlay-*`, `--fg-overlay-*`, `--fg-on-dark-*`. Поэтому любой элемент внутри админки берёт цвета из темы админки, а не из унаследованной темы сайта. Нативные контролы (выпадающие списки, date picker, скроллбары) следуют ей через `color-scheme` (`globals.css:84-91`).
- **Свой блок токенов.** Только в админке и только в ней: блок `globals.css:93-125` объявляет статусные токены и затемнённый `--foreground-subtle` (ниже). Публичный сайт этот блок не затрагивает.
- **Независимость от сайта.** Светлая тема админки работает и при тёмной теме сайта, и наоборот.
- **Хранение и переключатель.**
  - Выбор хранится в `localStorage` под ключом `goo-admin-theme` (`layout.tsx:12`) и читается через `useSyncExternalStore` (`layout.tsx:302-350`).
  - Сервер и гидратация рисуют умолчание, сохранённое значение применяется сразу после. Тёмную тему до первой отрисовки ставит `THEME_BOOT_SCRIPT`.
  - Умолчание — светлая.
  - Переключатель — пункт «Dark theme» / «Light theme» в меню аккаунта (`layout.tsx:820-831`).
- **Порталы.** Меню-поповеры (`Menu`, `FilterMenu`) рисуются порталом в корень админки — так они берут тему админки. Модалка, смонтированная вне корня админки, получила бы тему сайта: порталы — только в корень админки.

### Глубина и цвет (Р15, Р16)

С 2026-10-05 глубина в админке та же, что на публичном сайте: **холст — `--background`, панели — `--surface`**. До этого было наоборот, и карточки выходили темнее фона в обеих темах.

| Роль | Токен | Где |
|---|---|---|
| Холст: корень, меню, шапка, колонка контента | `--background` | `layout.tsx:689,741-745`, сайдбар `layout.tsx:695-700` |
| Панель: карточка, таблица, модалка, drawer, тост, меню аккаунта | `--surface` + `border border-[var(--border)]` | `analytics/page.tsx:58`, drawer `layout.tsx:887-888` |
| Активный пункт меню | `--surface` + `shadow-[0_0_0_1px_var(--border)]` | `layout.tsx:640` |
| Наведение на строку или пункт на холсте | `--fg-overlay-05` | `layout.tsx:641`, `layout.tsx:721,756` |
| Выбранная строка | `--fg-overlay-05` (выбор виден и по чекбоксу) | `import/page.tsx:458,718` |
| Основной текст | `--foreground` | |
| Всё, что читают: метаданные, даты, подписи | `--foreground-muted` | |
| Плейсхолдер, выключенное | `--foreground-subtle` | |

**`--foreground-subtle` в админке темнее, чем на сайте:** `#706E6A` в светлой теме, `#80807C` в тёмной (`globals.css:103,115`). Контраст:

| Где | Контраст |
|---|---|
| Белая панель | 5,09:1 |
| Бежевый холст | 4,55:1 |
| Тёмная панель `#141414` | 4,65:1 |

Причина: в коде этот токен ещё стоит на датах, счётчиках и доказательствах, которые читают. Прежний `#A8A8A8` давал 2,4:1. По `ADMIN_DESIGN.md` 4.1 его место — только плейсхолдер и выключенное. Экраны переходят на `--foreground-muted` по мере GS4-12.

**Статусные токены** (`globals.css:102-125`), только в `.admin-theme-*`:

| Токен | Светлая | Тёмная | Для чего |
|---|---|---|---|
| `--ok` / `--ok-bg` / `--ok-line` | `#047857` / `rgba(52,211,153,.14)` / `rgba(4,120,87,.3)` | `#34D399` / `rgba(52,211,153,.12)` / `rgba(52,211,153,.3)` | текст / заливка / рамка |
| `--warn` / `--warn-bg` / `--warn-line` | `#92400E` / `rgba(251,191,36,.16)` / `rgba(146,64,14,.3)` | `#FBBF24` / `rgba(251,191,36,.12)` / `rgba(251,191,36,.3)` | то же |
| `--err` / `--err-bg` / `--err-line` | `#B91C1C` / `rgba(248,113,113,.14)` / `rgba(185,28,28,.3)` | `#F87171` / `rgba(248,113,113,.12)` / `rgba(248,113,113,.3)` | то же |

- **Оттенки по темам.** В светлой теме текст — оттенок 700 (у `warn` — 800), в тёмной — 400. amber-700 на собственной заливке поверх бежевого холста давал 4,2:1. Прежний рецепт «текст `-500` на заливке `-400/15`» давал в светлой теме 2–2,5:1 («PRO», «SUPER ADMIN»).
- **Смысл.** `ok` — успех и «подключено». `warn` — предупреждение и привилегия (Super admin, Pro). `err` — ошибка и опасное действие.

**Кольцо фокуса** (`globals.css:127-136`): `outline: 2px solid var(--foreground); outline-offset: 2px` на `a`, `button`, `[role=switch|radio|tab]`, `summary`, `[tabindex]` по `:focus-visible`.
- Правило в `@layer base`, поэтому поле, у которого свой фокус (`outline-none` + `focus:border-[var(--foreground)]`), его сохраняет.
- Общее кольцо сайта из `globals.css:261` в админке перекрыто этим, более контрастным.

### Типографика: один уровень капса (Р4)

Решение CEO 2026-10-05.
- **Капс — только у самых мелких служебных подписей:** ячейки шапки таблицы, подпись KPI над большим числом, подпись группы меню. Всё, что нажимают или читают, — обычным регистром.
- **Пол шкалы в админке — 11px.** 8, 9 и 10px не используются: в `src/app/goo-studio/**` и `src/components/admin/**` их ноль, включая `fontSize` графиков.
- **Капс в данных остаётся:** маски ключей, коды валют, имена файлов SQL, `.toUpperCase()` в коде. Вордмарк «GOO» в шапке меню — логотип, не подпись.

| Роль | Рецепт | Пример |
|---|---|---|
| Заголовок страницы | `font-display text-2xl font-light text-[var(--foreground)]` — на всех 20 страницах | `goo-studio/page.tsx`, `analytics/page.tsx` |
| Подзаголовок страницы | `text-xs` или `text-[13px] text-[var(--foreground-muted)] mt-1` | |
| Заголовок секции или карточки | `text-[15px] leading-[22px] font-medium text-[var(--foreground)]`, без трекинга | «System health», «Recent signups»; модалка Customize `layout.tsx:935` |
| **Служебная подпись — единственный капс** | `text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)]` (+ `font-normal` в `<th>`) | шапки таблиц `subscriptions/page.tsx:104`, `waitlist/page.tsx:15`; подписи KPI на дашборде, в Users, Analytics; группы меню `layout.tsx:602` |
| Кнопка, вкладка, пункт меню | `text-[13px] font-medium`, обычный регистр, без трекинга | рецепты `_ui/recipes.ts`, пункты меню `layout.tsx:638` |
| Чип, фильтр-пилюля, сегмент | `text-[12px]`, обычный регистр | `FilterChips` (`FilterBar.tsx`) |
| Бейдж | `text-[11px] font-medium`, обычный регистр («Exact», «12 missing») | |
| Подпись поля | `block text-[12px] font-medium text-[var(--foreground-muted)] mb-1.5` | рецепт `FIELD_LABEL` в `_ui/recipes.ts` |
| Вспомогательный и мета-текст | `text-[12px] text-[var(--foreground-muted)]` | |
| Большое число | `font-display text-3xl font-light` (`text-2xl md:text-3xl` в карточках на телефоне) | `users/page.tsx:426` |

**Слова-данные показываются через словари подписей, а не через капс.** Примеры:
- `PLAN_LABEL` и `SUB_STATUS_LABEL` в `users/page.tsx` («Past due»);
- `styleLabel()` в products и outfits;
- `sentenceCase()` в activity;
- `first-letter:uppercase` у причин пропуска в import.

**Ещё не сведено.** Текст ячеек и абзацев пока живёт на `text-sm` / `text-xs`. Шкала `ADMIN_DESIGN.md` 4.2 (13px для текста, 12px для вторичной строки) приходит в таблицы с GS4-4 и в экраны с GS4-12.

### Оболочка (Р17, GS4-2)

- **Меню** — `<aside>` 240px (`w-60`), в свёрнутом виде — рейка 60px с иконками (`layout.tsx:695-700`).
  - **Группы** (порядок `NAV_CATEGORIES`, `layout.tsx:22-31`): Overview, Catalog, Quality, Import, Content, Users, Data, System. Подпись группы — служебная (капс 11px).
  - **Сворачивание групп.** Подпись группы — это кнопка `aria-expanded`, она сворачивает группу. Список свёрнутых хранится в `localStorage` под `goo-admin-nav-collapsed` рядом с порядком пунктов (`goo-admin-nav-order`). Свёрнутая группа продолжает показывать текущую страницу.
  - **Пункт:** 32px (`md:h-8`), 13px medium, иконка 16px, `rounded-lg`.
  - **Плотный режим.** На десктопе ниже 1024px высоты пункт — 28px и меньше отступ над группой (вариант `[@media(min-width:768px)_and_(max-height:1023px)]`). Так всё меню помещается на экране 1440×900.
  - **Super admin.** Пункт, видимый только супер-админу (Activity), помечен замком `SuperAdminMark` с подсказкой и текстом для скринридера (`layout.tsx:382-392`). Прежний бейдж «SA» удалён.
  - Нижнего блока у меню нет.
- **Шапка** — `h-14` на холсте (`layout.tsx:743-746`).
  - **Слева.** Крошка `nav aria-label="Breadcrumb"` (`layout.tsx:765`) — только на вложенных страницах из `SUBPAGE_TITLES` (`layout.tsx:285`): «Раздел / Страница». На телефоне вместо неё — имя раздела. Строк «Admin / …» внутри страниц больше нет.
  - **Справа** — аватар 32px с инициалами и меню аккаунта (`layout.tsx:780-856`, `role="menu"`): имя, почта, бейдж Super admin, тема, «Customize menu», «Back to site». Закрывается по Escape (фокус возвращается на аватар) и по клику мимо.
  - **Ещё нет:** поиска ⌘K (GS6-14) и колокольчика «Требует внимания» (GS1-2) из `ADMIN_DESIGN.md` 5.1.
- **Логотип** — «GOO» и рядом `Studio` 12px muted (`layout.tsx:679`).

### Общие компоненты и рецепты (GS4-3)

С 2026-10-05 у админки есть общие куски интерфейса. Новый код берёт их, а не пишет свои.

| Что | Где | Как пользоваться |
|---|---|---|
| Рецепты кнопок и полей | `src/app/goo-studio/_ui/recipes.ts` | `btn(kind, size)`: `primary` — одно главное действие страницы или блока; `secondary` — остальные кнопки (канон Р14: рамка `--border-strong`, текст `--foreground`); `ghost` — тихие действия (Cancel, Dismiss, Undo); `danger` — удаление среди других действий; `dangerSolid` — только подтверждающая кнопка опасного `ConfirmDialog`. Размер `md` — `h-8 px-3`, `sm` — `h-7 px-2.5` для строки таблицы, `lg` — `h-12 px-4 text-[15px]` для главного действия, закреплённого внизу экрана телефона (`PageHeader`). Плюс `BTN_ICON` (иконка 32px, обязательно `aria-label`), `BTN_ICON_SM` (28px, в строке таблицы), `BTN_ICON_OUTLINE` («…» рядом с главной кнопкой), `INPUT`, `SELECT`, `FIELD_LABEL`. Это строки классов, а не компонент: общий примитив кнопки запрещён `CLAUDE.md` |
| Карточка блока и баннер | `src/app/goo-studio/_ui/recipes.ts` (GS4-12) | `PANEL` — карточка: `rounded-xl border border-[var(--border)] bg-[var(--surface)]`, отступы и раскладку добавляет место вызова (`` `${PANEL} p-5` ``). `BANNER.err` / `.warn` / `.ok` — плашка сбоя или предупреждения (подробнее — «Статусы, баннеры и тосты» ниже). Своих констант карточки и баннера в экранах нет |
| Страница товара | `src/app/goo-studio/products/[id]/page.tsx`, `products/_editor/` (GS6-1) | Раскладка `AdminPage layout="form"` с `aside` (превью, Quality, History), разделы — `FormPanel`/`FormSection`, сохранение — `SaveBar` с названиями разделов в `note`. `PhotoGrid` — сетка фото 3/4, перетаскивание, «…» на фото для клавиатуры, загрузка файлом и по ссылке. `StoreTable` — таблица магазинов по контейнерному запросу (`@container`, от `@3xl`), уже — карточки с подписями. Чипы выбора (пол, категория, размеры, цвета, стиль) — `aria-pressed` или `role="radio"` |
| Подтверждение | `src/components/admin/ConfirmDialog.tsx` | `const confirm = useConfirm(); if (!(await confirm({ title, body, confirmLabel, tone })))`. Заголовок называет объект и последствие, кнопка — действие («Delete post», не «OK»). `tone: "danger"` — для удаления, блокировки и всего необратимого: фокус встаёт на Cancel, кнопка красная. Escape и клик мимо — «нет». `confirm()` браузера в админке не используется |
| Тост | `src/components/admin/Toast.tsx` | `const toast = useToast(); toast.ok(…)`, `toast.err(…)`, `toast.info(…)`. Панель `--surface` справа внизу, точка статуса, кнопка закрытия; успех 5 с, ошибка 8 с, пауза под курсором и фокусом; новый тост заменяет старый. `alert()` и свои тосты в страницах не заводятся |
| Пояснение за «?» | `src/components/admin/HelpToggle.tsx` | `const help = useHelp("id")`, `<HelpButton help label />` рядом с заголовком, `<HelpPanel help>` под ним. Открытость хранится в `localStorage` (`goo-admin-help-<id>`). Абзацы «как это работает» уходят сюда, видимой остаётся строка с числами и состоянием |
| Таблица | `src/components/admin/DataTable.tsx` (GS4-4) | `<DataTable label rows rowKey columns selection actions empty resetKey paging onRowClick />`. На ней Products, Users, Outfits и Blog. Строка 52px, шапка 36px — служебная подпись, с `md` прилипает к верху при прокрутке. Одна колонка `grow` берёт свободную ширину и обрезает текст, остальные ячейки в одну строку; числа — `align: "right"`, `tabular-nums`. Сортировка — `sort: { dir, onToggle }` у колонки (`aria-sort`). Действия строки — последняя колонка: видны при наведении и фокусе, на тач-экране всегда, на телефоне закреплены справа. Страницы по 50 строк с «1–50 of 412»; `resetKey` (строка фильтров и сортировки) возвращает на первую страницу. Список, который режет сервер (Users), передаёт `paging: { page, total, onPage, note? }`: `rows` — уже текущая страница, `note` — оговорка рядом со счётчиком. Выделение — у вызывающего: `selection` даёт колонку галочек, Shift-диапазон, прочерк в общей галочке (`someSelected`) и строки без галочки (`canSelect`, супер-админ). `onRowClick` открывает строку (боковая панель Users); свои кнопки и галочки строки, и меню, вынесенное порталом, клик не перехватывают; то же действие остаётся кнопкой в `actions` для клавиатуры. **На телефоне** (ниже `md`, GS4-11, макет `Phone · Products`) таблица с `card` становится списком карточек: `card={(row) => ({ thumb, title, meta, badge })}` — фото 56px (`<Thumb size="lg">`, аватар, иконка магазина), имя до двух строк 14px, одна приглушённая строка 12px, `badge` — состояние, которое нельзя пропустить (Draft, Banned), перед ней; справа «…» строки. Выбор — касанием по фото: оно и есть галочка (скрытый `input` в `label`), кружок в углу фото говорит об этом и заполняется при выборе. Без `card` телефон получает таблицу. Строка в обоих видах помечена `data-row` (стенд снимков находит строки по нему). Плюс `Thumb` (фото 40px: товар целиком на своём фоне, образ и обложка — `fit="cover"`; `size="lg"` — 56px карточки) и `EmptyState` (иконка, одна строка, действие) |
| Меню | `src/components/admin/Menu.tsx` (GS4-4) | `Menu` — кнопка с выпадающим списком; `RowMenu` — «…» строки (`size="sm"`) или шапки страницы (`outline`). Пункты: `{ label, hint?, onSelect, tone: "danger", disabled }`, разделители, подписи групп. Опасный пункт — последним, красным, действие само спрашивает `ConfirmDialog`. Панель `position: fixed` через портал в корень админки: её не обрезает таблица со скроллом и не перекрывает закреплённая колонка; при прокрутке едет за кнопкой, уехала кнопка с экрана — закрывается. Не выходит за край экрана: если с заданной стороны не помещается (кнопка у другого края телефона), выравнивается по другой, и не шире места, которое у неё есть. Стрелки, Home/End, Escape |
| Фильтры | `src/components/admin/FilterBar.tsx` (GS4-4) | `SearchField` (280px), `FilterMenu` — «Brand: All ▾» с выбором одного значения, `searchable` для длинных списков, `tone="warn"` для фильтров «чего не хватает», `variant="ghost"` для сортировки. `FilterChips` — фильтр из нескольких значений чипами с числами, когда их стоит видеть сразу («All 14 · Free 9 · Basic 2», «All 8 · Published 5 · Drafts 3»): `aria-pressed`, включённый — инверсный. `ActiveFilters` — включённые фильтры чипами (щелчок по чипу снимает), «Clear all», справа «412 of 1,224» и `trailing` (сортировка). `FilterBar` (GS4-11) собирает строку: `<FilterBar search={<SearchField/>} chips active onClearAll shown>{FilterMenu…}</FilterBar>`; на десктопе — поиск, чипы и фильтры в одну строку, на телефоне — поиск и кнопка «Filters · 2», фильтры открываются нижним листом (`SidePanel placement="bottom"`), каждый — подписанный нативный `select` (телефон показывает свой выбор), внизу «Clear all» и «Show 412 results»; `chips` остаются на виду. Один фильтр-меню (Users: Status) в лист не прячется |
| Панель выделения | `src/components/admin/BulkBar.tsx` (GS4-4) | `<BulkBar count actions onClear />` сразу после `DataTable`: инверсная панель, прилипает к низу экрана, пока видна таблица. Действие с выбором («Set plan ▾») — `menu: MenuItem[]`, список открывается над панелью. Опасные действия — после черты, красным `--err-on-inverse`; наведение — `--inverse-hover` (оба токена в `globals.css`, только в `.admin-theme-*`) |
| Бейдж | `src/components/admin/Badge.tsx` (GS4-4) | `<Badge tone dot title>`: `h-5 px-2 rounded-full text-[11px] font-medium`. Тона: `neutral` (`--fg-overlay-08`, текст `--foreground`: приглушённый на подложке не проходит AA — 4.47:1 в светлой, 4.29:1 в тёмной), `ok`, `warn`, `err` (`--*-bg` и `--*`), `inverse`. `dot` — статус в строке («● Published»). Состояние по умолчанию бейджа не получает: у активного пользователя его нет, есть у Banned и Overdue |
| Вкладки | `src/components/admin/Tabs.tsx` (GS4-4) | `<Tabs label idBase tabs value onChange />`, содержимое — в `<div {...tabPanel(idBase, key)}>`. Подчёркивание 2px `--foreground`, 13px medium, счётчик — нейтральный бейдж, у «Pending» и при нуле. Стрелки, Home/End. Вкладка меняет и подзаголовок страницы (Outfits) |
| Шапка страницы | `src/components/admin/PageHeader.tsx` (GS4-11) | `<PageHeader title titleExtra subtitle status actions primary menu menuLabel />` (ADMIN_DESIGN 5.2). Слева заголовок и строка чисел, справа по порядку: вторичные (`actions`, контурные, не больше двух), главное (`primary`, заливка, одно), «…» (`menu`). `HeaderAction` — `{ key, label, icon?, onClick? \| href?, disabled?, title? }`; `PLUS` — иконка «+» для Add. **На телефоне** в шапке заголовок и «…», в котором и вторичные действия; главное — кнопка во всю ширину внизу экрана (`btn("primary", "lg")` на затухании холста). Она уходит в место, которое оболочка держит в конце `<main>` (`PinnedActionSlot`, `sticky bottom-0`, `z-20`): прокрутка доводит последнюю строку до края над кнопкой. Пока видна `BulkBar` (`data-bulk-bar`), кнопка уступает ей низ. На ней Products, Users, Outfits, Blog и Retailers; остальные разделы переходят на неё в GS4-12 |
| Ключевые числа | `src/components/admin/KpiStrip.tsx` (GS4-12) | `<KpiStrip label items={[{ key, label, value, note, noteTitle }]} />` (ADMIN_DESIGN 5.6): одна панель, ячейки через волосяные линии (это фон `--border` в зазорах `gap-px`), 4–6 штук. Служебная подпись, число 28px light (`tabular-nums`), одна строка изменения числом («+659 this month»), без цветных плашек процентов. С `lg` — в одну строку, ниже — сетка 2×N, нечётная последняя ячейка на обе колонки. Неизвестное — «—», не ноль. На нём Dashboard |
| «Требует внимания» | `src/components/admin/AttentionList.tsx` (GS1-2) | `<AttentionList rows={[{ key, tone, title, text, action: { label, href }, fix }]} loading />` (ADMIN_DESIGN 5.5): панель с числом в шапке (`Badge` err, если есть красное, иначе warn). Строка — точка важности, заголовок 13px medium, строка последствия, «How to fix ▾» (`fix` — строки кода для разработчика: cron, файлы миграций) и кнопка в раздел. Пусто — «All good» с галочкой. На телефоне строка — одна ссылка с шевроном, без кнопок и «How to fix» (макет `Phone · Dashboard`). Панель названа текстом (`aria-label`), не по `useId`: она в первом кадре сервера. Дашборд показывает всё; страница раздела может показать только своё вместо своих баннеров |
| Раскладка страницы | `src/components/admin/AdminPage.tsx` (GS4-5) | Своя корневая `max-w-*` у страницы запрещена: страница выбирает раскладку, и обе идут во всю ширину окна, без потолка (решение CEO 2026-10-05; до того оболочка ограничивала всё 1600px, форму — 960px). «Список» (по умолчанию, таблицы и доски) — это просто корневой `<div>`. «Форма» — `<AdminPage layout="form" nav aside>`: колонка `FormSection` (подпись 240px рядом с полями, как на макете Settings), слева меню разделов `nav` (200px, с `lg`; на телефоне его нет, разделы читаются подряд), справа `aside` (320px). Длина строки текста ограничивается у самого текста (`max-w-[80ch]` у пояснений за «?», `max-w-[48ch]` у пустого состояния), а не у страницы. `SectionNav` — меню разделов со ссылками на якоря, текущий пункт — `useScrollSpy(ids)` |
| Боковая панель | `src/components/admin/SidePanel.tsx` (GS4-5) | `<SidePanel open onClose title subtitle footer>`: выезжает справа, 480px, на телефоне во весь экран. Подробности строки (пользователь в Users) и короткие формы (правило в Retailers). Шапка с заголовком и ✕, тело прокручивается, внизу кнопки справа — Cancel ghost, главная primary; опасная — первой, `mr-auto`. `role="dialog"`, Escape и клик по затемнению закрывают, Tab не уходит наружу, фокус встаёт в первое поле и возвращается к кнопке, открывшей панель. `ConfirmDialog` и меню поверх неё обрабатывают свой Escape сами (панель слушает `window` и пропускает обработанную клавишу). Меню-поповеры (`z-95`) — над панелью (`z-90`), подтверждение — над всем. `placement="bottom"` — нижний лист телефона (GS4-11): те же части, поднимается снизу (`.ov-rise`), высота по содержимому, не больше 85% экрана, верхние углы скруглены |
| Форма | `src/components/admin/FormSection.tsx` (GS4-5) | `<FormPanel>` — одна панель `--surface` с разделителями; в ней `<FormSection id title description extra>`: слева название (15px medium) и строка «зачем» muted, справа поля. Рядом — когда секция шире 672px (контейнерный запрос `@2xl`), на телефоне друг под другом. `extra` — «?» или бейдж у названия. Абзацы-пояснения уходят в `description` и под «?» |
| Сохранение | `src/components/admin/SaveBar.tsx` (GS4-5) | `<SaveBar dirty saving onSave onDiscard disabled note />` — последней в странице: полоса `--surface` прилипает к низу экрана и видна только при несохранённых правках: «● Unsaved changes · Discard · Save». Одна на страницу вместо Save в каждом блоке; Save сохраняет всё изменённое и пишет итог тостом. Пока есть правки, закрытие и перезагрузка вкладки спрашивают подтверждение |
| Заголовок вкладки | `goo-studio/layout.tsx` и `layout.tsx` разделов (GS4-7) | «Products · GOO Admin»: раздел задаёт `metadata.title` в своём серверном `layout.tsx` (страницы клиентские и metadata экспортировать не могут), шаблон — в `goo-studio/layout.tsx`. Новый раздел заводит свой `layout.tsx` по образцу. Оболочка (`_ui/AdminShell.tsx`) ставит то же название на языке админки по пункту меню |
| Даты, деньги, числа | `src/lib/admin-format.ts` (GS4-6) | В страницах — через `const f = useFormat()` из `goo-studio/_i18n`: локаль — язык админки. `f.date(x)` — «Oct 5, 2026» / «5 окт. 2026 г.», всегда с годом; `f.dateTime(x)` — с временем; `f.when(x, never?)` — «22h ago», «yesterday» до недели, дальше дата; `f.money(n, "UAH")` — разделитель тысяч, копейки только у неровных сумм, три знака меньше десяти центов («$0.021»), знак валюты там, где его ставит язык («₴399», «399 ₴»); `f.moneyRange(min, max)` — одно значение, когда концы равны, оба конца с копейками, если они есть у одного; `f.number(n)` — «1,224» / «1 224». `toLocaleDateString` и `toFixed` для денег в админке вне этого файла не пишутся. Публичный `formatPrice` (перевод в валюту посетителя) — другое и здесь не используется |
| Настройки админки | `src/app/goo-studio/_ui/settings.ts` | `useSetting(key)` / `writeSetting(key, value)` поверх `localStorage` через `useSyncExternalStore`; так хранятся тема, порядок и свёрнутые группы меню, открытые пояснения |

`ConfirmProvider` и `ToastProvider` стоят в `layout.tsx` внутри корня с темой, поэтому диалог и тост берут тему админки.

Все компоненты из `ADMIN_DESIGN.md` §5 заведены. Подстановки словаря (`t("…", { count })`) пишут числа с разделителями языка: «1,224» / «1 224».

Разметка, которая на телефоне другая, а не просто переставлена (карточки вместо таблицы, лист фильтров), выбирается хуком `useMediaQuery("(width < 48rem)")` (`src/lib/hooks/useMediaQuery.ts`, тот же порог, что `md:`): рисуется один вид, а не два с `hidden` — иначе строки, их фото и меню удваиваются. Всё, что CSS переставляет сам, остаётся на классах `md:`.

Модалки слоями, снизу вверх: закреплённое главное действие телефона (`z-20`), панель выделения `BulkBar` (`z-30`), меню телефона (`z-50`), `SidePanel` (`z-90`), меню-поповеры (`z-95`), тост (`z-100`), `ConfirmDialog` (`z-110`).

### Языки (GS4-8)

Админка двуязычная (решение CEO Р5): английский основной, русский перевод.

- **Словари.** `src/app/goo-studio/_i18n/en.ts` — источник, американское написание (catalog, color). `ru.ts` — перевод; ключ, которого в нём ещё нет, показывается по-английски.
- **Текст интерфейса — только через `useT()`:** `const t = useT(); t("common.cancel")`, `t("users.selected", { count })`.
  - В сообщении — `{name}`-подстановки.
  - Формы числа выбирает `Intl.PluralRules`: в английском `one` / `other`, в русском `one` / `few` / `many`.
  - Данные в `NAV_ITEMS` и похожих списках хранят ключ словаря, а не текст.
- **Переключатель** — в меню аккаунта (`role="menuitemradio"`). Выбор хранится в `localStorage` под `goo-admin-lang` и меняет всю админку сразу, без перезагрузки. У корня админки стоит `lang`. `LOCALE` в `_i18n/index.ts` даёт локаль для дат и чисел (GS4-6).
- **Длина.** Русские строки на 15–30% длиннее: кнопки, чипы и вкладки не фиксируют ширину, ячейки таблиц обрезаются с подсказкой (`ADMIN_DESIGN.md` 5.14).
- **Проверка** — `npm run i18n:check` (`scripts/i18n-check.mjs`, шаг CI «Admin dictionaries»):
  - ключи `ru.ts` должны быть в `en.ts`;
  - в файлах из списка `TRANSLATED` не должно быть текста мимо словаря: JSX-текста и строк в `placeholder` / `title` / `aria-label` / `alt` / `label`;
  - остальные файлы отчёт показывает с числом строк — после GS4-12 таких нет.
- **Словарь экрана — в своём файле:** `_i18n/screens/<экран>.en.ts` и `.ru.ts`, ключи с префиксом экрана (`brands.*`, `aicheck.*`). `en.ts` и `ru.ts` подключают их через `...`; проверка видит и такие ключи. Общие ключи (`common.*`, `nav.*`, `filter.*`) остаются в `en.ts` / `ru.ts`.
- **Переведено на 2026-10-05 (GS4-12):** вся админка — оболочка, общие компоненты и все экраны; все они в списке `TRANSLATED`. Данные (названия товаров, ответы API и парсера, тексты писем) показываются как пришли.

### Статусы, баннеры и тосты — как в коде сейчас

| Что | Рецепт | Где |
|---|---|---|
| Базовая тройка | `bg-[var(--X-bg)] text-[var(--X)] border border-[var(--X-line)]`, X — `ok` / `warn` / `err` | бейдж — компонент `Badge` (`src/components/admin/Badge.tsx`); своих констант статуса в экранах нет с GS4-12 |
| Баннер | рецепт `BANNER.err` / `.warn` / `.ok` в `_ui/recipes.ts`: `rounded-xl border border-[var(--X-line)] bg-[var(--X-bg)] px-4 py-3 text-[13px] text-[var(--X)] break-words`; у баннера ошибки `role="alert"`. Место вызова добавляет только раскладку (`mb-6`, `flex`) | сбой загрузки, недостающий шаг, предупреждение импорта. Что сломано и как чинить, с числом и ссылкой, — строкой `AttentionList`, не баннером (Dashboard, Subscriptions, AI check, Duplicates). Своих констант баннера в экранах нет с GS4-12 |
| Бейдж | базовая тройка + `text-[11px] font-medium px-2 py-0.5 rounded-full`, обычный регистр | бейдж Super admin в меню аккаунта; радиусы ещё гуляют, см. раздел 11 |
| Точка состояния | `w-2 h-2 rounded-full bg-[var(--X)]` | дашборд, «System health» |
| Тост | компонент `Toast` (`useToast()`): `fixed bottom-4 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-[380px] z-[100]`, панель `--surface` с границей и тенью плавающего слоя `shadow-[0_8px_24px_rgba(0,0,0,0.12)]`, точка статуса `--ok` / `--err` / `--foreground-muted`, текст 13px `--foreground`, кнопка закрытия; `role="status"`, у ошибки `role="alert"` | `src/components/admin/Toast.tsx`; своих тостов в страницах нет с GS4-3 |

### Мобильная версия админки

С 2026-09-26 (коммит `27ada17`) админка рассчитана на телефон. По описанию коммита каждая страница и модалка проверены на ширине 375px. Граница — `md` (768px), та же, что у сайта.

- **Сайдбар ниже `md` — drawer по рецепту 5.6.**
  - Десктопный `<aside>` скрыт (`hidden md:flex`, `layout.tsx:695-696`).
  - **Бургер.** В шапке появляется кнопка `md:hidden w-10 h-10 rounded-lg` с `aria-label="Open menu"`, `aria-expanded`, `aria-controls` (`layout.tsx:749-760`).
  - **Drawer:** `md:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px] max-w-[85vw]` на `var(--surface)`, `role="dialog" aria-modal="true"`. Появляется пружиной `{ stiffness: 380, damping: 38, mass: 0.8 }` от `x: -280`. Скрим — `z-40 bg-black/60 backdrop-blur-sm` (`layout.tsx:864-906`).
  - **Поведение.** Закрывается по скриму, Escape, переходу на другую страницу и расширению окна за `md`. Блокирует прокрутку фона (`useScrollLock`, `layout.tsx:439`). Фокус уходит на кнопку закрытия и возвращается на бургер.
- **Шапка и поля страницы.** Шапка — `h-14`, `px-4 md:px-8`. `<main>` — `p-4 md:p-8` плюс `safe-area-inset-bottom` (`layout.tsx:859`).
- **Цели касания 40px.**
  - Ниже `md` у каждого `button`, `select` и текстового `input` `min-height: 40px`; у иконочной кнопки (с `aria-label`) ещё `min-width: 40px`.
  - Правило лежит в `@layer base` под `:where(.admin-theme-light, .admin-theme-dark)` (`globals.css:138-158`). Поэтому утилита на элементе его побеждает: где контрол обязан остаться маленьким — **`min-h-0`** (и `min-w-0`).
  - Сами собой исключены кнопки поверх картинки (`.absolute`) и переключатели (`[role="switch"]`).
  - Ссылки, `label` и прочие элементы правило не покрывает — им высоту дают руками: `min-h-10 md:min-h-0`.
  - Иконочная кнопка, которой на десктопе нужен свой, меньший размер, пишет оба размера явно: `w-10 h-10 md:w-auto md:h-auto`.
  - Кнопка-подпись группы меню — `min-h-8 md:min-h-0`: на телефоне 32px, чтобы восемь групп не раздували drawer.
- **Поля 16px.** Ниже `md` у `input`, `select`, `textarea` внутри админки `font-size: 16px`, иначе iOS Safari зумит страницу при фокусе и не отдаёт зум обратно. Правило стоит вне слоёв (`globals.css:160-167`), чтобы перебить размер текста на полях. Размер шрифта поля утилитой ниже `md` не задавай — он не применится.
- **Hover-only элементы** (кнопки, проявляющиеся по наведению) дополняются `[@media(hover:none)]:opacity-100`, чтобы на тач-экране они были видны всегда. Для клавиатуры — `focus-visible:opacity-100` / `focus-within:opacity-100`. Полная запись: `opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100`.
- **Таблицы на телефоне — списки карточек** (GS4-11). `DataTable` с `card` (подраздел выше): фото 56px, имя в две строки, вторичная строка, «…». Так Products, Users, Outfits, Blog, Retailers, Subscriptions, Runs в AI check; превью импорта — свой список карточек с категорией прямо в карточке. Ни один раздел на 390px не едет вбок и не прячет действия строки за прокруткой — стенд проверяет это `--overflow`.
  - Старая таблица, которую экран ещё не перевёл, прокручивается в своём контейнере: `rounded-xl border border-[var(--border)] overflow-x-auto`, второстепенные колонки — `hidden md:table-cell` / `hidden lg:table-cell`. Действия строки в ней последней колонкой недоступны без прокрутки — такой экран переводится на `DataTable`.
  - Колонка действий таблицы закреплена справа (`sticky right-0` на `--surface`, GS1-0) — только для таблицы без `card` на телефоне.
- **Шапка страницы на телефоне** — заголовок и «…»; главное действие — закреплённой кнопкой внизу (`PageHeader`).
- **Фильтры на телефоне** — поиск и «Filters · N», сами фильтры — нижним листом (`FilterBar`).
- **KPI на телефоне** — сеткой 2×N (`grid-cols-2`), не столбиком.
- **Длинные полосы вкладок** берут на телефоне короткие названия, чтобы поместиться (Parser: Collect · Parse URL · Recipes · Anti-bot); прокрутка полосы — только запас.
- **Модалки.** Панель `w-full` с отступом 16px от краёв экрана, `max-h-[90dvh]` и прокрутка внутри. На `md` высота может расти до `80–95vh`.
- **Формы и тулбары.** Сетка формы на телефоне в одну колонку (`grid-cols-1 md:grid-cols-[220px_1fr]`), тулбары переносятся (`flex flex-wrap`), тосты на телефоне во всю ширину.

### Правила для нового элемента в админке

1. **Цвет — токены.** Статусы — только `--ok` / `--warn` / `--err` и их `-bg` / `-line`. Сырых палитр Tailwind (`emerald-*`, `amber-*`, `red-*` и любых других) в админке нет и не появляется.
2. **Глубина.** Холст — `--background`, всё, что лежит на нём как панель, — `--surface` + `border border-[var(--border)]`. Наведение на холсте — `--fg-overlay-05`, а не `--surface` или `--background`: на своём же фоне наведения не видно.
3. **Регистр.** Капс только у шапки таблицы, подписи KPI и группы меню, по рецепту служебной подписи. Ничего меньше 11px.
4. **Таблица — `DataTable`** (подраздел выше), с `card` для телефона. Своя `<table>` в новом экране не пишется. Пока экран не переведён, старая таблица держит тот же рецепт:
   - Обёртка `rounded-xl border border-[var(--border)] overflow-x-auto` на `--surface`.
   - Строка шапки — `border-b border-[var(--border)]`.
   - Ячейки шапки — `text-left px-4 py-3 text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] font-normal` (`subscriptions/page.tsx:104`).
   - Числа — справа (`text-right`).
5. **Инпут и подпись** — `INPUT`, `SELECT` и `FIELD_LABEL` из `_ui/recipes.ts`.
   - `INPUT`: `rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors bg-transparent`.
   - `SELECT` — то же, но с фоном панели `bg-[var(--surface)]`, иначе сквозь него видна системная выпадашка. Две заливки на одном элементе не ставить: см. урок ниже.
   - `FIELD_LABEL` — `block text-[12px] font-medium text-[var(--foreground-muted)] mb-1.5`.
6. **Кнопки — только рецепты `_ui/recipes.ts`** (подраздел «Общие компоненты и рецепты» выше): `btn("primary")`, `btn("secondary")`, `btn("ghost")`, `btn("danger")`, `BTN_ICON`; в строке таблицы — размер `sm`.
   - Одна заливная кнопка на экран или блок. Действия в строках — `secondary` или `ghost`, не заливные (Audit, AI check, Duplicates).
   - Поверх рецепта на месте вызова добавляется только раскладка (`flex-1`, `ml-auto`, `shrink-0`, `self-start`). Своя высота, отступы, размер текста или цвет поверх рецепта — нарушение правила 18.
   - Новый общий примитив кнопки не заводить (`CLAUDE.md`).
7. **Подтверждение — только `useConfirm()`**, тост — только `useToast()`. `confirm()`, `alert()` и `prompt()` браузера в админке не используются: системные окна не берут тему, не называют действие на кнопке и не дают фокус-ловушку.
8. **Пояснение длиннее одного предложения — за «?»** (`HelpToggle`). Короткая подсказка к одному полю остаётся под полем.
9. **Фильтр-пилюля:** компонент `FilterChips` (`FilterBar.tsx`), `aria-pressed`; ниже — его рецепт.
   - Активная — `bg-[var(--foreground)] text-[var(--surface)] border-[var(--foreground)]`.
   - Неактивная — `border-[var(--border)] text-[var(--foreground-muted)]`.
10. **Переключатель:** `button role="switch" aria-checked`, дорожка `w-9 h-5 rounded-full`, бегунок `w-4 h-4 rounded-full bg-[var(--surface)]` (`Toggle` в `parser/page.tsx`).
    - Включён — дорожка `bg-[var(--foreground)]`.
    - Выключен — `bg-[var(--border-strong)]`. С `--border` выключенный переключатель на белой панели был не виден (GS1-0).
11. **Заголовок страницы:** `font-display text-2xl font-light text-[var(--foreground)]` + подзаголовок muted.
12. **Карточка:** `rounded-xl border border-[var(--border)] p-4 md:p-5` на `--surface` (`analytics/page.tsx:59`). Без тени и без декоративных цветных полос: глубина передаётся границей.
13. **Иконки** — инлайновый SVG, 12–16px, `strokeWidth` 1.2–1.5 (1.2 — в 119 из 172 атрибутов). По `ADMIN_DESIGN.md` 4.5 в меню и кнопках действий целевое значение — 1.5.
14. **Модалка — `Modal`** (`src/components/admin/Modal.tsx`, GS4-9). Для «да / нет» — `ConfirmDialog`, для подробностей строки и короткой формы — `SidePanel`; `Modal` — для редактора, выбора из списка, черновика AI.
    - `{open && <Modal onClose label panelClassName closeOnScrim>…</Modal>}`: скрим `bg-black/60` с `p-4` и вход `.ov-scrim`/`.ov-panel` — в компоненте; панель — `rounded-2xl w-full max-w-* max-h-[90dvh]` в `panelClassName`, граница и `--surface` тоже в компоненте.
    - `role="dialog"`, `aria-modal`, название (`label` или `labelledBy`) — обязательны.
    - Escape закрывает, Tab не выходит наружу, фокус в первом видимом поле и обратно к кнопке, открывшей модалку (`useDialog`, общий с `SidePanel`).
    - Клик по затемнению закрывает, кроме редакторов (`closeOnScrim={false}`): там случайный клик выбросил бы форму. Escape в редакторе — как Cancel.
15. **Пустое и загрузочное состояние таблицы** — центрированный текст `px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]`, не скелетон. Исключение — карточки с числами на дашборде и в аналитике: там пульсирующая плашка `animate-pulse`.
16. **Мобильные правила выше соблюдены:**
    - контрол не меньше 40px (или осознанный `min-h-0`);
    - поле без своего размера шрифта ниже `md`;
    - hover-only элемент с `[@media(hover:none)]:opacity-100`;
    - таблица в `overflow-x-auto`;
    - модалка `w-full` + `max-h-[90dvh]`.
17. **Не использовать `dark:`-варианты Tailwind.** В проекте `dark:` срабатывает по системной теме ОС (раздел 8), а не по теме админки — это рассинхрон. Тема админки выражается только токенами.
18. **Одна утилита на свойство.** На одном элементе не должно быть двух утилит одного свойства: двух размеров текста, двух заливок, `w-full` и фиксированной ширины, `px-3` и `px-2`. Победит та, что позже в собранном CSS, а не та, что правее в строке.
    - Так в GS1-0 поле цены схлопнулось до нуля и спрятало цену магазина.
    - Если рецепт-константу нужно расширить на месте вызова, разбей её на базу и варианты (`selectBaseCls` в `products/page.tsx`, `fieldBase` в `blog/page.tsx`).

**Как проверить.** Стенд `scripts/admin-screens` снимает все разделы в двух темах и на двух экранах. Флаг `--axe` вместо снимков проверяет контраст на каждой странице. На 2026-10-05: 21 раздел и 14 состояний (редакторы, drawer, модалки) в обеих темах — 0 нарушений контраста. Muted-текст на `--fg-overlay-08` и на заливке `--err-bg` не проходит 4,5:1. Поэтому выбранная строка — `--fg-overlay-05`, а карточка с ошибкой — панель с красной рамкой, а не красной заливкой (`subscriptions/page.tsx`, `HealthCard`).

---

## 10. Чеклист для нового элемента

1. Цвет написан только как `bg-[var(--…)]` / `text-[var(--…)]` / `border-[var(--…)]`. Ни одного hex, rgba или `text-gray-*` — кроме `bg-white` под фото товара и `bg-black/NN` для контрола поверх фото.
2. Прозрачность взята из `--bg-overlay-*` / `--fg-overlay-*` / `--fg-on-dark-*`, а не как модификатор `/70` на переменной.
3. Элемент открыт **в обеих темах**. Ничего не пропало, ничего не инвертировалось.
4. Радиус лежит на шкале: `rounded-lg` / `rounded-xl` / `rounded-2xl` / `rounded-full`. Не `rounded-md`, не `rounded-[10px]`.
5. Поверхность — `bg-[var(--surface)] border border-[var(--border)]`, глубина границей, не тенью.
6. Размер текста — bracket-px по шкале раздела 2; ничего меньше 10px. В админке — ничего меньше 11px (раздел 9).
7. Uppercase-подпись — `tracking-[0.18em]` (или `0.14em` для навигации/CTA). Новых значений tracking не введено. В админке капс только у служебной подписи (шапка таблицы, подпись KPI, группа меню), `text-[11px] tracking-[0.12em]`; кнопки, чипы и бейджи — обычным регистром (раздел 9).
8. Контейнер — `max-w-[1440px] mx-auto px-6 md:px-12` (или `max-w-[1280px]` на главной), с шагом `md:` для паддинга.
9. Кнопка собрана из одного из четырёх рецептов 5.3 (в админке — из рецептов раздела 9), а не из нового общего примитива со своими вариантами (раздел 6).
10. Карточка товара/образа — импортирован `ProductCard` / `OutfitCard`, а не переписана разметка.
11. Анимация — либо spring `{ type:'spring', bounce:0.2, duration:0.8 }` (карточки), либо `FadeInView` (секции), в framer easing `[0.25,0.46,0.45,0.94]`. В CSS кривая и длительность берутся токенами `var(--ease-out)` / `var(--ease-in-out)` и `var(--dur-*)`, а не литералами. Длительность из набора 150/200/300/500 (в CSS — токены `--dur-*`, раздел 7). Появление и уход хромы — через `.ov-*` + `useOverlayPresence` (раздел 7).
12. Непрерывная анимация имеет собственную проверку `prefers-reduced-motion`.
13. Интерактивный элемент имеет `aria-label` / `aria-expanded` / `aria-pressed` там, где смысл не читается из текста; модальный слой — `role="dialog" aria-modal="true"`.
14. Если поставил `outline-none` — рядом стоит видимая замена фокуса: `outline-none` отключает общее кольцо `:focus-visible` (раздел 5.12). Если замены нет — не ставь `outline-none`.
15. Ничего не восстановлено и не скопировано из мёртвого кода с конкурирующим языком. Эти файлы удалены 2026-09-27 по код-ревью 2026-09 (коммит `7898c3f`) и в истории git остаются только как пример того, чего не делать: `src/components/ui/button.tsx`, `src/components/blocks/hero-section-1.tsx`, `src/components/ui/animated-group.tsx`, `src/components/ui/parallax-floating.tsx`, `HeroBackground.tsx`, `SectionLabel.tsx`, `ProductGallery.tsx`, `ProductReviews.tsx`, `PriceHistoryChart.tsx`, `OutfitCarousel.tsx`, `FeaturesBento.tsx`, `HowItWorksGrid.tsx`, `AIStylistChat.tsx`, `HeroProductCycle.tsx`, `src/app/coming-soon/` (с `FeatureCarousel.tsx`), `src/app/goo-studio/image-tools/`.
16. Элемент админки открыт на ширине 375px и прошёл мобильные правила раздела 9 (цель касания 40px, поле без своего размера шрифта ниже `md`, hover-only элемент виден на тач-экране, таблица прокручивается в своём контейнере, модалка помещается в экран) и проверен в обеих темах админки, в том числе светлая админка при тёмной теме сайта.
17. Элемент публичного сайта на телефоне (ниже `md`) собран по разделу 12 и снят на стенде `scripts/site-screens` на 390 и 360 px в обеих темах; десктоп 1440 при этом не изменился.

---

## 11. Найденные расхождения

**Это наблюдения, а не наряд на работу.** Открытые строки требуют отдельной задачи, приоритизации и проверки — самовольно чинить их по этому списку нельзя, решение за CEO. Исправленные строки оставлены для истории.

Список составлен по аудиту 2026-08-07 и сверен с кодом 2026-09-26. Колонка «Статус»:

- **✓ исправлено (ревью 2026-09)** — исправлено коммитами код-ревью 2026-09-26 (`docs/CODE_REVIEW_2026-09.md`).
- **✓ исправлено (UX-правка 2026-09-12)** — исправлено коммитами `fea1b2f` / `ca206c4` по `docs/UX_REVIEW_2026-09.md`.
- **✓ исправлено (до 2026-09)** — уже было исправлено к моменту, когда этот файл попал в репозиторий (2026-08-20).
- **◐ частично** — часть строки исправлена, остаток описан.
- **актуально** — расхождение в коде есть. У таких строк в первой колонке уже **текущие** номера строк (2026-09-26); у исправленных и удалённых — исходные, для истории.
- **✓ исправлено (GS4-1, 2026-10-05)** — исправлено основой редизайна админки (`docs/ADMIN_ROADMAP.md`, этап 4): глубина, статусные токены, один уровень капса, пол 11px.
- **✓ исправлено (GS4-3, 2026-10-05)** — исправлено общими компонентами и рецептами админки.
- **✓ файл удалён (ревью 2026-09)** — файл был мёртв (его никто не импортировал; страницы `/coming-soon` и `goo-studio/image-tools` были недостижимы из интерфейса) и удалён 2026-09-27 с разрешения CEO (коммит `7898c3f`). Строка оставлена для истории.

Сортировка внутри таблиц: high → medium → low.

### High

| Файл:строка | Что не так | Чем заменить | Статус |
|---|---|---|---|
| `src/components/home/AIStylistShowcase.tsx:547` | Ниже `lg` карточка `bg-transparent border-0`, но Intro внутри безусловно белый (`text-white`, `white/40`, `white/55`, тайлы `border-white/10 bg-white/[0.03]`) — на телефоне в светлой теме весь блок белым по `#F4F2EE`, практически невидим | Оставить тёмную подложку на всех ширинах (`bg-[#0A0A0A] border border-white/10`) либо сделать типографику Intro тематической | ✓ исправлено (UX-правка 2026-09-12): тёмная подложка на всех ширинах → на телефоне (мобильный трек R-21, 2026-10-07): ниже `md` блок без тёмной подложки, вся типографика и плашки — на токенах темы (второй путь из колонки рекомендации). От `md` тёмная подложка прежняя |
| `src/components/ui/etheral-shadow.tsx:42` (и `:67`) | Блобы `rgba(0,0,0,0.14)` и зерно `rgba(0,0,0,0.045)` без ветки темы, а компонент смонтирован на `bg-[var(--background)]` (`HeroSection.tsx:19,23`), который по умолчанию `#0A0A0A` — чёрное по чёрному, при этом анимации крутятся | Цвет блоба и зерна из токенов: `var(--fg-overlay-08)` / `var(--fg-overlay-05)` | ✓ исправлено (UX-правка 2026-09-12): `etheral-shadow.tsx:42,66` на токенах |
| `src/components/outfit/OutfitCarousel.tsx:107` | CTA «VIEW OUTFIT» вне фото собран из `border-white/30 text-white/60 bg-black/60`; в светлой теме — тёмная пилюля с контрастом ~2.5:1 на кремовом фоне | `border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]` | ✓ исправлено (UX-правка 2026-09-12); затем ✓ файл удалён (ревью 2026-09) |
| `src/app/builder/page.tsx:2710` | Primary «Show results» в мобильном фильтр-листе — `bg-white text-black`; в светлой теме белая кнопка на почти белом фоне | `bg-[var(--foreground)] text-[var(--background)] hover:opacity-90` | ✓ исправлено (UX-правка 2026-09-12): `builder/page.tsx:2769` |
| `src/app/browse/page.tsx:656` (и `:670`) | Кольцо невыбранного чекбокса категории — `rgba(255,255,255,0.2)`; в светлой теме на `#F4F2EE` невидимо | `borderColor: checked ? "var(--foreground)" : "var(--border-strong)"` | ✓ исправлено (UX-правка 2026-09-12) |
| `src/components/product/ProductReviews.tsx:199` + системно | `outline-none` без замены; во всём `src/` ни одного рабочего `:focus-visible`; клавиатурная навигация по PDP, browse, builder не индицируется | Глобальное правило в `globals.css`: `:focus-visible { outline: 2px solid var(--border-strong); outline-offset: 2px; }` | ✓ исправлено (UX-правка 2026-09-12): правило `globals.css:216-220`. `ProductReviews.tsx` снят со страницы товара при ревью 2026-09 — ✓ файл удалён (ревью 2026-09) |
| `src/app/goo-studio/layout.tsx:231` | Админка переопределяет тёмную тему инлайновым объектом из семи хексов вместо класса, теряя `--fg-overlay-*`, `--bg-overlay-*`, `--fg-on-dark-*` | Переключать класс на корне админки, чтобы применялся весь набор токенов | ✓ исправлено (ревью 2026-09): классы `.admin-theme-light` / `.admin-theme-dark` и токены в `globals.css:43-82`, раздел 9 |
| `src/app/goo-studio/products/page.tsx:1390` (также `:587,592,1658,2359,2627-2628`) | `dark:`-варианты внутри админки не следуют теме админки — баннеры рендерят тёмное оформление в светлом хроме и не реагируют на переключатель | Рецепт админки без `dark:`: `bg-amber-400/15 text-amber-500 border border-amber-400/30` | ✓ исправлено (ревью 2026-09): `dark:` в админке ноль |
| `src/app/goo-studio/analytics/Charts.tsx:256` | Ссылка на `--foreground-rgb`, которой нет нигде в репозитории; все столбцы воронки кроме первого рисуются чёрным | `background: "var(--foreground)"` + убывающая `opacity` на элементе | ✓ исправлено (UX-правка 2026-09-12): `Charts.tsx:270-271` |
| `src/app/goo-studio/analytics/Charts.tsx:26` | Палитра recharts — пять сырых хексов серого (`#6b7280…#1f2937`), не реагируют на тему | Рампа из токенов: `color-mix(in srgb, var(--foreground) N%, var(--surface))` | ✓ исправлено (ревью 2026-09): `Charts.tsx:28-35` |

### Medium

| Файл:строка | Что не так | Чем заменить | Статус |
|---|---|---|---|
| `src/components/layout/Navigation.tsx:100-107` | Хедер строит параллельную палитру из хекс/rgba-констант в JS вместо токенов (плюс инлайновые rgba в `:216`, `:230-256`, `:276-277`, `:321-322`, `:366-367`); светлое значение `#ffffff` соответствует `--surface`, а не `--background` (`#F4F2EE`) | Токены, как в `MobileBottomNav.tsx:91,111` | актуально |
| `src/components/layout/Navigation.tsx:112` | Полный токенный путь стилей (`headerBg`, `logoColor`, `linkActive`, `linkMuted`, `iconColor`) объявлен и нигде не используется; scroll-listener не даёт визуального эффекта | Подключить переменные к `<header>` либо удалить их вместе со `scrolled`, `showWhiteText` и слушателем | ✓ исправлено (ревью 2026-09): удалено |
| `src/components/layout/ConditionalSiteLayout.tsx:63` (и `:77`) | Зазор под нижнюю навигацию задан дважды — на `<main>` и на обёртке футера; на мобильном добавляет ~72px пустоты перед футером | Оставить только на последнем элементе потока | актуально → ✓ исправлено (мобильный трек R-05, 2026-10-06): зазор только на обёртке футера, `pb-[calc(env(safe-area-inset-bottom)+68px)] md:pb-0` |
| `src/components/layout/Footer.tsx:89` (и мобильный `:38`) | Вордмарк в футере — Inter Tight `font-black tracking-[0.2em]`, в хедере — Poppins 800 / 22px / `tracking-[0.18em]` (`Navigation.tsx:171`) | Общий `<Wordmark>` по рецепту хедера | актуально |
| `src/app/page.tsx:42` | `.label` не применён нигде, каждый eyebrow объявляет свои значения; здесь — `text-[11px] tracking-[0.22em]` | Привести `.label` к реальному намерению и применить, либо стандартизовать строку | актуально |
| `src/app/globals.css:339` | `.label` мёртв; цвет утилиты (`--foreground-muted`) расходится с фактическим использованием (больше eyebrow на `--foreground-subtle`) | Сначала решить вопрос цвета, потом либо принять утилиту, либо удалить | актуально; `SectionLabel.tsx` — ✓ файл удалён (ревью 2026-09) |
| `src/components/home/AIStylistShowcase.tsx:22` | Копия fade-обёртки (`FadeInView` y=20/0.45, здесь y=28/0.5; третья копия была в мёртвом `FeaturesBento.tsx:22`, удалён 2026-09-27) | Импортировать `FadeInView`, удалить локальные `FadeCard` | актуально → ✓ исправлено (мобильный трек R-21, 2026-10-07): локальный `FadeCard` удалён, все места на `FadeInView` с `y={28}`; длительность стала общей — 0,45 с вместо 0,5 |
| `src/app/browse/page.tsx:1332` (и `:1352`) | Обёртка грида повторяет анимацию, которую карточка уже играет сама (`ProductCard.tsx:81-84`) — два независимых определения на одно появление | Оставить каскад на родителе, анимацию — на карточке | актуально |
| `src/app/browse/page.tsx:944` | Модальный drawer без `role="dialog"`, `aria-modal`, `aria-label`; во всём файле ноль `aria-` | `role="dialog" aria-modal="true" aria-label="Filters"` + `aria-expanded` на заголовках фасетов | актуально → на телефоне ✓ (мобильный трек R-09, 2026-10-06): фильтры — лист снизу с `role="dialog"`, `aria-modal`, заголовком через `aria-labelledby`, фокус на «Close», у групп категорий `aria-expanded`. Десктопный drawer не тронут: мобильный трек десктоп не меняет |
| `src/app/browse/page.tsx:612` (также `529,541,560,697,730,771,836,948`) | Девять заголовков фасетов с инлайновым `textShadow: 0 0 14px rgba(255,255,255,0.4)` — эффект только для тёмной темы | Убрать `textShadow` либо завести тематический токен | актуально → на телефоне ✓ (R-09): в листе заголовки групп — `text-[13px] --foreground-muted` обычным регистром, без свечения. В десктопном drawer свечение остаётся |
| `src/app/builder/page.tsx:908` (также `873,897,994,1028,1068,1138,2492`) | То же самое, восемь заголовков в фильтр-панели билдера | Обычный eyebrow-рецепт без тени | актуально → на телефоне ✓ (мобильный трек R-15, 2026-10-07): лист фильтров конструктора без свечения, заголовки групп — 13 px `--foreground-muted`. Восемь заголовков десктопной панели остаются: десктоп этот трек не меняет |
| `src/app/browse/page.tsx:566` (также `582,593,624,645-647,662,676,714,758,805,815,821,846`) | Приглушённый текст = `text-[var(--foreground)]` + разные шаги `opacity` (40/50/55/60) вместо `--foreground-muted`, который в этом же файле используется 17 раз | Одна пара: `--foreground` / `--foreground-muted` | актуально |
| `src/app/browse/page.tsx:92` | Три несовместимых рецепта чипа на одном экране (9px/`--foreground` в `ActiveChip`, 10-11px/`--border`, 12px/`--border-strong`) | Один масштаб чипа, `--border-strong` в покое | актуально → на телефоне ✓ (R-09): один чип §12.10 — в листе `h-9`, снимаемый над сеткой `h-8`, оба 13 px на `--fg-overlay-08`. На десктопе три рецепта остаются |
| `src/components/product/PriceHistoryChart.tsx:167` (и `:199`) | Ось Y и метки хардкодят `$`, тултип использует `formatPrice` | `{formatPrice(tick)}` | ✓ файл удалён (ревью 2026-09): фейковый график снят со страницы товара, затем файл удалён |
| `src/components/product/ProductClient.tsx:248` | Eyebrow в одном файле написан вручную много раз с разными tracking: `0.2em` здесь, рядом `0.12`/`0.14`/`0.16`/`0.18em` | Один рецепт eyebrow | актуально → на телефоне ✓ (мобильный трек R-12, 2026-10-06): надзаголовки страницы товара по одному правилу §12.13 — `text-[13px] --foreground-muted` обычным регистром. На десктопе разные tracking остаются: мобильный трек десктоп не меняет |
| `src/components/outfit/OutfitCard.tsx:40` (и `:44`) | `rounded-2xl` + tween 0.35s против канона `rounded-xl` + spring с блюром (`ProductCard.tsx:80-84`); карточки стоят в одних сетках | Привести к рецепту `ProductCard` | актуально → на телефоне ✓ (мобильный трек R-06, R-07, 2026-10-06): обе карточки — плашка `rounded-2xl` без рамки по §12.2. На десктопе расхождение радиуса и анимации остаётся: мобильный трек десктоп не меняет |
| `src/components/look/MyLooksPanel.tsx:618` (также `:1107`, `builder/page.tsx:2035`, `:2314`, `saved/page.tsx:59`) | Алгоритм коллажа переписан несколько раз вместо `OutfitCollage`; копии разошлись, один и тот же образ рисуется по-разному (`saved/page.tsx:59` — упрощённая сетка 2×2 на 4 вещи) | Один параметризованный `OutfitCollage` | актуально; копии из `saved/page.tsx:455,861` переехали в `MyLooksPanel.tsx` |
| `src/app/saved/page.tsx:68` (также `MyLooksPanel.tsx:716`, `:1037`) | Оверлей-бейдж написан тремя способами: токен (`OutfitCard.tsx:68`), `bg-black/55 text-white` 8px `rounded-md` (здесь), `bg-black/60 … text-white` (`outfit/[id]/page.tsx:116`) | `bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)]` | актуально → на телефоне ✓ (мобильный трек R-18, 2026-10-07): все бейджи на фото — светлая пилюля §12.6 (`bg-white/80 text-black`, 11 px): «Outfit» в лайках, «Flat lay»/«On You»/«AI» на карточке и в просмотре «моего образа» (R-15), бейдж AI на странице образа (R-13). Десктоп по-прежнему тремя способами |
| `src/app/saved/page.tsx:224` | Два соседних сегментированных контрола расходятся по типографике: `text-xs tracking-[0.12em]` против `text-[10px] tracking-[0.16em]` (`profile/page.tsx:217`) | Одна шкала подписи | актуально → на телефоне ✓: вкладки «Лайков» (R-18) и профиля (R-19) — сегменты §12.10, 14 px обычным регистром. Десктоп не тронут |
| `src/app/builder/page.tsx:2247` (также `2448,2859,2898`) | Внесистемное золото `#c9a84c` как акцент подтверждения выбора; в остальном коде выбранное состояние — `var(--foreground)` | `bg-[var(--foreground)]` с обводкой `var(--background)` | ✓ исправлено (мобильный трек R-15, 2026-10-07): в листе цвета конструктора галочка — `bg-[var(--foreground)]`, рамка выбранного — кольцо `--surface`/`--foreground`. Лист «Look saved», где золото было ещё раз, удалён: он нигде не открывался |
| `src/components/look/StylePicker.tsx:180` (также `:190,225,233,256`) | Шаг try-on сбрасывает шкалу радиусов — прямоугольные миниатюра «On You», бейдж New, превью фото, зона загрузки и кнопка генерации внутри `rounded-2xl`-модалки; подписи там `font-mono` 7–8px (`:120,128,150,169,190,192,200,241`), ниже пола шкалы | `h-11 rounded-xl` для primary, `rounded-lg/xl` для превью и бейджей | актуально; шаг переехал из `builder/page.tsx:3051` в `StylePicker.tsx` → на телефоне ✓ (R-15): выбор стиля — лист снизу, подписи 12–15 px обычным регистром, превью и зона загрузки `rounded-2xl`. Десктопное окно не тронуто |
| `src/app/builder/page.tsx:2933` | Тост ошибки: `text-red-600` на `border-red-300`, без радиуса и без тёмной темы | Домовый рецепт ошибки (на публичном сайте его пока нет, раздел 5.12) | актуально |
| `src/components/outfit/OutfitActions.tsx:62` | Primary-кнопка существует в нескольких несовместимых формах: здесь `rounded-full px-8 py-4`, в карточках `rounded-xl h-11` (`MyLooksPanel.tsx:762`, `CartPanel.tsx:327`, `AuthForm.tsx:125`) | Один рецепт плюс, при необходимости, задокументированная компактная пара | актуально |
| `src/app/plans/page.tsx:196` | Карточка тарифа залита `bg-[var(--background)]` — цветом страницы под ней, при этом шапка таблицы на этой же странице использует `--surface` | `bg-[var(--surface)]` | актуально → на телефоне ✓ (мобильный трек R-20, 2026-10-07): карточки тарифов — плашки `--surface`, выбранный тариф — кольцо `--foreground`. Десктоп прежний |
| `src/app/subscribe/page.tsx:267` | Радиус меняется посреди воронки: блок сводки и кнопки прямоугольные | `rounded-2xl` контейнер, `rounded-xl` кнопки | ✓ исправлено (до 2026-09) |
| `src/app/subscribe/page.tsx:296` | Ошибка оплаты: `text-red-500` на `border-red-300`, без тёмной темы, вразрез с `report/page.tsx:351` | Единый токенизированный рецепт ошибки | ◐ частично: радиус `rounded-xl` есть (был уже к 2026-08-20), цвета прежние |
| `src/components/upgrade/UpgradeModal.tsx:49` | Модалка без `backdrop-blur`, без анимации появления и без кнопки закрытия | `backdrop-blur-sm` + анимация и крестик | ✓ исправлено (UX-правка 2026-09-12): `.ov-scrim` / `.ov-panel`, крестик, Escape, `role="dialog"` (`UpgradeModal.tsx:76-97`) |
| `src/app/report/page.tsx:306` | Подпись «max 10MB», при этом `processFile` отклоняет всё больше 3.5MB (`:63-64`) | «optional · max 3.5MB» | актуально |
| `src/app/not-found.tsx:15` (и `error.tsx:28`) | `var(--muted-foreground)` не определена нигде — всегда срабатывал литерал `rgba(128,128,128,0.9)` | `text-[var(--foreground-muted)]` | ✓ исправлено (UX-правка 2026-09-12). Рядом появилось новое расхождение — модификатор `/20` на переменной, см. «Новые расхождения» |
| `src/components/ui/button.tsx:8` / `:42` | Мёртвый примитив: единственный импортёр — `blocks/hero-section-1.tsx:6`, который сам никем не импортируется | Удалить вместе с `hero-section-1.tsx` либо перекроить варианты под реальные рецепты и внедрить | ✓ файл удалён (ревью 2026-09) вместе с `hero-section-1.tsx` (раздел 6) |
| `src/components/blocks/hero-section-1.tsx:30` / `:84` | Мёртвый шаблонный файл: экспортирует имя `HeroSection`, конфликтующее с живым; единственный носитель shadcn-классов, сырой палитры `zinc`, градиента `#9B99FE→#2BC8B7`, `<img>` на внешние CDN | Удалить | ✓ файл удалён (ревью 2026-09) |
| `src/app/blog/[slug]/page.tsx:99` | Чип категории на странице поста без `rounded-full` | Добавить `rounded-full` | ✓ исправлено (до 2026-09): `blog/[slug]/page.tsx:117` |
| `src/app/blog/[slug]/page.tsx:165` | Карточки постов на странице поста — `gap-px` hairline без границ и радиуса | Привести к рецепту листинга | ✓ исправлено (до 2026-09): `gap-4` + `rounded-xl border` (`:183-193`, `:220-225`) |
| `src/app/goo-studio/analytics/page.tsx:219` (и др.) | Внутри одного файла карточки одной семантики то `rounded-xl`, то без радиуса | `rounded-xl border border-[var(--border)]` | ✓ исправлено (ревью 2026-09) |
| `src/app/goo-studio/users/page.tsx:152` | Три формы одного сегментированного фильтра в админке | Один рецепт пилюли (`products/page.tsx:1947`) | ◐ частично (ревью 2026-09): analytics и activity взяли рецепт products (`analytics/page.tsx:23-27`); users — `rounded-full`, но другой размер (9px, `tracking-[0.14em]`, `px-3 py-2.5`). GS4-1 (2026-10-05) свёл размер текста к 12px без трекинга. ✓ исправлено (GS4-4, 2026-10-05): тариф в Users — `FilterChips` с числами, статус — `FilterMenu`; своих пилюль в users больше нет |
| `src/app/goo-studio/settings/page.tsx:428` (и `:403`) | Единственная страница админки, не использующая рецепт H1 | `font-display text-2xl font-light` | ✓ исправлено (ревью 2026-09): H1 по рецепту на всех 20 страницах |
| `src/app/goo-studio/settings/page.tsx:512` (также `ImageCropEditor.tsx:308,315`) | Primary-кнопка админки без радиуса | Добавить `rounded-lg` | ✓ исправлено (ревью 2026-09): `PRIMARY_BTN` в `settings/recipes.tsx:4-5`, `ImageCropEditor.tsx:332,339` |
| `src/app/goo-studio/settings/page.tsx:517` (и др.) | Успех выражен шкалой `green-*`, остальная админка — `emerald-*` | `emerald-*` | ✓ исправлено (ревью 2026-09): `green-*` в админке ноль |
| `src/app/goo-studio/settings/page.tsx:844` (и др.) | Инпут написан вручную: потерян `rounded-lg`, `bg-[var(--surface)]`, `text-[12px]` | Общий рецепт инпута админки | ✓ исправлено (ревью 2026-09): `INPUT` в `settings/recipes.tsx:8-9` |
| `src/app/goo-studio/users/page.tsx:101` | В админке нет ни одного focus-стиля | Токенный ring в общие рецепты | ✓ исправлено (UX-правка 2026-09-12): общее кольцо `:focus-visible` действует и в админке; поля по-прежнему фокусируются сменой границы (`outline-none` + `focus:border-[var(--foreground)]`) |

### Low

| Файл:строка | Что не так | Чем заменить | Статус |
|---|---|---|---|
| `src/components/layout/Navigation.tsx:451` | Sign up — единственная интерактивная поверхность в хроме без радиуса | Добавить `rounded-full` | ✓ исправлено (до 2026-09): `Navigation.tsx:497,546` |
| `src/components/layout/Navigation.tsx:558` (и `:623`) | Три рецепта скрима: `bg-black/20`, инлайновый `rgba(0,0,0,0.45)`+blur, `bg-black/40` в `StylistDrawer.tsx:667` | Один токенизированный скрим | актуально; на телефоне скримы стилиста (R-16) и корзины (R-17) — `bg-black/60 backdrop-blur-sm` по §12.7 |
| `src/components/layout/Navigation.tsx:631` (и `:648,661`) | Кнопки модалки выхода собраны из инлайновых свойств, `borderRadius: 10`; оболочка `borderRadius: 20` против `rounded-2xl` у соседних панелей | `rounded-xl` кнопки, `rounded-2xl` оболочка | актуально |
| `src/components/layout/Navigation.tsx:435` | `z-[60]` совпадает со слоем `StylistDrawer.tsx:653-654` при отсутствии шкалы z-index | Именованная лестница в `globals.css` | актуально |
| `src/components/layout/Footer.tsx:60` | Ссылки мобильного дерева реагируют только на `active:`, десктопного — на `hover:` | Добавить `hover:` | актуально |
| `src/components/layout/Footer.tsx:112` | Именованная шкала размеров (`text-xs/sm/2xl/3xl`, `:38,89,93,112`) вперемешку с bracket-px в том же файле (`:52,73,104`) | Одна форма записи на файл | актуально |
| `src/components/home/AIStylistShowcase.tsx:20` | Канонический easing продублирован как локальный `const EASE` в нескольких файлах и инлайном | Один экспорт `EASE_STANDARD` | ◐ частично (UX-правка 2026-09-12): в CSS кривые стали токенами `--ease-*`; в JS `const EASE` остался (`AIStylistShowcase.tsx:20`, `OutfitExamplesCarousel.tsx:8`) плюс инлайн ещё в ~13 местах (раздел 7); `const EASE` в `AIStylistShowcase.tsx` ушёл вместе с `FadeCard` (R-21), в JS остался `OutfitExamplesCarousel.tsx:8` |
| `src/components/home/AIStylistShowcase.tsx:97` (и `:495,507`) | Два tracking для eyebrow в одном компоненте: `0.22em` здесь против `0.18em` | Одно значение | актуально |
| `src/components/home/AIStylistShowcase.tsx:590` | Контейнер `px-6` без шага `md:px-12`, в отличие от всех соседних секций | `px-6 md:px-12` | актуально |
| `src/components/home/HowItWorksSection.tsx:224` | Рецепт H2 скопирован вместо `SectionH2`, базовый шаг 26px вместо 30px (цвет `text-white` здесь корректен — секция на `#050505`) | Экспортировать `SectionH2` с вариантом `onDark` | актуально |
| `src/components/home/HowItWorksSection.tsx:36` (и `:40`) | Комментарий утверждает идентичность с кнопкой лайка карточки, но размер `w-8 h-8 bg-black/85` против `w-9 h-9 md:w-7 md:h-7 bg-black/80` (`ProductCard.tsx:161`) | Совместить размер или убрать утверждение из комментария | актуально |
| `src/components/home/FeaturesBento.tsx:236` (и `:354`) | Единый CTA «в билдер» в трёх радиусах и двух весах | Один радиус кнопки | ✓ файл удалён (ревью 2026-09) |
| `src/components/home/FeaturesBento.tsx:203` | Четыре геометрии точек-пейджера | Один `<Dots>` с `tone` | ✓ файл удалён (ревью 2026-09) |
| `src/components/home/FeaturesBento.tsx:57` / `:249` | `FeaturesBento`, `HowItWorksGrid`, `AIStylistChat`, `HeroProductCycle` — мёртвый код с конкурирующим языком | Удалить | ✓ файл удалён (ревью 2026-09) (все четыре файла) |
| `src/app/browse/page.tsx:1311` (и `:1299`) | Скелетон инвертирует поверхности карточки: оболочка `--background`, блоки `--surface`, тогда как загруженная карточка — `--surface` | Оболочка `--surface`, блоки `--fg-overlay-05` | актуально |
| `src/app/browse/page.tsx:1331` | Обёртка `rounded-xl` вокруг `rounded-2xl` `OutfitCard` — hover-тень обрезается по меньшему радиусу | Снять радиус/фон с обёртки | актуально |
| `src/app/browse/page.tsx:1409` | Активная страница пагинации `rounded-lg`, тогда как все прочие выбранные контролы — `rounded-full` пилюли | `rounded-full` | актуально |
| `src/app/browse/page.tsx:893` (и `:1368`) | Две outline-кнопки одного класса разного масштаба и радиуса: «Clear filters» `rounded-lg py-2` 10px bold против «Show more» `rounded-full px-6 py-3 text-xs` | Один outline-рецепт | актуально |
| `src/components/ui/SectionLabel.tsx:23` | Мёртвый компонент, дублирующий `.label` с другим цветовым токеном | Удалить или применить `.label` | ✓ файл удалён (ревью 2026-09) |
| `src/components/ui/ClampedText.tsx:161` | Вуаль клампа уходит в `--background`, но компонент используется и внутри `--surface`-панелей — виден переход | Цвет вуали параметром | актуально |
| `src/components/product/ProductGallery.tsx:80` | Мёртвый файл со старым языком | Удалить | ✓ файл удалён (ревью 2026-09) |
| `src/components/product/PriceHistoryChart.tsx:230` | Тултип и скелетон без радиуса | `rounded-lg` / `rounded-xl` | ✓ файл удалён (ревью 2026-09) |
| `src/components/product/ProductReviews.tsx:168` | «Load more» и кнопка отправки различаются шкалой подписи и паддингом; обе без радиуса | Привести к outline-рецепту PDP | ✓ файл удалён (ревью 2026-09) |
| `src/components/product/ProductClient.tsx:210` (и `setTimeout` `:78-81`, `:88`) | Магические 260ms в трёх местах, единственная произвольная длительность в классах | Именованная константа, лучше `duration-300` | актуально; в CSS то же значение теперь токен `--dur-slow` (`globals.css:34`) |
| `src/app/builder/page.tsx:1911` | `bg-[var(--foreground)]/70` — модификатор непрозрачности на переменной вопреки договорённости `globals.css:54` (технически на Tailwind v4 работает) | Предвычисленный токен или `opacity-70` на элементе | актуально |
| `src/app/builder/page.tsx:1902` | `var(--surface-hover, var(--surface))` — токен `--surface-hover` не определён нигде, hover нулевой | `hover:bg-[var(--fg-overlay-05)]` | ✓ исправлено (UX-правка 2026-09-12) |
| `src/app/builder/page.tsx:2360` | `.animate-slide-up` объявлен в `globals.css` дважды — выигрывает второй, первый мёртв | Оставить одно объявление | ✓ исправлено (UX-правка 2026-09-12): одно объявление `globals.css:577`; анимация снова работает после починки `--ease-drawer` (ревью 2026-09) |
| `src/components/outfit/OutfitCollage.tsx:63` | Разделители коллажа — `bg-gray-200` (плашки `bg-white` при этом корректны) | `bg-[var(--border)]` | актуально; тот же `bg-gray-200` во всех копиях коллажа (строка про коллаж в Medium), в `MyLooksPanel.tsx:629` ещё `bg-[#f0f0f0]` |
| `src/components/outfit/OutfitCard.tsx:89` | Размер кнопки лайка `md:w-8 md:h-8` против `md:w-7 md:h-7` у `ProductCard.tsx:161`. Заливка здесь токенная, у `ProductCard` — сырая | Совместить размер на `md:w-7 md:h-7`, заливку двигать к токену | актуально |
| `src/app/outfit/[id]/page.tsx:204` | Обёртка `rounded-xl` вокруг `rounded-2xl` `OutfitCard` | `rounded-2xl` | актуально |
| `src/app/plans/page.tsx:202` | Бейдж «Most popular» — `text-[8px]`, ниже пола шкалы | `text-[10px]` | актуально → на телефоне ✓ (R-20): пилюля 26 px, текст 12 px. Десктоп прежний |
| `src/app/plans/page.tsx:218` | Разделитель `border-current/10` — единственная граница вне токенного набора | Ветвление на `--fg-on-dark-60`/`--border` | актуально → на телефоне разделителя нет (R-20): цена и список возможностей идут без линии, как в макете. Десктоп прежний |
| `src/app/subscribe/page.tsx:11` | `PLAN_COPY` дословно дублирует массивы `features` из `plans/page.tsx:20,37,55`; обе страницы дублируют то, чем владеет `lib/plans.ts` | Один экспорт в `src/lib/plans.ts` | актуально |
| `src/components/auth/AuthForm.tsx:125` | Primary Clerk-кнопки `text-xs`, тогда как CTA воронки на `/subscribe` — `text-[10px]` | `text-[10px]` | актуально → на телефоне (мобильный трек R-23, 2026-10-07): ниже `md` primary — пилюля 50 px, 16 px обычным регистром, по §12. От `md` без изменений |
| `src/app/coming-soon/page.tsx:56` | Инлайновый `<style>` переобъявляет `fadeUp`/`fadeIn`, `dotPulse` определён дважды с разной начальной непрозрачностью | Один `dotPulse` | ✓ файл удалён (ревью 2026-09) (страница и `FeatureCarousel.tsx`; гейт «coming soon» снят при ревью 2026-09) |
| `src/app/sitemap-page/page.tsx:95` (и `:111`) | Outline-CTA без `rounded-xl`, в отличие от `about/page.tsx` (локально согласуется с hairline-сеткой страницы) | `rounded-xl` | актуально → на телефоне (мобильный трек R-24, 2026-10-07): ниже `md` обе кнопки — мягкие пилюли 44 px. От `md` без изменений |
| `src/components/stylist/StylistDrawer.tsx:899` (и `:908`) | Ширина карточки задана инлайновым `style={{ width: 72 }}`, а изображение в соседней ветке — классом `w-[72px]` (`:870`) | Класс в обеих ветках | ✓ исправлено попутно (мобильный трек R-16, 2026-10-07): ширина — класс в обеих ветках, `w-[84px] md:w-[72px]`; изображение — `w-full` |
| `src/components/stylist/StylistPersonalizationModal.tsx:288` (и `:296`) | Две кнопки одного футера имеют `disabled:opacity-30` и `-40` | `disabled:opacity-40 disabled:cursor-not-allowed` | актуально |
| `src/components/ui/parallax-floating.tsx:29` | Мёртвый код и единственный потребитель `src/hooks/use-mouse-position-ref` | Удалить оба | ✓ файл удалён (ревью 2026-09) (оба) |
| `src/components/ui/HeroBackground.tsx:10` | Мёртвый код; читает тему императивно через `useTheme()` | Удалить | ✓ файл удалён (ревью 2026-09) |
| `src/components/ui/animated-group.tsx:140` | Достижим только через мёртвый `hero-section-1.tsx`; свой набор пресетов анимаций, расходящийся с каноном | Удалить вместе с `hero-section-1.tsx` | ✓ файл удалён (ревью 2026-09) |
| `src/app/blog/page.tsx:61` | Eyebrow с `tracking-[0.22em]` вместо доминирующих `0.18em` | `tracking-[0.18em]` | ✓ исправлено (до 2026-09): `blog/page.tsx:27`, листинг теперь в `components/blog/JournalFeed.tsx` |
| `src/app/privacy/page.tsx:401` | `font-mono` как типографический сигнал при том, что `--font-mono` разрешается в Inter Tight (~180 вхождений в `src/` — визуальный no-op) | Либо реальный моноширинный стек в `globals.css`, либо убрать класс | актуально (на `privacy` осталось одно вхождение) |
| `src/app/goo-studio/analytics/page.tsx:159` | Тот же баннер ошибки со скруглением на одной странице админки и без — на соседней | Добавить `rounded-xl` | ✓ исправлено (ревью 2026-09): `analytics/page.tsx:180`, `goo-studio/page.tsx:159,193` |
| `src/app/goo-studio/products/page.tsx:2507` (и `:3091`) | Непрозрачность скрима подбиралась по месту: `black/40`, `/50`, `/60`, `/70` и инлайновый `rgba(0,0,0,0.5)` | Один класс `bg-black/60` | ✓ исправлено в админке (GS4-9, 2026-10-05): все модалки админки — на общем `Modal` со скримом `bg-black/60`, панели и подтверждение тоже |
| `src/app/goo-studio/page.tsx:84` (и `:215`) | Декоративная четырёхцветная полоска (`blue/purple/emerald/amber`) на карточках дашборда, назначается по индексу массива; единственные синий и фиолетовый в админке | Убрать либо привязать к семантике | ✓ исправлено (GS4-1, 2026-10-05): полоска и `STAT_ACCENTS` удалены; синий и фиолетовый из `activity/page.tsx` убраны ещё при ревью 2026-09 |
| `src/app/goo-studio/users/page.tsx:431` | Ячейка шапки таблицы отличается от рецепта (9px, `--foreground-subtle`, `font-medium`) | `text-[10px] … text-[var(--foreground-muted)] font-normal` | ✓ исправлено (ревью 2026-09): `users/page.tsx:564` |
| `src/app/goo-studio/page.tsx:309` (также `:383`, `layout.tsx:677`) | Плашки админки разъехались по радиусам; `rounded-md` вне шкалы (раздел 4) | Свести плашки к `rounded-full`, `rounded-md` убрать | ◐ частично (ревью 2026-09): карта `planBadge` получила `rounded-full` (`users/page.tsx:68-73`), `rounded-md` ушёл из subscriptions; остались плашка плана на дашборде (`:309`), миниатюра (`:383`) и бейдж «Admin» в меню (`layout.tsx:677`); статус-бейдж в duplicates — `rounded-lg` (`duplicates/page.tsx:176`) |
| `src/components/admin/ImageCropEditor.tsx:172` | Редактор кадрирования и его модалка на русском, вся остальная админка на английском | Привести к английскому | ✓ исправлено (GS4-8, 2026-10-05): редактор кадрирования и Prompts по умолчанию на английском, русский — перевод в `_i18n/ru.ts` для тех, кто выбрал русский язык |

### Новые расхождения (сверка 2026-09-26)

Найдены при код-ревью сентября 2026 (`docs/CODE_REVIEW_2026-09.md`) и при сверке этого файла с кодом, проверены по коду 2026-09-26. Правила те же: это наблюдения, решение и отдельная задача — за CEO.

| Файл:строка | Что не так | Чем заменить | Важность |
|---|---|---|---|
| `src/app/globals.css:10` и `:29` | Токен `--ease-drawer` объявлен через самого себя: `--ease-drawer: var(--ease-drawer)` (и в `@theme inline`, и в `:root`; так же в собранном CSS). Циклическая переменная недействительна, поэтому `.animate-slide-up` (`:577`, нижние листы билдера `builder/page.tsx:2414,2804,2945`) и переход `.ov-rise` (`:719-723`, баннер cookies `CookieConsentBanner.tsx:38`) теряют анимацию входа: лист и баннер появляются рывком. Похоже на артефакт замены литералов токеном 2026-09-12. Найдено при сверке документа; стоит глазами проверить в браузере | Задать токену значение. До 2026-09-12 `.animate-slide-up` шёл на `cubic-bezier(0.32, 0.72, 0, 1)` — вероятно, это и есть задуманная «кривая Ionic/iOS» из комментария `globals.css:25` | ✓ исправлено (ревью 2026-09): токену задано `cubic-bezier(0.32, 0.72, 0, 1)` в обоих блоках |
| `src/app/goo-studio/analytics/page.tsx:66` (также `:84`, `analytics/Charts.tsx:252`, `goo-studio/page.tsx:233`) | Текст успеха `text-emerald-600` вместо `text-emerald-500` из статус-рецепта админки; то же с `text-amber-600` (`goo-studio/page.tsx:311`, `products/page.tsx:2036,2571,2573`) и hover `text-red-600` / `-700` (`users/page.tsx:1139`, `products/page.tsx:3060`) | Оттенки рецепта: текст `-500`, фон и рамка `-400` | low · ✓ исправлено (GS4-1, 2026-10-05): статусы на токенах `--ok` / `--warn` / `--err` (раздел 9), сырых `emerald` / `amber` / `red` в админке ноль |
| `src/app/goo-studio/page.tsx:211` (и `:231-234`) | Карточки дашборда — `rounded-2xl` и `hover:shadow-md`, хотя карточка админки `rounded-xl`, а глубина передаётся границей; чип динамики — `bg-emerald-500/12 text-emerald-600 border-emerald-500/20` вместо базовой тройки. Ревью решило тень пока не трогать | Рецепт карточки и статус-бейджа раздела 9 | low · ✓ исправлено (GS4-1, 2026-10-05): карточки `rounded-xl` без тени, чип динамики на токенах |
| `src/app/goo-studio/settings/recipes.tsx:6-7`, `parser/page.tsx:79-80`, `import/page.tsx:52`, `email/page.tsx:391,434,670`, `parser/collect/page.tsx:52-53`, `brands/page.tsx:17-18`, `retailers/page.tsx:61-62`, `duplicates/page.tsx:59-60`, `audit/page.tsx:291`, `users/page.tsx:460` (и `:467,483,702,709`), `products/page.tsx:1853` (и `:1863,1880,1892`), `products/page.tsx:2522`, `products/page.tsx:3037,3212`, `ImageCropEditor.tsx:339` | Контурная кнопка админки без канона: радиус у всех уже `rounded-lg`, но форм не меньше восьми, основные — `text-xs`/`0.12em`/`px-4 py-2` (settings, parser, import; в email с `px-5 py-2.5`); `11px`/`0.12em`/`px-4 py-2` (collect); `11px`/`0.08em`/`px-3 py-1.5` (brands, retailers); `11px`/`0.1em`/`px-3 py-2` (duplicates, audit); `9px`/`0.14em`/`px-3`–`px-4 py-2` (users); `text-xs`/`0.1em`/`px-3 py-2` (тулбар products); `10px`/`0.1em`/`px-3 py-1.5` (products, модалка; в email `10px`/`0.12em`/`px-2.5 py-1`); `text-xs`/`0.12em`/`px-4 py-2.5`–`px-5 py-3` с заливкой по hover (ImageCropEditor, products, email). Трекинги `0.08em` и `0.1em` вне шкалы раздела 2 | Выбрать одну форму (решение CEO) и завести её в §9 рядом с primary; кандидат — самая частая, `settings/recipes.tsx:6-7` | low · ✓ исправлено (GS4-1 и GS4-3, 2026-10-05): регистр и трекинг сведены в GS4-1; форма решена CEO (Р14) и введена рецептами `_ui/recipes.ts` — локальных констант кнопок в админке не осталось |
| `src/app/goo-studio/activity/page.tsx:298` (также `:388,392,418`) и по админке (`users/page.tsx:152-153,476,605-614`, `parser/page.tsx:474,505`, `audit/page.tsx:360,392`, `products/page.tsx:337,2176,2203`, `outfits/page.tsx:734,779,1150`, `goo-studio/page.tsx:231,309`) | Бейджи и подписи 9px с трекингом `0.16em` / `0.14em` / `0.12em` / `0.1em`; `0.1em` вне шкалы раздела 2 (при этом тот же `0.1em` стоит в канонической фильтр-пилюле админки, §9 п.6). Сам 9px в разделе 2 записан как «микро-подпись, чип», но там же пол шкалы назван 10px, а чеклист §10 п.6 требует «ничего меньше 10px» — документ противоречит сам себе. Ревью решило 9px не трогать | Решить, допустим ли 9px (CEO); tracking свести к `0.12` / `0.14` / `0.16` / `0.18em` | low · ✓ исправлено (GS4-1, 2026-10-05): CEO выбрал пол 11px и один уровень капса (Р4); в админке ноль текста меньше 11px, трекинг в квадратных скобках остался только `0.12em` у служебных подписей (и `0.2em` у вордмарка) |
| `src/app/goo-studio/analytics/page.tsx:490` (и `prompts/page.tsx:224`) | Текст 8px — ниже любой трактовки шкалы (подписи часов на тепловой карте, бейдж на Prompts); `parser/page.tsx:189` — eyebrow 9px с `tracking-[0.22em]` | `text-[10px]` (или 9px, если CEO его разрешит), `tracking-[0.18em]` | low · ✓ исправлено (GS4-1, 2026-10-05): подписи тепловой карты 11px, бейдж Prompts и eyebrow Parser — обычным регистром 11–12px |
| `src/app/goo-studio/products/page.tsx:3221-3250` | Второй рецепт тоста: статусная заливка на непрозрачной подложке, кнопка закрытия, `z-[100]`; на duplicates / brands / audit / categories — инверсная заливка без кнопки, `z-50` (раздел 9) | Выбрать один рецепт тоста админки | low · ✓ исправлено (GS4-3, 2026-10-05): один компонент `Toast` (`useToast()`), своих тостов в страницах нет |
| `src/app/goo-studio/products/page.tsx:2100` (также `:2507,3048,3091`) | Четыре модалки products без `role="dialog"` / `aria-modal` (у остальных модалок админки они есть); у bulk-модалки `shadow-xl` (`:2102`); бейдж «New» в таблице без радиуса (`:2434`) | Рецепт модалки §9 п.11; бейдж `rounded-full` | ✓ исправлено (GS4-9, 2026-10-05): все 11 модалок админки — на `Modal` (`role="dialog"`, название, Escape, фокус внутри); бейдж New — `rounded-full` с GS4-4. `shadow-xl` у bulk-модалки остался — тень у модалки допустима |
| `src/app/goo-studio/users/page.tsx:1192-1208` (и `blog/page.tsx:801-813`) | Переключатель в users — вся строка-кнопка без `role="switch"` / `aria-checked`; в blog переключатель другого размера (`h-6 w-11` против `w-9 h-5` у `parser/page.tsx:522-533`) | Рецепт переключателя §9 п.7 | low |
| `src/app/not-found.tsx:28` (также `error.tsx:41`, `MyLooksPanel.tsx:1049`, `HeroSection.tsx:59`, `builder/page.tsx:1676`, `StylistPersonalizationModal.tsx:92`) | Модификатор непрозрачности на переменной расползся: `border-[var(--foreground)]/20`, `hover:bg-[var(--foreground)]/5`, `bg-[var(--background)]/85`, `/80`, `bg-[var(--surface)]/50` — вопреки договорённости раздела 1 (на Tailwind v4 технически работает) | Предвычисленные `--bg-overlay-*` / `--fg-overlay-*` или `opacity-*` на элементе | low |
| `src/components/auth/AuthForm.tsx:73` (карта `ELEMENTS`) | Стили Clerk (emotion) стоят вне слоёв и перебивают слоёные утилиты Tailwind, поэтому классы карты без `!` по большей части не действуют — вопреки комментарию «colour and type classes happen to win anyway». Замер на стенде с настоящим clerk-js (R-23, 2026-10-07), от `md`: заголовок 18 px вместо `text-3xl`, подписи полей 14 px капсом вместо 10 px, поле 14 px вместо 13 px, у кнопки Google нет ни заливки, ни рамки (`bg-[var(--surface)]`, `border`), у поля Clerk ограничивает высоту `max-height: 36px`. Ещё: на кнопках Clerk объявлена своя `--border`, так что `border-[var(--border)]` внутри кнопки читает цвет Clerk. Ниже `md` исправлено в R-23 (классы с `!`, синоним `--auth-border`) | Решить, каким должен быть вход на десктопе, и поставить `!` на типографику и рамки карты; цвета рамок кнопок — через `--auth-border` | medium |

---

## 12. Мобильная версия сайта (вариант Б)

**Статус:** целевые рецепты мобильного трека (решение CEO 2026-10-06: `docs/MOBILE_PLAN.md`, вариант Б на всех экранах). Это не снимок кода, как разделы 1–9: по рецептам переделываются экраны в задачах `docs/MOBILE_ROADMAP.md`. Когда задача закрыта, её экран живёт по этому разделу. Макеты: холст https://claude.ai/artifact/TJiTGG5bV46G8R3CNeyTR8, страницы «v1» (вариант Б) и «v2», общие детали — на странице «Детали».

Действует только **ниже `md` (<768 px)**. Tailwind пишется mobile-first: рецепт ложится в классы без префикса, а прежний вид десктопа переезжает в `md:`. Десктоп не меняется.

### 12.1 Правила

1. **Один акцент на экран.** Залитая кнопка (primary) на экране одна, остальные действия — мягкой кнопкой, текстом или иконкой.
2. **Капс — только у мелкого надзаголовка** (рецепт eyebrow из раздела 2, не больше одного на экран). Кнопки, табы, чипы, пункты меню, заголовки страниц и карточек — обычным регистром.
3. **Нет рамки внутри рамки.** Группы отделяются воздухом и разделителем `box-shadow: inset 0 1px 0 var(--border)` / `border-t`, а не вложенными карточками.
4. **Фото — главное.** Поверх фото — только светлые контролы (12.6), ничего тёмного.
5. **Цель касания — 44×44.** Иконка может быть мельче, но кнопка вокруг неё — `w-11 h-11`.
6. **Ничего не едет вбок на 360 px.** Широкое (таблица, лента) — в своём контейнере с `overflow-x-auto`, лучше — переложенное в столбик.
7. **Заголовок страницы спокойный:** `text-2xl font-semibold tracking-[-0.015em]` (24 px) обычным регистром вместо `text-4xl font-black uppercase`.
8. **Поле ввода — 16 px** (`text-base`), иначе iOS зумит страницу при фокусе.

### 12.2 Глубина и токены

- **Плашка вместо рамки.** Карточки и группы на телефоне — `bg-[var(--surface)]` без рамки: в тёмной теме `#141414` на `#0A0A0A`, в светлой белое на `#F4F2EE`. Это осознанное отличие от правила раздела 4 «глубина — границей»: на телефоне рамки и есть тот шум, который убираем. Рамку `border-[var(--border)]` оставляют только капсулам шапки и меню и полям ввода.
- **Мягкая заливка** (вторичная кнопка, чип, иконка-кнопка на плашке, «пузырь» чата) — `bg-[var(--fg-overlay-08)]`.
- **Плавающие панели** (нижнее меню, полоса покупки) — `bg-[var(--surface-overlay-92)] backdrop-blur-md`. Токен `--surface-overlay-92` добавлен в `globals.css` для этого (обе темы).
- **Радиусы на телефоне:** `rounded-full` — капсулы, пилюли, иконки-кнопки, чипы; `rounded-2xl` (16) — карточки, группы строк, плашки пустых состояний, поля; `rounded-3xl` (24) — листы снизу, крупное фото товара и холст конструктора. `rounded-3xl` в шкале раздела 4 нет — это добавление для телефона.

### 12.3 Шапка-капсула

Макет: «Детали · шапка», все экраны v2.

```tsx
<header className="sticky top-0 z-50 pt-1.5 px-3">   {/* обёртка; капсула внутри: */}
<nav className="h-[50px] rounded-full border border-[var(--border)] bg-[var(--surface)]
                flex items-center pl-[18px] pr-1">   {/* с кнопкой «назад»: px-1, вордмарк по центру */}
  {/* вордмарк GOO (рецепт хедера), затем AI и корзина — кнопки w-11 h-11, счётчик — бейдж-счётчик 5.11 */}
</header>
```

Без тени. Кнопка «назад» (`w-11 h-11`, шеврон 20 px) — на товаре, образе, образе пользователя, статье, оформлении подписки. Капсула 50 px и отступ 6 px сверху — чтобы шапка с нижним меню занимали не больше 112 px (план, «Готово, когда» п. 7); в макете 52 px. Код: `src/components/layout/Navigation.tsx` (R-03).

### 12.4 Нижнее меню-капсула

Макет: «Детали · нижнее меню».

```tsx
<nav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6px)] z-40 h-[50px] px-1.5
                rounded-full border border-[var(--border)] bg-[var(--surface-overlay-92)] backdrop-blur-md
                flex items-center justify-between">
  {/* вкладка: w-11 h-11 rounded-full, иконка 21 px, stroke 1.3, цвет --foreground-muted
      активная: h-11 pl-3 pr-3.5 rounded-full bg-[var(--fg-overlay-08)] text-[var(--foreground)],
      иконка stroke 1.7 + подпись text-[12px] font-semibold обычным регистром */}
</nav>
```

Подпись видна только у активной вкладки; у остальных вкладок есть `aria-label`. Без тени.

### 12.5 Карточка на плашке

Макет: v1 «Б · Каталог», v2 «Б · Каталог — образы».

```tsx
<div className="rounded-2xl bg-[var(--surface)] overflow-hidden">        {/* без рамки */}
  <div className="relative aspect-[3/4] bg-white" style={photoBackdrop(...)}>  {/* правило раздела 1 */}
    {/* светлое сердце 12.6 справа сверху, бейдж New 12.6 слева сверху */}
  </div>
  <div className="px-3 pt-2.5 pb-3">
    <p className="text-[13px] font-semibold truncate">{brand}</p>
    <p className="text-[12.5px] text-[var(--foreground-muted)] truncate">{name}</p>
    <div className="mt-1.5 flex items-baseline justify-between gap-1.5">
      <span className="text-[13px] font-medium">{price}</span>
      <span className="text-[11px] text-[var(--foreground-muted)]">{n} stores</span>
    </div>
  </div>
</div>
```

Корзины на карточке нет (решение CEO): в корзину кладут со страницы товара. Отдельной полосы «N STORES» нет — число магазинов стоит строкой у цены. Сетка — `grid-cols-2 gap-2.5 px-3`.

Длинная цена не обрезается: строка цены — `max-md:flex-wrap`, и число магазинов уходит под цену. Карточки в ряду одной высоты (`max-md:h-full`). Число цветов на телефоне не показывается. Код: `src/components/product/ProductCard.tsx` (R-06).

Карточка образа — та же плашка: коллаж или фото, название, цена и «N pieces» вместо числа магазинов, светлое сердце. Швы коллажа ниже `md` белые, вещи лежат на одном светлом поле, как в макетах; бейдж Community — светлый кружок. Код: `src/components/outfit/OutfitCard.tsx`, `OutfitCollage.tsx` (R-07).

### 12.6 Контролы поверх фото

Фото товаров на сайте светлые в обеих темах (`bg-white` и замеренный фон, раздел 1), поэтому контрол поверх фото светлый в обеих темах. Это то же исключение из правила цвета, что `bg-black/NN` в разделе 1: фон здесь — фотография, а не тема.

- **Сердце:** кнопка `absolute top-0.5 right-0.5 w-11 h-11 grid place-items-center`, внутри кружок `w-7 h-7 rounded-full bg-white/80`, сердце 14 px, `stroke` чёрный (`text-black`), у сохранённого — заливка.
- **Бейдж New:** `absolute top-2.5 left-2.5 rounded-full bg-white/80 text-black text-[10px] font-semibold px-2 py-[3px]`, обычным регистром. Не пересекается с сердцем.
- **Счётчик фото** («1 / 2») — как бейдж, справа снизу.

### 12.7 Лист снизу

Макеты: v1 «Б · Фильтры и сортировка», v2 «Б · AI-стилист», «Б · Корзина», «Б · Конструктор — сохранить образ», «Б · Окно „нужен тариф“».

```tsx
<div className="ov-scrim fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
<section role="dialog" aria-modal="true" aria-label="…"
         className="ov-rise fixed inset-x-0 bottom-0 z-50 max-h-[calc(100%-56px)] rounded-t-3xl
                    bg-[var(--surface)] flex flex-col pb-[calc(env(safe-area-inset-bottom)+16px)]">
  <div className="mx-auto mt-2 w-9 h-1 rounded-full bg-[var(--border-strong)]" />   {/* ручка */}
  <div className="flex items-center pl-4 pr-1.5">
    <h2 className="flex-1 text-[18px] font-semibold">Sort &amp; filter</h2>
    {/* закрыть: w-11 h-11, крестик 18 px, --foreground-muted */}
  </div>
  {/* содержимое; внизу — ряд действий: мягкая «Clear» + primary-пилюля «Show N pieces» */}
</section>
```

Появление и уход — `.ov-scrim` / `.ov-rise` с `useOverlayPresence` (раздел 7), блокировка прокрутки `useScrollLock`, закрытие по Escape и по тапу на скрим. Уровень — как у drawer (`z-50`, раздел 3).

### 12.8 Полоса покупки

Макеты: v1 «Б · Товар», «Б · Где купить», «Б · Образ», v2 «Б · Оформление подписки».

```tsx
<div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6px)] z-40 h-16
                rounded-3xl border border-[var(--border)] bg-[var(--surface-overlay-92)] backdrop-blur-md
                flex items-center gap-2 pl-[18px] pr-2.5">
  <div className="flex-1 min-w-0">
    <p className="text-[15px] font-semibold">From $890</p>
    <p className="text-[12px] text-[var(--foreground-muted)]">3 stores</p>
  </div>
  {/* иконка-кнопка (мягкая, w-11 h-11): Add to bag / Share */}
  {/* primary-пилюля h-11: Where to buy / Add all to bag / Continue to payment */}
</div>
```

На странице с полосой покупки нижнее меню скрыто: полоса стоит на его месте. Так сделано на товаре, образе, образе пользователя и оформлении подписки (решения CEO).

Список таких страниц один — `hasBuyBar()` в `src/components/layout/MobileBottomNav.tsx`:
- по нему меню прячется;
- по нему же `ConditionalSiteLayout` даёт подвалу отступ 82 px вместо 68, потому что полоса 64 px выше меню 50 px; зазор до подвала — те же 12 px.

Сейчас в списке товар, образ и образ пользователя (R-11, R-13); оформление подписки добавится в R-20.
- Полоса образа — в `OutfitActions.tsx`: цена «от–до», число вещей, «Share» и «Add all to bag».
- У образа пользователя — сумма, число вещей и «Build your own look»: положить такой образ в корзину целиком на сайте нельзя, новой функции не добавлено.

Полоса товара — в `ProductClient.tsx` (R-11): «Add to bag» мягкой иконкой-кнопкой (повторное нажатие убирает вещь, как раньше на карточке), «Where to buy» прокручивает к списку магазинов. На том же экране фото листается свайпом в карточке `rounded-3xl`, счётчик «1 / 2» — светлая пилюля справа снизу (12.6).

Дополнение R-20: оформление подписки в списке — `pathname === "/subscribe"` (точное совпадение, не префикс). Полоса — в `src/app/subscribe/page.tsx`: цена в гривнах, «≈ $N · cancel anytime» и primary «Continue to payment». Меню скрыто на всех состояниях `/subscribe`, включая подтверждение оплаты: `hasBuyBar` смотрит только на путь.

### 12.9 Кнопки на телефоне

Рецепты раздела 5.3 остаются для десктопа (`md:`). На телефоне кнопки — пилюли обычным регистром:

| Роль | Классы |
|---|---|
| Primary | `h-12 px-6 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[15px] font-semibold` (в полосе покупки и шапке листа — `h-11 px-5`) |
| Мягкая (вторичная) | `h-12 px-5 rounded-full bg-[var(--fg-overlay-08)] text-[var(--foreground)] text-[15px] font-medium` |
| Иконка | `w-11 h-11 rounded-full` — на плашке `bg-[var(--fg-overlay-08)]`, на странице `bg-[var(--surface)] border border-[var(--border)]` |
| Текстовая | `h-11 px-3 text-[15px] text-[var(--foreground)]` (второстепенная — `--foreground-muted`) |

Общий примитив кнопки по-прежнему не заводится (раздел 6): классы пишутся по месту по этой таблице.

### 12.10 Чип и сегментированный контрол

- **Чип** (фильтры, категории, теги): `h-9 px-3.5 rounded-full text-[13px]`; обычный — `bg-[var(--fg-overlay-08)] text-[var(--foreground)]`, выбранный — `bg-[var(--foreground)] text-[var(--background)] font-semibold`. Снимаемый фильтр — тот же чип с крестиком 13 px справа, `h-8`.
- **Сегментированный контрол** (Pieces / Outfits, вкладки «Лайков» и профиля): контейнер `h-11 p-[3px] rounded-full bg-[var(--surface)] grid grid-cols-N` (на странице — ещё `border border-[var(--border)]`), пункт `rounded-full text-[14px]`, выбранный — `bg-[var(--foreground)] text-[var(--background)] font-semibold`, остальные — `--foreground-muted`. Счётчик в пункте — тем же цветом с `opacity-60`.
- **Цель 44 px у сегментов.** Так пункт был бы 36 px, а рамка и отступ вокруг него не нажимались бы. Поэтому `p-[3px]` и `border` на контейнер не ставят: рамка — `shadow-[inset_0_0_0_1px_var(--border)]`, пункт — `relative h-11`, подложка выбранного — вложенный `<span className="absolute inset-[3px] rounded-full bg-[var(--foreground)]">`. Выглядит так же, как в макете. Код: `src/app/browse/page.tsx` (R-08).
- **Чип в листе — цель 44 px:** сам чип `h-9`, а псевдоэлемент `after:absolute after:inset-x-0 after:-inset-y-1` добирает по 4 px сверху и снизу. При `gap-2` между рядами зоны соседних рядов сходятся встык. Код: `SheetChip` в `src/app/browse/page.tsx` (R-09).
- **Переключатель в листе** («Only my likes», «AI outfits only»): строка `h-[52px] rounded-2xl bg-[var(--fg-overlay-08)] px-3.5`, вся строка — `role="switch"`; дорожка `w-11 h-[26px]` — `--foreground` включённая и `--border-strong` выключенная, бегунок `--background`.
- **Поле поиска в строке инструментов:** капсула `h-11 rounded-full border border-[var(--border-strong)] focus-within:border-[var(--foreground)] bg-[var(--surface)]`, справа «Cancel» текстом. Фокус показывает капсула, у самого `<input>` — `outline-none!`. Общее кольцо `:focus-visible` в `globals.css` стоит вне слоёв, и обычный `outline-none` из слоя utilities его не перебивает.

### 12.11 Строки и группы

Магазины, вещи образа, настройки профиля, FAQ, ссылки подвала — строки в одной плашке:

```tsx
<div className="rounded-2xl bg-[var(--surface)] overflow-hidden">
  <a className="h-14 flex items-center gap-2.5 px-4">…</a>   {/* следующие строки: shadow-[inset_0_1px_0_var(--border)] */}
</div>
```

Значение справа — `--foreground-muted`, шеврон 15 px. Строка целиком — ссылка или кнопка, цель касания не меньше 56 px в высоту.

### 12.12 Пустое состояние и ошибка

Макеты: v2 «Б · Каталог — ничего не найдено», «Б · Каталог — ошибка», «Б · Корзина — пусто», «Б · Лайки — пусто», «Б · Ошибка».

```tsx
<div className="rounded-2xl bg-[var(--surface)] px-6 py-12 text-center">   {/* role="alert" у ошибки */}
  <span className="mx-auto w-14 h-14 rounded-full bg-[var(--fg-overlay-08)] grid place-items-center text-[var(--foreground-muted)]">{icon}</span>
  <h2 className="mt-4 text-[19px] font-semibold">No pieces found</h2>
  <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--foreground-muted)]">…</p>
  {/* одно действие: primary-пилюля h-11 («Clear all filters», «Try again», «Browse pieces») */}
</div>
```

Ошибка отличается от пустого состояния текстом (что случилось и что сделать) и действием «Try again», которое повторяет запрос. Молча показывать «ничего не найдено» вместо ошибки нельзя.

Скелетон загрузки — та же плашка карточки с мягкими блоками `bg-[var(--fg-overlay-08)] animate-pulse` и `role="status"`. Кнопку «Clear all filters» показывают, только когда есть что сбросить. Код: `PhoneSkeleton`, `CatalogEmpty` в `src/app/browse/page.tsx` (R-10).

**Низ каталога** (решение CEO 3б, макет v2 «Б · Подвал»):
- «Show more» — мягкая пилюля во всю ширину `h-12`;
- под ней `<nav aria-label="Pages">`: стрелки и номера — круги `w-11 h-11`, текущая страница — `bg-[var(--foreground)]` и `aria-current="page"`;
- под номерами строка «Showing 1–20 of 24 pieces», `text-[13px] --foreground-muted`.

На телефоне номеров не больше пяти (первая, последняя, текущая и «…»), чтобы ряд кругов по 44 px помещался в 360 px.

### 12.13 Заметки

- Подвал на телефоне — плашка: вордмарк, слоган, три группы ссылок строками с переносом, копирайт (макет «Б · Подвал»). Отступ под нижнее меню задаётся один раз.
- Корзина везде называется «Bag» (решение CEO): «Open bag», «Your bag», «Add to bag».
- Состояния экранов сверяются на стенде `scripts/site-screens` (снимки 390 и 360 px, обе темы, `--metrics`, `--overflow`).
- **Заголовок раздела на странице** (товар, «Recently viewed»; дальше — главная и журнал): надзаголовок `text-[13px] text-[var(--foreground-muted)]` обычным регистром, под ним `<h2>` `text-[20px] font-semibold tracking-[-0.01em]`, до сетки 12 px. Как «Keep reading» и «Outfit examples» в макетах v2. Код: `ProductClient.tsx`, `RecentlyViewed.tsx` (R-12).
- **Конструктор на телефоне.** Он живёт без шапки сайта, со своей строкой:
  - назад — иконка-кнопка на странице, название образа 17 px, «AI» — пилюля с рамкой, «Save» — primary-пилюля `h-11`, без вещей мягкая и неактивная;
  - холст — `rounded-3xl`. Пустой — плашка с кольцом `shadow-[inset_0_0_0_1px_var(--border)]` и подсказкой. С вещами — коллаж на белом поле: сумма «$… · N pieces» светлой пилюлей слева внизу, «Clear all» — светлым кружком справа, «убрать вещь» — светлый кружок в цели 44 px;
  - категории — пилюли `h-10`, фильтр — кружок 40 px;
  - вещь в ленте — плашка 124 px с фото 140 px и значком 26 px: «+» на белом, «✓» на `--foreground`.

  Код: мобильный блок `src/app/builder/page.tsx` (R-14).
- **Всплывающие части конструктора** (R-15): фильтры, выбор цвета, «Save look» и выбор стиля — листы §12.7.
  - У `StylePicker` два корня. Десктопное окно, как было, и `md:hidden`-лист на `useOverlayPresence`. Десктоп закрывается по `open`, лист доигрывает уход.
  - Окна «Мои образы» (`MyLooksPanel`: просмотр, редактор, удаление) ниже `md` — листы тем же деревом через `items-end md:items-center` и `rounded-t-3xl md:rounded-2xl`. В просмотре фото сверху, вещи строками, действия прижаты к низу листа (`max-md:sticky`).
- **AI-стилист на телефоне** (R-16, макет v2 «Б · AI-стилист»). Тот же `StylistDrawer`, что и плавающее окно десктопа. Ниже `md` это лист во всю высоту под шапкой (`top-14 bottom-0`, `rounded-t-3xl`, `--surface`), поверх нижнего меню, со скримом §12.7.
  - Шапка: аватар, «Stylist» 16 px, статус 12 px, три иконки-кнопки 44 px без рамок и разделителей.
  - Пузыри 15 px: ассистент — `--fg-overlay-08` без рамки, пользователь — `--foreground`; радиус 18 px, у хвостика 6 px.
  - Ответ с вещами — лента миниатюр 84 px (бренд 12 px, цена 13 px) и карточка-строка «Build this look» 72 px: фото 56 px, «N pieces · Opens in the builder», шеврон. Названия образа и общей цены, как в макете, у ответа стилиста нет, поэтому в карточке их нет.
  - Подсказки — мягкие чипы §12.10 с целью 44 px через `after:`, поле — капсула 50 px на `--fg-overlay-08` с текстом 16 px и рамкой только в фокусе, «Send» — круг 38 px со стрелкой вверх.
  - «Daily messages» и история бесед — обычным регистром, беседы — строки в одной плашке (§12.11).

  Код: `src/components/stylist/StylistDrawer.tsx`.
- **Корзина на телефоне** (R-17, макеты v2 «Б · Корзина», «Б · Корзина — пусто»). Лист во всю высоту, как у стилиста. У десктопа своё окно, `hidden md:flex`; у телефона — `md:hidden`-лист на `useOverlayPresence`, как у `StylePicker`.
  - Шапка «Bag · N pieces» 18 px.
  - Строки `BagRow` разделены линией: фото 72×92, бренд 12 px над названием 15 px, «×» в цели 44 px, цена 15 px. Магазин — мягкая пилюля 34 px с целью 44: один магазин — ссылка с его именем, несколько — «N stores» с меню выбора.
  - Низ `BagCheckout`: «Total», primary «Open all N stores» (если у части вещей нет магазина — «pages»), строка «N of M links verified».
  - Пусто — `BagEmpty`. Escape сначала закрывает меню магазинов, потом лист.
  - Страница `/cart` на телефоне собрана из тех же частей на плашках.

  Код: `src/components/cart/CartPanel.tsx`, лист — `src/components/layout/Navigation.tsx`.
- **Лайки на телефоне** (R-18, макеты v2 «Б · Лайки», «Б · Лайки — пусто»).
  - Заголовок «Your likes» 24 px.
  - Вкладки — сегменты §12.10 на три колонки, 44 px, «Pieces 4» со счётчиком в `opacity-60`. Помещаются в 360 px без прокрутки. Бейдж «новое» в вкладке — 18 px с цифрой 11 px.
  - Карточки образа в лайках и «моего образа» — плашка без рамки, светлый бейдж на фото, текст 12–14 px. «Add to bag» в карточке — мягкая пилюля 44 px: сетка из primary-кнопок была бы экраном акцентов (§12.1 п. 1).
  - Пустая вкладка — `PhoneEmpty` из `src/components/look/CardBits.tsx` (рецепт §12.12).

  Код: `src/app/saved/page.tsx`, `src/components/look/MyLooksPanel.tsx`.
- **Профиль на телефоне** (R-19, макет v1 «Б · Профиль»).
  - Вверху карточка пользователя: аватар 52 px, имя 18 px (это `<h1>` страницы), почта, пилюля тарифа. Вкладки — сегменты §12.10.
  - «Account» — строки §12.11 на плашке:
    - «Plan» — ссылка на `/plans`;
    - «Appearance» — переключатель Light/Dark в строке, сегменты 34 px с целью 44 через `after:`;
    - «Currency» — строка со значением и шевроном, поверх неё невидимый нативный `<select>`, он открывает системный список.

    «Sign out» — отдельная плашка.
  - «Plan» и «AI stylist» — та же разметка, что на десктопе, с классами для телефона:
    - надзаголовки 13 px вместо 10 px капсом;
    - рамки стали плашками;
    - кнопки — пилюли §12.9;
    - чипы — §12.10;
    - палитра — по 6 в ряд, чтобы кружок был не меньше 44 px;
    - поля 16 px.
  - Окно персонализации (`StylistPersonalizationModal`) ниже `md` — лист снизу тем же деревом (`items-end md:items-center`, `rounded-t-3xl md:rounded-2xl`).

  Код: `src/app/profile/page.tsx`, `src/components/stylist/StylistPersonalizationModal.tsx`.
- **Радиус поля в фокусе.** Общее правило `:focus-visible` в `globals.css` стоит вне слоёв. Кроме кольца оно ставит `border-radius: 2px`, поэтому скруглённое поле в фокусе становится прямоугольным. На телефоне радиус поля задают с `!`: `max-md:rounded-2xl!`, а кольцо снимают через `outline-none!`. Найдено в R-19.
- **Тарифы на телефоне** (R-20, макеты v2 «Б · Тарифы», «Б · Оформление подписки», «Б · Окно „нужен тариф“»).
  - Карточки — плашки 20 px, выбранный тариф — кольцо `shadow-[inset_0_0_0_1.5px_var(--foreground)]` вместо тёмной заливки десктопа. Его кнопка — единственная primary среди карточек, остальные мягкие.
  - Таблица сравнения — отдельная разметка `md:hidden`: сетка `1.6fr 1fr 1fr 1fr` на плашке, 13 px. Помещается в 360 px без прокрутки. Строка цены вынесена в подпись под таблицей.
  - FAQ — аккордеон строк на плашке, `aria-expanded`.
  - Окно «нужен тариф» (`UpgradeModal`) — лист тем же деревом: замок в мягком круге, заголовок 20 px, primary «Upgrade to …» и текстовая «Not now». Блок цены на телефоне не показан: он есть на `/plans`.

  Код: `src/app/plans/page.tsx`, `src/app/subscribe/page.tsx`, `src/components/upgrade/UpgradeModal.tsx`.
- **Главная на телефоне** (R-21, макеты v2 «Б · Главная», «Б · Главная, продолжение»).
  - Компоненты главной переключают раскладку на `lg`, а не на `md`. Поэтому правки для телефона сделаны дописанными `max-md:`-классами поверх прежних: от 768 px всё как было, и на планшете (768–1023) тоже.
  - Секции «How it works» и «AI stylist» ниже `md` — на токенах темы, без тёмной подложки `#050505`/`#0A0A0A`. Шаги — плашки 92 px, 8 px между ними, без стрелок.
  - Чат стилиста — плашка с аватаром «G», пузыри 14 px, карточки образов строками.
  - Заголовки секций 26 px, надзаголовок 13 px.
  - Карусель примеров — лента с точками, стрелки только от `md`.
  - Секции по-прежнему занимают по экрану (`.home-section`): это поведение не менялось.

  Код: `src/app/page.tsx`, `src/components/home/`.
- **Журнал на телефоне** (R-22, макеты v2 «Б · Журнал», «Б · Статья»).
  - Лента:
    - заголовок «Journal» 24 px вместо «STYLE, EXPLAINED.», чипы категорий — одной листающейся строкой (§12.10);
    - главный пост — плашка с фото 2:1, ниже посты строками с миниатюрой 76 px;
    - мета — одной строкой «Категория · N min read» 12 px.
  - Статья: чип категории 28 px, заголовок 28 px, лид 17 px, подпись «Автор · дата». «← Journal» на телефоне скрыта, назад ведёт шапка. «Share» — мягкие пилюли, «Keep reading» — заголовок 20 px и лента карточек 250 px.

  Код: `src/app/blog/`, `src/components/blog/`.
- **Вход и регистрация на телефоне** (R-23, макет v2 «Б · Вход»).
  - Сверху круглая кнопка «назад» 44 px (ведёт на главную) и вордмарк по центру. Форма Clerk — во всю ширину колонки, без боковых отступов карточки.
  - Заголовок 26 px. Кнопка Google и «Continue» — пилюли 50 px. Поле — рецепт §12.14 высотой 50 px. Подписи и «or» — 13 px обычным регистром.
  - Внизу три пункта о сервисе из `PITCH`. «Secured by Clerk» остаётся частью карточки, под формой.
  - Как стилизовать Clerk. Его emotion-стили стоят вне слоёв и перебивают утилиты Tailwind, включая размер шрифта, поэтому классы в `appearance.elements` для телефона пишутся с `!`.
  - На кнопках Clerk объявлена своя `--border`. Цвет рамки берётся из `--auth-border` — синонима `--border` на корне страницы.
  - У поля Clerk `max-height: 36px`, для высоты 50 px нужен `max-h-none!`.

  Код: `src/components/auth/AuthForm.tsx`.
- **Служебные страницы на телефоне** (R-24, макеты v2 «Б · Правовая страница», «Б · 404», «Б · Ошибка», «Б · Баннер cookies»).
  - Тексты правил: заголовок 28 px, разделы «N · Название» 18 px без колонки номеров, подзаголовки 15 px полужирным, текст 16 px / 1.6 в `--foreground`. Отдельного тона для основного текста в токенах нет, поэтому взят тот же, что у статьи.
  - `/about` и `/sitemap-page`: подписи разделов 13 px вместо 9 px моно капсом, карточки и группы — плашки, кнопки — пилюли 44 px с одной залитой.
  - 404 и ошибка: одна залитая пилюля 48 px и под ней текстовая кнопка 44 px.
  - Баннер cookies поднимается над полосой покупки, если она есть на странице (`hasBuyBar`). Inline-тень десктопа на телефоне снята классом `max-md:shadow-none!`: `!important` из таблицы стилей сильнее inline-стиля без `!important`.

  Код: `src/app/{privacy,terms,cookie,refund,about,sitemap-page}/page.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/components/consent/`.
- **Цель касания 44 px — как считать** (R-25). Область нажатия — коробка элемента вместе с `::before`/`::after` (`after:absolute after:-inset-y-…`). Проверка стенда считает именно так. Три ловушки:
  - `after:` внутри ленты с `overflow-x-auto` обрезается краем ленты. Тянуть область можно только в пределах её паддинга (у ленты конструктора `py-0.5` даёт 2 px);
  - у кнопки с рамкой `after:` отсчитывается от паддинга, а не от рамки: рамка 1 px съедает по пикселю с каждой стороны (`-inset-[3px]` вместо `-inset-0.5` у «Filters» в конструкторе);
  - ссылка с базовым `text-xs` сохраняет его межстрочный 1.33 и при `max-md:text-[15px]`. `py-2.5` даёт 40 px, нужно `py-3`.

  Ссылки внутри строки текста считаются по правилу «вне текста» (план, п. 8) и не растягиваются.
- **Ловушка трекинга.** Правило `.text-3xl:not([class*="tracking-"])` в `globals.css` даёт крупным кеглям отрицательный трекинг. Любой класс `tracking-…` на элементе его отключает, в том числе `max-md:` и `md:`. Поэтому, если меняешь трекинг для телефона у элемента с `text-3xl`…`text-9xl`, задай десктопное значение явно: `tracking-[-0.01em] md:tracking-[-0.015em]`. Найдено в R-11.

### 12.14 Остальные элементы

| Элемент | Рецепт | Макет |
|---|---|---|
| Поле ввода | `h-12 rounded-2xl border border-[var(--border-strong)] bg-transparent px-3.5 text-base outline-none focus:border-[var(--foreground)]`; подпись над полем — `text-[13px] text-[var(--foreground-muted)]` обычным регистром. В листе фильтров поле мягкое: `bg-[var(--fg-overlay-08)]` без рамки | v2 «Вход», «Конструктор — сохранить образ», v1 «Б · Фильтры» |
| Поле поиска | пилюля `h-11 rounded-full border border-[var(--border-strong)] bg-[var(--surface)]`, лупа слева, крестик «очистить» справа, рядом текстовая кнопка «Cancel» | v2 «Каталог — поиск» |
| Переключатель | дорожка `w-11 h-[26px] rounded-full`, бегунок 20 px; выкл. — дорожка `--border-strong`, вкл. — `--foreground`; строка целиком — `<label>` высотой 52 px | v1 «Б · Фильтры» |
| Свотч цвета | кнопка `w-11 h-11`, внутри круг 28–30 px цвета товара с `ring-1` цвета `--border`; выбранный — двойное кольцо: 2 px фона и 1.5 px `--foreground` | v1 «Б · Товар», «Б · Фильтры» |
| Инфо-чип (тег) | `h-7 px-3 rounded-full bg-[var(--fg-overlay-08)] text-[12px]`, не кликабелен | v1 «Б · Образ», v2 «Статья» |
| Выделенная плашка | плашка 12.2 с кольцом `shadow-[inset_0_0_0_1.5px_var(--foreground)]` и пилюлей-меткой (`h-[26px] px-2.5 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[12px] font-semibold`) — популярный тариф | v2 «Тарифы» |
| Скелетон | та же плашка, что у загружаемого элемента; блоки текста и фото — `bg-[var(--fg-overlay-08)] animate-pulse`, полосы `h-[11px] rounded-md` | v2 «Каталог — загрузка» |
| Баннер cookies | плашка `rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-4` над нижним меню (`bottom` = отступ меню + высота меню + 8 px), две кнопки в ряд: мягкая «Decline» и primary «Accept» | v2 «Баннер cookies» |
| Наличие и лучшая цена | точка наличия — как сейчас на странице товара (`bg-green-500` / `bg-amber-500`, 6 px) с подписью `--foreground-muted`; метка «Best price» — `text-[11px] font-medium text-[var(--foreground)]` под ценой. В макете метка зелёная, но зелёный текст в светлой теме не проходит по контрасту, а статусных токенов с поддержкой тем на сайте нет (5.12) — поэтому монохром | v1 «Б · Где купить» |
