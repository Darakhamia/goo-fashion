# Дизайн-система Goo Fashion

Этот файл — описание того, что **уже есть** в коде `goo-fashion`, а не пожелание на будущее. Он нужен разработчику (человеку или агенту), который собирается добавить новый элемент интерфейса: прочитал — и сделал так, чтобы новое было неотличимо от существующего.

Все правила выведены из фактического кода со ссылками вида `файл:строка`. Если у чего-то канонического примера в коде нет — здесь так и написано, а не придумано.

Характер дизайна: editorial-минимализм. Тёплый светлый фон (`#F4F2EE`) и почти чёрный тёмный (`#0A0A0A`), **тёмная тема — по умолчанию**, один шрифт (Inter Tight), монохром без акцентного цвета, крупные плотно-трекованные заголовки и мелкие uppercase-подписи, глубина выражается границей в 1px, а не тенью.

---

## 1. Токены — единственный источник цвета

Определены в `src/app/globals.css:22-64`.

| Переменная | Light (`:root`) | Dark (`.dark`) | Назначение |
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
| `--fg-on-dark-60/70/80` | `rgba(244,242,238,.6/.7/.8)` | `rgba(10,10,10,.6/.7/.8)` | Текст на инвертированной поверхности (карточка тарифа, залитая `--foreground`) |
| `--home-nav-h` | `66px` | — | Высота плавающего хедера; синхронизируется из `HomeFullPageScroll` |
| `--home-bottom-nav-h` | `calc(4.5rem + env(safe-area-inset-bottom))` | — | Полоса под мобильную нижнюю навигацию |

Блок `@theme inline` (`globals.css:4-20`) отдаёт shadcn-совместимые имена (`--color-background`, `--color-muted-foreground` и т.д.). **В живом коде они не используются нигде.** Проверено: все 17 вхождений `bg-background` / `text-muted-foreground` / `bg-primary` / `bg-secondary` / `bg-accent` лежат ровно в двух файлах — `src/components/ui/button.tsx` (5) и `src/components/blocks/hero-section-1.tsx` (9, файл никем не импортируется, см. раздел 6). То есть весь shadcn-слой достижим только из мёртвого файла. Не начинай их использовать.

### Жёсткое правило цвета

```tsx
// ДА
className="bg-[var(--surface)] text-[var(--foreground-muted)] border border-[var(--border)]"

// НЕТ
className="bg-neutral-900 text-gray-500 border-zinc-800"
style={{ background: "#0a0a0a", color: "rgba(255,255,255,0.6)" }}
```

Никаких `text-gray-*`, `bg-neutral-*`, `border-zinc-*`, никаких hex/rgba литералов в стилях компонентов. Единственные легитимные исключения, подтверждённые кодом:

1. **`bg-white` под фотографией товара.** Это осознанная конвенция для вырезанных каталожных снимков: `src/components/product/ProductCard.tsx:141` и `src/components/product/ProductClient.tsx:152-153`. Белая подложка нужна и в тёмной теме.
2. **`bg-black/NN` для контрола, лежащего поверх фото.** `ProductCard.tsx:203,217` — кнопки корзины и лайка. Здесь фон не тема, а фотография.
3. **Семантические статусы** (`emerald` / `amber` / `red`) — токенов для них в системе **нет**, см. раздел 11.

### Зачем `--*-overlay-*` и когда их брать

Комментарий в `globals.css:36` объясняет причину: «pre-computed semi-transparent variants (avoids Tailwind v4 opacity modifier issues with CSS vars)». Проектная договорённость — **не писать `bg-[var(--foreground)]/70`**, а брать готовую переменную.

Практическое замечание, где данные расходятся: на Tailwind v4 (в проекте `tailwindcss ^4`) модификатор непрозрачности на `var()` компилируется в `color-mix()` и технически работает — так что `src/app/builder/page.tsx:1867` ничего не ломает. Но конвенция остаётся: берём предвычисленный токен, потому что он даёт одинаковый результат в обеих темах и не зависит от версии Tailwind.

Когда что:

- фон бейджа/оверлея поверх изображения → `bg-[var(--bg-overlay-90)]` (`OutfitCard.tsx:70`, `OutfitCarousel.tsx:74`);
- плотная плавающая панель (нижняя навигация) → `bg-[var(--bg-overlay-95)]` (`MobileBottomNav.tsx:91`);
- hover-заливка кнопки/строки → `hover:bg-[var(--fg-overlay-05)]` (`browse/page.tsx:978`, `StylistDrawer.tsx:719`);
- активное состояние, hover-скрим на картинке → `bg-[var(--fg-overlay-08)]` (`OutfitCard.tsx:83`);
- текст на поверхности, залитой `--foreground` → `text-[var(--fg-on-dark-60/70/80)]` (`plans/page.tsx:205,214`, `profile/page.tsx:900`).

---

## 2. Типографика

Шрифт **один** — Inter Tight, подключённый через `next/font`. `globals.css:24-26` присваивает `--font-body`, `--font-display` и `--font-mono` одно и то же семейство.

Следствие: **класс `font-mono` — визуальный no-op.** Он встречается в `src/` 177 раз (`privacy/page.tsx:196`, `MobileBottomNav.tsx:130`, `plans/page.tsx:164` и т.д.) и не даёт никакого контраста. Не добавляй `font-mono` ради «технического» вида — он ничего не делает. Существующие использования читай как семантический маркер, не как шрифт.

Отдельно: `var(--font-poppins)` применяется ровно в двух местах — вордмарк в хедере (`Navigation.tsx:147-148`, weight 800) и `/coming-soon` (`coming-soon/page.tsx:45`). Для нового UI Poppins не берём.

### Базовый текст

```css
/* src/app/globals.css:138-144 */
body {
  font-size: 14px;
  line-height: 1.6;
  letter-spacing: 0.01em;
}
```

### Шкала

Размеры пишутся **в bracket-px** (`text-[13px]`), это доминирующая форма (1063 против 681 именованных). Именованные классы Tailwind (`text-sm`, `text-xs`) допустимы, но в пределах файла держись одной формы.

| Роль | Рецепт | Источник |
|---|---|---|
| Hero-вордмарк | `text-[72px] md:text-[100px] lg:text-[128px] font-bold tracking-[-0.04em]` | `HeroSection.tsx:34-35` |
| H1 списковой страницы | `text-4xl md:text-5xl font-black uppercase` | `saved/page.tsx:1394`, `profile/page.tsx:190` |
| H1 legal / sitemap | `text-5xl md:text-6xl font-black uppercase` | `privacy/page.tsx:176`, `sitemap-page/page.tsx:47` |
| H1 editorial (about/blog) | `text-5xl md:text-7xl font-black uppercase leading-[0.95] tracking-tight` | `about/page.tsx:21`, `blog/page.tsx:64` |
| H1 детальной страницы (PDP/образ) | `text-3xl md:text-4xl font-bold leading-tight` | `ProductClient.tsx:205`, `outfit/[id]/page.tsx:127` |
| H2 секции главной | `text-[30px] sm:text-4xl md:text-5xl lg:text-[56px] font-bold tracking-[-0.04em] leading-[1.04]` | `src/app/page.tsx:57` (`SectionH2`) |
| H2 секции под фолдом | `text-2xl md:text-3xl font-bold uppercase` | `ProductClient.tsx:502` |
| Заголовок карточки | `text-[15px] font-semibold leading-snug truncate` | `ProductCard.tsx:232`, `OutfitCard.tsx:106` |
| Подзаголовок карточки | `text-[13px] text-[var(--foreground-muted)]` | `ProductCard.tsx:235` |
| Цена в карточке | `text-[14px] font-medium text-[var(--foreground)]` | `ProductCard.tsx:239` |
| Мета в карточке | `text-[11px] text-[var(--foreground-subtle)]` | `OutfitCard.tsx:110` |
| Основной текст блока | `text-sm text-[var(--foreground-muted)] leading-relaxed` | `terms/page.tsx:13`, `plans/page.tsx:170` |
| Eyebrow / надзаголовок | `text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]` | `saved/page.tsx:1391`, `about/page.tsx:18` |
| Микро-подпись, чип | `text-[9px] tracking-[0.16em] uppercase` | `outfit/[id]/page.tsx:157` |

**Пол шкалы — 10px.** Размеры 8px существуют (`plans/page.tsx:197`, `ProductClient.tsx:390`), но это отклонения, повторять не надо.

### Класс `.label`

```css
/* src/app/globals.css:246-252 */
.label {
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--foreground-muted);
  font-weight: 500;
}
```

Честно: **`.label` не применён нигде** — поиск `className="label"` по `src/` даёт ноль. Компонент `src/components/ui/SectionLabel.tsx`, кодирующий тот же рецепт, тоже никем не импортируется. Все ~129 eyebrow написаны руками, и половина из них берёт `--foreground-subtle`, а не `--foreground-muted` из утилиты (59 против 47). То есть утилита и реальность расходятся по цвету — это открытый вопрос, а не решённый.

Для нового кода: пиши eyebrow строкой `text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]` — это фактическое большинство. Не изобретай новый tracking.

### Правило tracking

- Uppercase-подписи всегда с положительным tracking. Каноническое значение — **`0.18em`** (129 использований, столько же указано в `.label`).
- Допустимые исторические значения: `0.14em` (ссылки навигации `Navigation.tsx:163`, CTA), `0.12em`, `0.16em`. Новых значений не вводить; `0.22em`, `0.2em`, `0.15em`, `0.1em` в коде есть, но это разброс, а не шкала.
- Крупные заголовки — наоборот, отрицательный tracking: `tracking-[-0.04em]` — константа display-типографики (`page.tsx:57`, `gooey-text-morphing.tsx:263`).

---

## 3. Сетка, отступы, контейнеры

### Контейнер страницы

Единственный рецепт внешнего контейнера во всём сайте:

```tsx
<div className="min-h-screen">
  <div className="max-w-[1440px] mx-auto px-6 md:px-12">
    {/* ... */}
  </div>
</div>
```

Источники: `Navigation.tsx:133`, `Footer.tsx:27`, `product/[id]/page.tsx:74`, `saved/page.tsx:1389`, `profile/page.tsx:185`, `about/page.tsx:11`, `blog/page.tsx:57` — около 20 файлов.

`max-w-7xl` в живом коде **не встречается ни разу** (единственное вхождение — `hero-section-1.tsx:79`, мёртвый файл). `max-w-2xl/3xl/4xl/5xl/6xl` — только внутренние меры текста (например, `privacy/page.tsx:168`: `pt-16 md:pt-24 pb-32 max-w-2xl`), никогда не внешний контейнер.

Главная страница использует более узкую внутреннюю меру: `max-w-[1280px] mx-auto px-6 md:px-12` (`page.tsx:119`, `HowItWorksSection.tsx:222`, `AIStylistShowcase.tsx:545`).

### Брейкпоинты

Стандартные Tailwind. Реально используются `sm` (640), `md` (768) — главный переключатель мобильный/десктоп, `lg` (1024), `xl` (1280) редко. `md` — точка, где меняется всё: паддинги (`px-6 md:px-12`), сетки, размер overlay-контролов, показ/скрытие нижней навигации.

### Вертикальный ритм

- Начало контента списковой страницы: `pt-12 md:pt-16` (`saved/page.tsx:1390`).
- Начало контента детальной страницы после хлебных крошек: `mt-8 md:mt-12` (`ProductClient.tsx:125`).
- Секция под фолдом: `mt-20 md:mt-28` (`ProductClient.tsx:497`).
- Секция с данными, отбитая линейкой: `mt-16 border-t border-[var(--border)] pt-10` (`PriceHistoryChart.tsx:52`, `ProductReviews.tsx:123`).
- Полноширинная секция контентной страницы: `border-t border-[var(--border)]` + `py-20 md:py-28` (`about/page.tsx:58-60`).
- Футер: `mt-16 md:mt-32`, `py-10 md:py-24` (`Footer.tsx:26-27`).
- Сетка карточек: `gap-4` — везде.

### Сетки карточек

```tsx
// каталог: browse/page.tsx:1310
"grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4"
// saved / связанные товары: saved/page.tsx:1447, ProductClient.tsx:506
"grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
```

Две формулы, различие исторические. Для нового каталожного грида бери второй вариант — `xl:grid-cols-4` в первом дублирует `lg` и ничего не даёт.

### `.home-section` — экран главной

```css
/* src/app/globals.css:93-104 */
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
    <div className="max-w-[1280px] mx-auto px-6 md:px-12">{/* ... */}</div>
  </section>
</HomeSection>
```

Источник: `src/app/page.tsx:92,117-119`.

### Safe area

```tsx
// src/app/layout.tsx:55-59
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
// src/components/layout/MobileBottomNav.tsx:88
style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
// зазор под нижнюю навигацию: ConditionalSiteLayout.tsx:58
"pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"
```

### Z-index

Шкалы нет — все значения литеральные. Фактическая лестница:

| Слой | Значение | Пример |
|---|---|---|
| Нижняя навигация, скрим корзины | 40 | `MobileBottomNav.tsx:87`, `Navigation.tsx:512` |
| Sticky-хедер, дропдауны, drawer | 50 | `Navigation.tsx:131,319,514`, `browse/page.tsx:937` |
| Скрим стилиста | 55 | `StylistDrawer.tsx:667` |
| Подменю валют, drawer стилиста | 60 | `Navigation.tsx:391`, `StylistDrawer.tsx:653` |
| UpgradeModal | 80 | `UpgradeModal.tsx:49` |
| Модалка выхода | 200 | `Navigation.tsx:574` |

Новый оверлей — вписывай в эту лестницу, не выдумывай промежуточных значений.

---

## 4. Радиусы, границы, поверхности

### Шкала радиусов

| Класс | px | Применение | Источник |
|---|---|---|---|
| `rounded-lg` | 8 | Инпуты, миниатюры, мелкие плашки | `browse/page.tsx:776`, `ProductClient.tsx:139` |
| `rounded-xl` | 12 | **Карточка товара**, кнопки, списки опций, обёртка ячейки грида | `ProductCard.tsx:131`, `browse/page.tsx:570` |
| `rounded-2xl` | 16 | Крупные панели, модалки, drawer, пустое состояние | `ProductClient.tsx:195`, `saved/page.tsx:725` |
| `rounded-full` | — | Пилюли, чипы, круглые иконки, бейджи-счётчики | 255 использований |
| `rounded-[28px]` | 28 | Полноширинная showcase-панель главной | `AIStylistShowcase.tsx:560` |

`rounded-md` встречается 20 раз и не является частью языка — это остатки shadcn. Не использовать.

Единственный конфликт в коде: `ProductCard` — `rounded-xl` (`ProductCard.tsx:131`), `OutfitCard` — `rounded-2xl` (`OutfitCard.tsx:42`). Они лежат в одних и тех же сетках. Канон — `rounded-xl` (обёртка ячейки грида везде `rounded-xl`: `browse/page.tsx:1344`, `ProductClient.tsx:508`, `RecentlyViewed.tsx:74`), `OutfitCard` — отклонение.

### Что такое «поверхность»

Глубина в системе выражается **границей, а не тенью**. Токена тени нет вообще; там, где тень встречается, это либо Tailwind `shadow-md`, либо инлайновый rgba.

- **Карточка** — поднята над страницей: `rounded-xl border border-[var(--border)] bg-[var(--surface)]` (`ProductCard.tsx:131`).
- **Панель** — крупный контейнер контента: `rounded-2xl border border-[var(--border)]` + паддинг `px-6 md:px-10 py-8 md:py-12` (`ProductClient.tsx:195`).
- **Плавающая панель** (дропдаун, drawer, модалка): `rounded-2xl border border-[var(--border)] bg-[var(--background)] overflow-hidden` + `boxShadow: "0 8px 32px rgba(0,0,0,0.28)"` (`Navigation.tsx:319-320`).
- **Внутренние разделители** — не вложенные карточки, а линейки: `border-b border-[var(--border)]` с `mb-8 pb-8` (`ProductClient.tsx:210`). Аккордеонов на PDP нет.
- **Hover-состояние поверхности**: `hover:border-[var(--border-strong)] hover:bg-[var(--surface)] transition-all duration-200` (`ProductClient.tsx:332`).

Заливка панели `bg-[var(--background)]` (равная фону страницы) встречается — `ProductClient.tsx:195`, `plans/page.tsx:191` — но противоречит канону `bg-[var(--surface)]` из `ProductCard`. Для новой карточки бери `--surface`.

---

## 5. Компоненты — канонические рецепты

### 5.1 Карточка товара — `ProductCard`

Канон. Не дублируй разметку, импортируй компонент: `import ProductCard from "@/components/product/ProductCard"`.

```tsx
// src/components/product/ProductCard.tsx:130-137, 141, 217, 231-241
<motion.div
  className="group relative flex flex-col overflow-hidden rounded-xl bg-[var(--surface)] border border-[var(--border)]"
  initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
  whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
  viewport={{ once: true, margin: "-40px" }}
  transition={{ type: 'spring', bounce: 0.2, duration: 0.8 }}
>
  <Link href={linkHref} className="block">
    <div className="relative bg-white overflow-hidden aspect-[3/4]">{/* image */}</div>
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
// browse/page.tsx:1364, ProductClient.tsx:508, RecentlyViewed.tsx:74
<div className="rounded-xl bg-[var(--background)] hover:shadow-md transition-all duration-200">
```

Расхождение, которое надо знать: заливка overlay-контрола в `ProductCard.tsx:217` — сырой `bg-black/80` с `text-white`, а в `OutfitCard.tsx:91` — токенизированный `bg-[var(--bg-overlay-90)]`. Для новых контролов поверх фото правильнее токен, но размер бери из `ProductCard` (`w-9 h-9 md:w-7 md:h-7`).

### 5.2 Карточка образа — `OutfitCard`

```tsx
// src/components/outfit/OutfitCard.tsx:42-49, 83, 106-110
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

Коллаж всегда через `OutfitCollage` (`src/components/outfit/OutfitCollage.tsx`) — в `saved/` и `builder/` он переписан руками пять раз и копии разошлись, см. раздел 11.

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
// saved/page.tsx:599-603
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
// saved/page.tsx:625, 634
```

**Ghost (текстовая)**:

```tsx
className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]
           transition-colors underline underline-offset-4"
// src/app/page.tsx:127
// либо анимированное подчёркивание утилитой .link-underline (globals.css:255)
className="text-xs text-[var(--foreground)] link-underline"   // browse/page.tsx:1476
```

**Icon (круглая)**:

```tsx
className="w-8 h-8 rounded-full flex items-center justify-center
           text-[var(--foreground-muted)] hover:text-[var(--foreground)]
           hover:bg-[var(--fg-overlay-05)] transition-all"
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

Фокус выражается **только цветом границы**. Ring/outline в проекте не определён нигде — это известная дыра, см. раздел 11.

### 5.5 Модалка

```tsx
// src/app/saved/page.tsx:717, 725
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

Нижний лист на мобильном — тот же контейнер с `rounded-t-2xl`, ручкой `w-8 h-[3px] rounded-full bg-[var(--border-strong)]` и классом `animate-slide-up` (`builder/page.tsx:2360`, `2425-2428`).

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

Единого рецепта скрима нет: в коде живут `bg-black/20` (`browse/page.tsx:923`, `Navigation.tsx:512`), `bg-black/40` (`StylistDrawer.tsx:667`), `bg-black/50` и `bg-black/60` (`saved/page.tsx:717,753`). Для новой модалки бери **`bg-black/60 backdrop-blur-sm`** — это большинство.

### 5.7 Чип / пилюля

Выбираемый чип:

```tsx
className={`px-4 py-2 rounded-full border text-[11px] tracking-[0.12em] uppercase font-medium
            transition-all duration-200 ${
  active
    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
    : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
}`}
// profile/page.tsx:869, browse/page.tsx:1084-1086
```

Пилюля-контрол тулбара:

```tsx
className="shrink-0 flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase font-bold
           border rounded-full px-3 sm:px-5 py-2.5 transition-all duration-200"
// browse/page.tsx:975-979
```

Информационный чип (не кликабельный):

```tsx
className="text-[9px] tracking-[0.16em] uppercase border border-[var(--border)]
           text-[var(--foreground-muted)] px-3 py-1.5 rounded-full capitalize"
// outfit/[id]/page.tsx:157
```

Расхождение: только в `browse/page.tsx` живут три несовместимые шкалы чипов (9px/`--foreground`, 10-11px/`--border`, 12px/`--border-strong`). Для нового кода — вариант 11px/`0.12em`/`--border-strong`.

### 5.8 Сегментированный контрол (табы)

Лучшая реализация в проекте:

```tsx
// src/app/saved/page.tsx:1400-1412
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

(Размер подписи приведён к `profile/page.tsx:204`; в `saved/page.tsx:1405` он `text-xs tracking-[0.12em]` — расхождение, см. раздел 11.)

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

Шиммера в проекте формально нет для карточек: класс `.animate-shimmer` (`globals.css:453`) существует, но для скелетонов не применяется — везде `animate-pulse`.

### 5.10 Пустое состояние

```tsx
// src/app/browse/page.tsx:1467-1478
<div className="py-24 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)] mx-2">
  <p className="text-xl font-semibold text-[var(--foreground)] mb-2">No {noun} found</p>
  <p className="text-sm text-[var(--foreground-muted)] mb-4">Try adjusting your search or filters</p>
  <button className="text-xs text-[var(--foreground)] link-underline">Clear all filters</button>
</div>
```

Расширенный вариант с CTA-кнопкой — `saved/page.tsx:1462-1471`: `py-20 px-8`, заголовок `text-2xl font-bold`, `mb-8` и primary-кнопка.

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

- **Focus-ring.** В `src/` `focus-visible` встречается ровно один раз — в мёртвом `ui/button.tsx:8`; в `globals.css` нет ни одного правила `:focus` / `:focus-visible`, зато `outline-none` встречается 47 раз. Канона нет. Если делаешь новый интерактивный элемент — предложи и заведи общее правило, а не копируй `outline-none` без замены.
- **Токены статусов** (успех/предупреждение/ошибка). В токенном слое их нет. В коде живут `emerald`/`green`, `amber`/`orange`, `red`/`rose` без dark-варианта. Фактическое большинство для ошибки — `border border-red-500/25 bg-red-500/10 text-red-400` (`report/page.tsx:351`), для успеха в админке — `emerald-*`.
- **Токен тени.** `--shadow-*` не существует. В коде — `shadow-md`, `shadow-xl`, `shadow-2xl` и инлайновые rgba (`StylistDrawer.tsx:681`, `Navigation.tsx:320`). Для плавающей панели бери `boxShadow: "0 8px 32px rgba(0,0,0,0.28)"` как в `Navigation.tsx:320`.
- **Токен z-index.** См. лестницу в разделе 3.
- **Toast/уведомление.** Общего компонента нет; каждое место рисует своё (`builder/page.tsx:3067`, `subscribe/page.tsx:296`).

---

## 6. Кнопки: особый случай

Факты, а не мнение:

- `src/components/ui/button.tsx` — shadcn-примитив с `cva`: 6 вариантов × 4 размера, базовый класс `rounded-md text-sm`, единственный в проекте `focus-visible`-ring (`button.tsx:8`).
- Импортирует его **ровно один файл** во всём `src/`: `src/components/blocks/hero-section-1.tsx:6`.
- Этот файл, в свою очередь, **не импортирует никто** — поиск `components/blocks` по `src/` даёт ноль.
- Значит, `<Button>` не рендерится нигде. Ноль живых использований против **434 сырых `<button>` в 47 файлах**.
- Его варианты не совпадают с реальным языком: `rounded-md` — 20 использований в проекте против 202 `rounded-xl` и 255 `rounded-full`; `text-sm` / `h-10` вообще не соответствуют uppercase-tracked рецептам.

Дополнительно `hero-section-1.tsx` экспортирует имя `HeroSection`, совпадающее с живым `src/components/home/HeroSection.tsx:8`, и это единственное место, где встречаются shadcn-семантические классы (`bg-muted`, `text-muted-foreground`). Он выглядит как дизайн-система, но не отгружается.

### Одно правило для новых кнопок

**Не импортируй `src/components/ui/button.tsx`. Собирай кнопку из рецептов раздела 5.3, дословно копируя один из четырёх вариантов (primary / secondary / ghost / icon) и меняя только текст и обработчик.** Если рецепт не подходит — это повод обсудить расширение системы, а не написать одиннадцатый вариант инлайном.

---

## 7. Движение и анимация

### Канонический easing

```
cubic-bezier(0.25, 0.46, 0.45, 0.94)
```

В JS — `[0.25, 0.46, 0.45, 0.94]`. Он повторён в `globals.css` 11 раз и продублирован как локальный `const EASE` минимум в трёх файлах (`AIStylistShowcase.tsx:20`, `OutfitExamplesCarousel.tsx:8`, `FeaturesBento.tsx:14`) плюс инлайном ещё в восьми. Общего модуля motion-токенов нет.

### Длительности

`150ms` — opacity-переключения; `200ms` — стандартный hover (`transition-colors duration-200`); `300ms` — раскрытия и slide-переходы; `500ms` — `img-zoom` и hover-скрим на изображении. Произвольные значения вроде `duration-[260ms]` (`ProductClient.tsx:161`) — единственный такой случай в проекте, не повторять.

### Классы `.animate-*` из `globals.css`

| Класс | Определение | Назначение |
|---|---|---|
| `.animate-fade-up` | `fadeUp 0.5s`, easing канон, `forwards` (`:187`) | Появление статичного блока снизу на 12px |
| `.animate-fade-in` | `fadeIn 0.4s ease forwards` (`:214`) | Простое появление оверлея/панели |
| `.animate-scale-in` | `scaleIn 0.4s`, `scale(0.97) → 1` (`:393`) | Появление карточки/модалки |
| `.animate-slide-up` | **определён дважды**: `:344` (`slideUp` 0.32s, канон-easing) и `:482` (`slide-up` 0.28s, `cubic-bezier(0.32,0.72,0,1)`) — выигрывает второй | Нижний лист на мобильном |
| `.animate-slide-in-right` | `slideInRight 0.38s` (`:368`) | Drawer справа (фильтры, стилист) |
| `.animate-slide-in-left` | `slideInLeft 0.3s` (`:381`) | Десктопный сайдбар |
| `.animate-overlay-in` | `overlayIn 0.25s ease` (`:446`) | Затемнение фона |
| `.animate-shimmer` | `shimmer-sweep 1.8s infinite` (`:453`) | Бегущий блик (в скелетонах не используется) |
| `.animate-progress-bar` | `progress-indeterminate 1.6s infinite` (`:461`) | Неопределённый прогресс |
| `.animate-scroll-hint` | `scroll-hint 2s infinite` (`:522`) | Стрелка «листай вниз» на hero |
| `.animate-hero-fade-in` / `.animate-hero-fade-up` | `0.7s` / `0.75s`, `cubic-bezier(0.16,1,0.3,1)` (`:538,541`) | Только hero и `/coming-soon` |
| `.ai-pulse` | `aiPulseRing 1.6s infinite` (`:207`) | Пульсирующее кольцо AI-кнопки |
| `.stagger-children` | задержки 0…420ms по `nth-child` (`:225-232`) | Каскад для CSS-анимаций |
| `.img-zoom` / `.card-zoom-layer` | `transform 0.5s`, `scale(1.05)` по hover (`:172-193`) | Зум фото в карточке |
| `.link-underline` | ширина `0 → 100%` за `0.3s` (`:255-269`) | Подчёркивание ссылки по hover |

### Framer-motion: появление карточек

Канонический паттерн — spring с блюром, на самой карточке:

```tsx
initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
viewport={{ once: true, margin: "-40px" }}
transition={{ type: 'spring', bounce: 0.2, duration: 0.8 }}
// src/components/product/ProductCard.tsx:132-135
```

Каскад в сетке задаётся на родителе, без повторного объявления анимации на детях:

```tsx
<motion.div
  initial="hidden" animate="show"
  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
>
// browse/page.tsx:1336-1337
```

Второй, tween-вариант для контентных секций (about, plans, главная):

```tsx
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, margin: "-60px" }}
transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
// src/components/ui/FadeInView.tsx:17-20
```

**Правило:** для карточек товаров/образов — spring из `ProductCard`; для контентных секций — `FadeInView`. Локальные копии `FadeCard` (`FeaturesBento.tsx:22`, `AIStylistShowcase.tsx:22`) — дубликаты `FadeInView` с разошедшимися значениями, не копируй их.

Другие spring, реально применяемые: `{ stiffness: 400, damping: 35 }` — пилюля таба (`saved/page.tsx:1408`); `{ stiffness: 380-500, damping: 38-42, mass: 0.8 }` — drawer и сегментированный переключатель.

### prefers-reduced-motion

Глобальный guard уже есть и покрывает **всё**, включая инлайновые `<style>`-анимации:

```css
/* src/app/globals.css:553+ */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

Дополнительно декоративные компоненты гасят себя сами: `FloatLoop.tsx:26`, `gooey-text-morphing.tsx:40`, `etheral-shadow.tsx:70`. **Любая новая непрерывная (loop) анимация обязана иметь такой же собственный guard** — глобальное правило обрежет длительность, но логику rAF-цикла не остановит.

---

## 8. Тёмная тема

- Тёмная тема — **по умолчанию**: `src/app/layout.tsx:75` отдаёт `<html className="dark ...">`.
- Скрипт без вспышки — `src/app/layout.tsx:81`:

```js
(function(){try{
  var t=localStorage.getItem('goo-theme');
  var dark = t==='dark' || (t==='system' && matchMedia('(prefers-color-scheme: dark)').matches) || (t!=='light' && t!=='system');
  document.documentElement.classList[dark?'add':'remove']('dark');
}catch(e){document.documentElement.classList.add('dark')}})()
```

Обрати внимание на логику: тёмная тема выбирается при **любом** значении, кроме `'light'` и `'system'`, и при ошибке. Пустой localStorage у нового посетителя → тёмная.

- Дальше состояние примиряет `ThemeProvider` (`src/lib/context/theme-context.tsx:61-71`), ключ хранения — `goo-theme`.
- Тема переключается **каскадом CSS**, а не JS. Компоненты, которые ветвятся на `useTheme()` и подставляют инлайновые стили (`Navigation.tsx:59-71`, `MobileBottomNav.tsx:13,92`), — исключение, а не образец. Единственный оправданный императивный случай — подмена растрового ассета, который нельзя переключить переменной.

### Правило

**Любой новый элемент проверяется в обеих темах перед коммитом.** Практический чек: если ты написал `text-white`, `bg-black/NN`, `#hex` или `rgba(255,255,255,α)` — ответь на вопрос «что это будет в светлой теме на `#F4F2EE`?». Если ответ «невидимо» или «инвертировано» — это баг. В разделе 11 половина подтверждённых high-расхождений — ровно этот случай.

---

## 9. goo-studio (админка)

`src/app/goo-studio/**` — **отдельный диалект на том же токенном слое**, а не дрейф. Это сознательное решение, его надо уважать.

Что общего: цвет только через те же CSS-переменные. Во всех 18 страницах админки ноль `text-gray-*` / `bg-neutral-*` / `border-zinc-*`.

Что отличается:

| Аспект | Публичный сайт | goo-studio |
|---|---|---|
| Фон холста | `--background` | `--surface` (`layout.tsx:590`) |
| Фон карточки | `--surface` | `--background` (`layout.tsx:594`, `analytics/page.tsx:49`) |
| H1 | `text-4xl md:text-5xl font-black uppercase` | `font-display text-2xl font-light` (`goo-studio/page.tsx:131`) |
| Большие числа | — | `font-display text-3xl font-light` |
| Компоненты | `ProductCard`, `.label`, `.img-zoom` | не используются вообще |
| Движение | framer `whileInView` + spring | CSS `animate-spin` / `animate-pulse`; framer только в `layout.tsx` и `page.tsx` |
| Статусы | нет токенов | `emerald` = ok, `amber` = warning/привилегия, `red` = ошибка, всегда как `bg-X-400/15 text-X-500 border border-X-400/30` (`layout.tsx:480`) |

### Правила для нового элемента в админке

1. Цвет — те же токены. Никаких сырых палитр Tailwind, кроме трёх семантических статусов выше.
2. Таблица: обёртка `rounded-xl border border-[var(--border)] overflow-hidden`, `thead` на `background: var(--surface)`, ячейки шапки `text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal` (`products/page.tsx:1692`, `goo-studio/page.tsx:321`).
3. Инпут: `rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm bg-transparent` (`products/page.tsx:191-194`).
4. Primary-кнопка: `bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg text-xs tracking-[0.12em] uppercase hover:opacity-80 disabled:opacity-40` (`products/page.tsx:1453`).
5. Заголовок страницы: `font-display text-2xl font-light` + подзаголовок `text-xs text-[var(--foreground-muted)] mt-1`.
6. Иконки — инлайновый SVG, `strokeWidth="1.2"`, 12-16px.
7. Модалка: скрим `bg-black/60`, панель `rounded-2xl border border-[var(--border)]` на `background: var(--background)`.
8. Пустое/загрузочное состояние — просто центрированный текст (`px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]`), не скелетон.
9. **Не использовать `dark:`-варианты Tailwind.** Админка задаёт тему инлайновым объектом переменных (`goo-studio/layout.tsx:231-239`), а `dark:` смотрит на глобальный `<html class="dark">` — это рассинхрон, см. раздел 11.

---

## 10. Чеклист для нового элемента

1. Цвет написан только как `bg-[var(--…)]` / `text-[var(--…)]` / `border-[var(--…)]`. Ни одного hex, rgba или `text-gray-*` — кроме `bg-white` под фото товара и `bg-black/NN` для контрола поверх фото.
2. Прозрачность взята из `--bg-overlay-*` / `--fg-overlay-*` / `--fg-on-dark-*`, а не как модификатор `/70` на переменной.
3. Элемент открыт **в обеих темах**. Ничего не пропало, ничего не инвертировалось.
4. Радиус лежит на шкале: `rounded-lg` / `rounded-xl` / `rounded-2xl` / `rounded-full`. Не `rounded-md`, не `rounded-[10px]`.
5. Поверхность — `bg-[var(--surface)] border border-[var(--border)]`, глубина границей, не тенью.
6. Размер текста — bracket-px по шкале раздела 2; ничего меньше 10px.
7. Uppercase-подпись — `tracking-[0.18em]` (или `0.14em` для навигации/CTA). Новых значений tracking не введено.
8. Контейнер — `max-w-[1440px] mx-auto px-6 md:px-12` (или `max-w-[1280px]` на главной), с шагом `md:` для паддинга.
9. Кнопка собрана из одного из четырёх рецептов 5.3. `ui/button.tsx` не импортирован.
10. Карточка товара/образа — импортирован `ProductCard` / `OutfitCard`, а не переписана разметка.
11. Анимация — либо spring `{ type:'spring', bounce:0.2, duration:0.8 }` (карточки), либо `FadeInView` (секции), easing `[0.25,0.46,0.45,0.94]`. Длительность из набора 150/200/300/500.
12. Непрерывная анимация имеет собственную проверку `prefers-reduced-motion`.
13. Интерактивный элемент имеет `aria-label` / `aria-expanded` / `aria-pressed` там, где смысл не читается из текста; модальный слой — `role="dialog" aria-modal="true"`.
14. Если поставил `outline-none` — рядом стоит видимая замена фокуса. Если её нет — не ставь `outline-none`.
15. Ничего не скопировано из `src/components/blocks/hero-section-1.tsx`, `src/components/ui/parallax-floating.tsx`, `HeroBackground.tsx`, `animated-group.tsx`, `ProductGallery.tsx`, `SectionLabel.tsx`, `FeaturesBento.tsx`, `HowItWorksGrid.tsx`, `AIStylistChat.tsx`, `HeroProductCycle.tsx` — это мёртвый код с конкурирующим языком.

---

## 11. Найденные расхождения

**Это наблюдения аудита, а не выполненная работа. Ни одна правка из этой таблицы в код не внесена. Каждая строка требует отдельной задачи, приоритизации и проверки — самовольно чинить их по этому списку нельзя.**

Сортировка: high → medium → low.

### High

| Файл:строка | Что не так | Чем заменить |
|---|---|---|
| `src/components/home/AIStylistShowcase.tsx:547` | Ниже `lg` карточка `bg-transparent border-0`, но Intro внутри безусловно белый (`text-white`, `white/40`, `white/55`, тайлы `border-white/10 bg-white/[0.03]`) — на телефоне в светлой теме весь блок белым по `#F4F2EE`, практически невидим | Оставить тёмную подложку на всех ширинах (`bg-[#0A0A0A] border border-white/10`) либо сделать типографику Intro тематической |
| `src/components/ui/etheral-shadow.tsx:42` (и `:67`) | Блобы `rgba(0,0,0,0.14)` и зерно `rgba(0,0,0,0.045)` без ветки темы, а компонент смонтирован на `bg-[var(--background)]` (`HeroSection.tsx:19,23`), который по умолчанию `#0A0A0A` — чёрное по чёрному, при этом анимации крутятся | Цвет блоба и зерна из токенов: `var(--fg-overlay-08)` / `var(--fg-overlay-05)` |
| `src/components/outfit/OutfitCarousel.tsx:107` | CTA «VIEW OUTFIT» вне фото (блок Info начинается на `:94`) собран из `border-white/30 text-white/60 bg-black/60`; в светлой теме — тёмная пилюля с контрастом ~2.5:1 на кремовом фоне | `border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]` (`saved/page.tsx:634`) |
| `src/app/builder/page.tsx:2710` | Primary «Show results» в мобильном фильтр-листе — `bg-white text-black`, при том что весь лист рядом токенизирован, а соседняя кнопка `:2707` использует `--border-strong`; в светлой теме белая кнопка на почти белом фоне | `bg-[var(--foreground)] text-[var(--background)] hover:opacity-90` (`builder/page.tsx:1867`, `saved/page.tsx:602`) |
| `src/app/browse/page.tsx:656` (и `:670`) | Кольцо невыбранного чекбокса категории — `rgba(255,255,255,0.2)`; в светлой теме на `#F4F2EE` невидимо. Соседние индикаторы (`:587`, `:801`) корректно берут `var(--border-strong)` | `borderColor: checked ? "var(--foreground)" : "var(--border-strong)"` |
| `src/components/product/ProductReviews.tsx:199` + системно | `outline-none` без замены; во всём `src/` ровно одно вхождение `focus-visible` (в мёртвом `ui/button.tsx:8`), в `globals.css` нет ни одного правила `:focus-visible`, `outline-none` — 47 раз. Клавиатурная навигация по PDP, browse, builder не индицируется | Глобальное правило в `globals.css`: `:focus-visible { outline: 2px solid var(--border-strong); outline-offset: 2px; }` |
| `src/app/goo-studio/layout.tsx:231` | Админка переопределяет тёмную тему инлайновым объектом из семи хексов вместо класса `.dark`, теряя `--fg-overlay-*`, `--bg-overlay-*`, `--fg-on-dark-*`. Админка при этом эти токены использует (`users/page.tsx:107,932`, `analytics/page.tsx:141,255,424`) — они разрешаются из глобального `<html>`, давая тёмную заливку на тёмной поверхности | Переключать класс `.dark` на корне админки, чтобы применялся весь набор из `globals.css:47-64` |
| `src/app/goo-studio/products/page.tsx:1390` (также `:587,592,1658,2359,2627-2628`) | `dark:`-варианты внутри админки смотрят на глобальный `<html class="dark">`, а не на локальную тему (`goo-studio/layout.tsx:275` стартует с `"light"`) — баннеры рендерят тёмное оформление в светлом хроме и не реагируют на переключатель | Рецепт админки без `dark:`: `bg-amber-400/15 text-amber-500 border border-amber-400/30` (`goo-studio/layout.tsx:480`) |
| `src/app/goo-studio/analytics/Charts.tsx:256` | Ссылка на `--foreground-rgb`, которой нет нигде в репозитории; всегда срабатывает fallback `0,0,0` — все столбцы воронки кроме первого рисуются чёрным на `var(--surface)` | `background: "var(--foreground)"` + убывающая `opacity` на элементе (`analytics/page.tsx:297`) |
| `src/app/goo-studio/analytics/Charts.tsx:26` | Палитра recharts — пять сырых хексов серого (`#6b7280…#1f2937`), не реагируют на тему: `#1f2937`/`#374151` исчезают на тёмном фоне, `#d1d5db` — на светлом | Рампа из токенов: `color-mix(in srgb, var(--foreground) N%, var(--surface))` (`analytics/page.tsx:497`) |

### Medium

| Файл:строка | Что не так | Чем заменить |
|---|---|---|
| `src/components/layout/Navigation.tsx:60` | Хедер строит параллельную палитру из 12 хекс/rgba-констант в JS вместо токенов; светлое значение `#ffffff` соответствует `--surface`, а не `--background` (`#F4F2EE`) | Токены, как в `MobileBottomNav.tsx:91,111,116-117` |
| `src/components/layout/Navigation.tsx:112` | Полный токенный путь стилей (`headerBg`, `logoColor`, `linkActive`, `linkMuted`, `iconColor`) объявлен и нигде не используется; из-за этого scroll-listener `:106-110` не даёт визуального эффекта | Подключить переменные к `<header>` либо удалить их вместе со `scrolled`, `showWhiteText` и слушателем |
| `src/components/layout/ConditionalSiteLayout.tsx:53` | Зазор под нижнюю навигацию задан дважды — на `<main>` и на обёртке футера; на мобильном добавляет ~72px пустоты перед футером | Оставить только на последнем элементе потока |
| `src/components/layout/Footer.tsx:87` | Вордмарк в футере — Inter Tight `font-black tracking-[0.2em] text-3xl`, в хедере — Poppins 800 / 22px / `tracking-[0.18em]` (`Navigation.tsx:147-148`) | Общий `<Wordmark>` по рецепту хедера |
| `src/app/page.tsx:42` | `.label` не применён нигде, каждый eyebrow объявляет свои значения | Привести `.label` к реальному намерению и применить, либо стандартизовать строку |
| `src/app/globals.css:246` | `.label` и `src/components/ui/SectionLabel.tsx` — мёртвые; цвет утилиты (`--foreground-muted`) расходится с фактическим использованием: 59 вхождений `--foreground-subtle` против 47 `--foreground-muted` | Сначала решить вопрос цвета, потом либо принять утилиту, либо удалить |
| `src/components/home/AIStylistShowcase.tsx:22` | Третья копия одного и того же fade-обёртки (`FadeInView` y=20/0.45, `FeaturesBento.tsx:22` y=28/0.45, здесь y=28/0.5) | Импортировать `FadeInView`, удалить локальные `FadeCard` |
| `src/app/browse/page.tsx:1365` (и `:1345`) | Обёртка грида повторяет анимацию, которую карточка уже играет сама (`ProductCard.tsx:132-135`) — два независимых определения на одно появление | Оставить каскад на родителе, анимацию — на карточке |
| `src/app/browse/page.tsx:937` | Модальный drawer без `role="dialog"`, `aria-modal`, `aria-label`; во всём файле ноль `aria-` при ~40 рукописных кнопках | `role="dialog" aria-modal="true" aria-label="Filters"` + `aria-expanded` на заголовках фасетов |
| `src/app/browse/page.tsx:605` (также `522,534,553,690,723,764,829,941`) | Девять заголовков фасетов с инлайновым `textShadow: 0 0 14px rgba(255,255,255,0.4)` — эффект только для тёмной темы | Убрать `textShadow` либо завести тематический токен |
| `src/app/builder/page.tsx:901` (также `866,890,988,1022,1062,1132,2432`) | То же самое, восемь заголовков в фильтр-панели билдера | Обычный eyebrow-рецепт без тени |
| `src/app/browse/page.tsx:575` (также `586,617,639,655,707,798,808,839`) | Приглушённый текст = `text-[var(--foreground)]` + четыре разных шага `opacity` (40/50/55/60) вместо `--foreground-muted`, который в этом же файле используется 18 раз | Одна пара: `--foreground` / `--foreground-muted` |
| `src/app/browse/page.tsx:93` | Три несовместимых рецепта чипа на одном экране (9px/`--foreground`, 10-11px/`--border`, 12px/`--border-strong`) | Один масштаб чипа, `--border-strong` в покое |
| `src/components/product/PriceHistoryChart.tsx:167` (и `:199`) | Ось Y и метки High/Low хардкодят `$`, тогда как тултип на `:230` использует `formatPrice` из контекста валют — на одном графике `€49.00` и `$49` | `{formatPrice(tick)}` |
| `src/components/product/ProductClient.tsx:199` | Eyebrow в одном файле написан вручную в восьми местах с пятью разными tracking (0.12/0.14/0.18/0.2em) | Один рецепт eyebrow |
| `src/components/outfit/OutfitCard.tsx:43` | `rounded-2xl` + tween 0.35s против канона `rounded-xl` + spring с блюром (`ProductCard.tsx:131-135`); карточки стоят в одних сетках | Привести к рецепту `ProductCard` |
| `src/app/saved/page.tsx:455` (также `:861`, `builder/page.tsx:1994`, `:2263`) | Алгоритм коллажа переписан пять раз вместо `OutfitCollage`; копии разошлись — вариант с 6 предметами в билдере отсутствует, один и тот же образ рисуется по-разному | Один параметризованный `OutfitCollage` |
| `src/app/saved/page.tsx:553` | Оверлей-бейдж написан тремя способами: токен (`OutfitCard.tsx:70`), `bg-black/55 text-white` (здесь), `bg-black/60 … text-white` (`outfit/[id]/page.tsx:108`) | `bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)]` |
| `src/app/saved/page.tsx:1405` | Два соседних сегментированных контрола расходятся по типографике: `text-xs tracking-[0.12em]` против `text-[10px] tracking-[0.16em]` (`profile/page.tsx:204`) | Одна шкала подписи |
| `src/app/builder/page.tsx:2196` (также `2388,2800,2839`) | Внесистемное золото `#c9a84c` как акцент подтверждения выбора; в остальном коде выбранное состояние — `var(--foreground)` (`builder/page.tsx:1451-1453`) | `bg-[var(--foreground)]` с обводкой `var(--background)` |
| `src/app/builder/page.tsx:3051` (также `2971,2981,2309,3019,3028,3107`) | Шаг try-on и часть листов сбрасывают шкалу радиусов — прямоугольные контролы внутри `rounded-2xl`-модалок | `h-11 rounded-xl` для primary, `rounded-lg/xl` для превью и бейджей |
| `src/app/builder/page.tsx:3067` | Тост ошибки: `text-red-600` на `border-red-300`, без радиуса и без тёмной темы; `border-red-300` встречается всего дважды в репозитории | Домовый рецепт: `rounded-xl border border-red-500/25 bg-red-500/10 text-red-400` |
| `src/components/outfit/OutfitActions.tsx:50` | Primary-кнопка существует в пяти несовместимых формах (`rounded-full px-8 py-4`, `rounded-xl h-11`, `rounded-xl px-3 py-2.5` и т.д.) | Один рецепт (`saved/page.tsx:599`) плюс, при необходимости, задокументированная компактная пара |
| `src/app/plans/page.tsx:191` | Карточка тарифа залита `bg-[var(--background)]` — цветом страницы под ней, при этом шапка таблицы на этой же странице (`:283`) использует `--surface` | `bg-[var(--surface)]` |
| `src/app/subscribe/page.tsx:267` | Радиус меняется посреди воронки: `/plans` полностью скруглена, `/subscribe` — единственный `rounded` во всём файле это спиннер, блок сводки и все четыре кнопки прямоугольные | `rounded-2xl` контейнер, `rounded-xl` кнопки |
| `src/app/subscribe/page.tsx:296` | Ошибка оплаты: `text-red-500` на `border-red-300`, прямоугольная, без тёмной темы, вразрез с `report/page.tsx:351` | Единый токенизированный рецепт ошибки |
| `src/components/upgrade/UpgradeModal.tsx:49` | Модалка без `backdrop-blur`, без анимации появления и без кнопки закрытия — только клик по фону и текстовая ссылка | `backdrop-blur-sm` + `animate-fade-in` на скриме, анимация и крестик на панели |
| `src/app/report/page.tsx:306` | Подпись «max 10MB», при этом `processFile` отклоняет всё больше 3.5MB (`:63-64`) | «optional · max 3.5MB» |
| `src/app/not-found.tsx:15` (и `error.tsx:28`) | `var(--muted-foreground)` не определена нигде (в `@theme inline` объявлена `--color-muted-foreground`, другое имя) — всегда срабатывает литерал `rgba(128,128,128,0.9)`, одинаковый в обеих темах | `text-[var(--foreground-muted)]` |
| `src/components/ui/button.tsx:8` / `:42` | Мёртвый примитив: единственный импортёр — `blocks/hero-section-1.tsx:6`, который сам никем не импортируется. Рядом 434 рукописных `<button>`, разошедшихся по паддингам и границам | Удалить вместе с `hero-section-1.tsx` либо перекроить варианты под реальные рецепты и внедрить |
| `src/components/blocks/hero-section-1.tsx:30` / `:84` | Мёртвый шаблонный файл: экспортирует имя `HeroSection`, конфликтующее с живым; единственный носитель shadcn-классов, сырой палитры `zinc`, градиента `#9B99FE→#2BC8B7`, `<img>` на внешние CDN и заголовка вне шкалы | Удалить |
| `src/app/blog/[slug]/page.tsx:99` | Чип категории на странице поста без `rounded-full`, тогда как на листинге (`blog/page.tsx:87`) строка идентична плюс радиус | Добавить `rounded-full` |
| `src/app/blog/[slug]/page.tsx:165` | Те же три карточки постов рисуются двумя разными грамматиками: `gap-4` + `rounded-xl border` на листинге против `gap-px` hairline без границ и радиуса на странице поста | Привести к рецепту листинга |
| `src/app/goo-studio/analytics/page.tsx:219` (также `234,239,246,270,275,284,338,367,392,417,447`) | Внутри одного файла карточки одной семантики то `rounded-xl`, то без радиуса — плоские боксы стоят рядом со скруглёнными | `rounded-xl border border-[var(--border)]` (`analytics/page.tsx:49`) |
| `src/app/goo-studio/analytics/page.tsx:139` | Три формы одного сегментированного фильтра в админке: `rounded-full` в products, `rounded-full` другого размера в users, прямоугольная группа в analytics | Один рецепт пилюли (`products/page.tsx:1486`) |
| `src/app/goo-studio/settings/page.tsx:428` (и `:403`) | Единственная страница админки, не использующая рецепт H1 — вместо `font-display text-2xl font-light` стоит 14px uppercase-подпись | `font-display text-2xl font-light` |
| `src/app/goo-studio/settings/page.tsx:512` (также `777,905,995,1097`, `ImageCropEditor.tsx:308,315`) | Primary-кнопка админки без радиуса, тогда как в products и layout она `rounded-lg` | Добавить `rounded-lg` |
| `src/app/goo-studio/settings/page.tsx:517` (также `721,788,807,819,874`) | Успех выражен шкалой `green-*`, тогда как остальные 11 файлов админки используют `emerald-*` | `emerald-*` |
| `src/app/goo-studio/settings/page.tsx:844` (также `1006,1108`) | Инпут написан вручную: потерян `rounded-lg`, `bg-transparent` заменён на `bg-[var(--surface)]`, размер `text-[12px]` вместо `text-sm` | Общий рецепт инпута админки |
| `src/app/goo-studio/users/page.tsx:101` | В админке нет ни одного focus-стиля: инпуты — только смена цвета границы, кнопки (включая массовое удаление `:402`) — только hover | Токенный ring в общие рецепты |

### Low

| Файл:строка | Что не так | Чем заменить |
|---|---|---|
| `src/components/layout/Navigation.tsx:451` | Sign up — единственная интерактивная поверхность в хроме без радиуса | Добавить `rounded-full` |
| `src/components/layout/Navigation.tsx:512` | Три рецепта скрима: `bg-black/20`, инлайновый `rgba(0,0,0,0.45)`+blur, `bg-black/40` в `StylistDrawer.tsx:667` | Один токенизированный скрим |
| `src/components/layout/Navigation.tsx:600` | Кнопки модалки выхода собраны из ~10 инлайновых свойств, `borderRadius: 10`; оболочка модалки `borderRadius: 20` против `rounded-2xl` у соседних панелей | `rounded-xl` кнопки, `rounded-2xl` оболочка |
| `src/components/layout/Navigation.tsx:391` | `z-[60]` совпадает со слоем `StylistDrawer.tsx:653` при отсутствии шкалы z-index | Именованная лестница в `globals.css` |
| `src/components/layout/Footer.tsx:58` | Ссылки мобильного дерева реагируют только на `active:`, десктопного — на `hover:` | Добавить `hover:` |
| `src/components/layout/Footer.tsx:110` | Единственное место в хроме с именованной шкалой размеров (`text-xs/sm/2xl/3xl`) вперемешку с bracket-px в том же файле | Одна форма записи на файл |
| `src/app/page.tsx` / `AIStylistShowcase.tsx:20` | Канонический easing продублирован как локальный `const EASE` в трёх файлах и инлайном ещё в восьми | Один экспорт `EASE_STANDARD` |
| `src/components/home/AIStylistShowcase.tsx:495` (и `:507`) | Два tracking для eyebrow в одном компоненте: `0.22em`+`font-medium` против `0.18em` без веса | Одно значение |
| `src/components/home/AIStylistShowcase.tsx:590` | Контейнер `px-6` без шага `md:px-12`, в отличие от всех соседних секций; блок виден с 768 до 1023px | `px-6 md:px-12` |
| `src/components/home/HowItWorksSection.tsx:224` | Рецепт H2 скопирован вместо `SectionH2`, базовый шаг 26px вместо 30px (цвет `text-white` здесь корректен — секция на `#050505`) | Экспортировать `SectionH2` с вариантом `onDark` |
| `src/components/home/HowItWorksSection.tsx:40` | Комментарий утверждает идентичность с кнопкой лайка карточки, но размер `w-8 h-8 bg-black/85` против `w-9 h-9 md:w-7 md:h-7 bg-black/80` | Совместить размер или убрать утверждение из комментария |
| `src/components/home/FeaturesBento.tsx:236` (и `:354`) | Единый CTA «в билдер» существует в трёх радиусах и двух весах | Один радиус кнопки |
| `src/components/home/FeaturesBento.tsx:203` | Четыре геометрии точек-пейджера (24/8, 20/6, 18/6, w-5/h-1.5) | Один `<Dots>` с `tone` |
| `src/components/home/FeaturesBento.tsx:57` / `:249` | `FeaturesBento`, `HowItWorksGrid`, `AIStylistChat`, `HeroProductCycle` — мёртвый код с конкурирующим языком (четвёртый радиус, пятый eyebrow, хексы `#111`/`#D4CEC2`) | Удалить или вынести в `_archive/` |
| `src/app/browse/page.tsx:1312` | Скелетон инвертирует поверхности карточки: оболочка `--background`, блоки `--surface`, тогда как загруженная карточка — `--surface` | Оболочка `--surface`, блоки `--fg-overlay-05` |
| `src/app/browse/page.tsx:1344` | Обёртка `rounded-xl` вокруг `rounded-2xl` `OutfitCard` — hover-тень обрезается по меньшему радиусу | Снять радиус/фон с обёртки |
| `src/app/browse/page.tsx:1422` | Активная страница пагинации `rounded-lg`, тогда как все прочие выбранные контролы — `rounded-full` пилюли | `rounded-full` |
| `src/app/browse/page.tsx:886` | Две outline-кнопки одного класса разного масштаба и радиуса («Show more» против «Clear filters») | Один outline-рецепт |
| `src/components/ui/SectionLabel.tsx:23` | Мёртвый компонент, дублирующий `.label` с другим цветовым токеном | Удалить или применить `.label` |
| `src/components/ui/ClampedText.tsx:144` | Вуаль клампа уходит в `--background`, но компонент используется и внутри `--surface`-панелей — виден переход | Цвет вуали параметром |
| `src/components/product/ProductGallery.tsx:80` | Мёртвый файл со старым языком (без радиусов, `gap-px` полоса, `ring-1 ring-inset`) — ловушка для того, кто будет расширять галерею | Удалить |
| `src/components/product/PriceHistoryChart.tsx:230` | Тултип и скелетон — единственные поверхности PDP без радиуса | `rounded-lg` / `rounded-xl` |
| `src/components/product/ProductReviews.tsx:168` | «Load more» и кнопка отправки различаются шкалой подписи и паддингом; обе без радиуса | Привести к outline-рецепту PDP (`ProductClient.tsx:442`) |
| `src/components/product/ProductClient.tsx:161` | Магические 260ms в трёх местах (`duration-[260ms]` + два `setTimeout`), единственная произвольная длительность в проекте | Именованная константа, лучше `duration-300` |
| `src/app/builder/page.tsx:1867` | `bg-[var(--foreground)]/70` — модификатор непрозрачности на переменной вопреки договорённости `globals.css:37` (технически на Tailwind v4 работает) | Предвычисленный токен или `opacity-70` на элементе |
| `src/app/builder/page.tsx:1902` | `var(--surface-hover, var(--surface))` — токен `--surface-hover` не определён нигде, hover нулевой | `hover:bg-[var(--fg-overlay-05)]` |
| `src/app/builder/page.tsx:2360` | `.animate-slide-up` объявлен в `globals.css` дважды (`:344` 0.32s и `:482` 0.28s) — выигрывает второй, первый мёртв | Оставить одно объявление (кейфреймы `slideUp` нужны `.stylist-drawer-animate`) |
| `src/components/outfit/OutfitCollage.tsx:63` | Разделители коллажа — `bg-gray-200`, единственное сырое серое вне админки (плашки `bg-white` при этом корректны) | `bg-[var(--border)]` |
| `src/components/outfit/OutfitCard.tsx:91` | Размер кнопки лайка `md:w-8 md:h-8` против `md:w-7 md:h-7` у `ProductCard.tsx:217`. При этом заливка здесь как раз токенная, а у `ProductCard` — сырая | Совместить размер на `md:w-7 md:h-7`, заливку двигать к токену |
| `src/app/outfit/[id]/page.tsx:228` | Обёртка `rounded-xl` вокруг `rounded-2xl` `OutfitCard` | `rounded-2xl` |
| `src/app/plans/page.tsx:197` | Бейдж «Most popular» — `text-[8px]`, ниже пола шкалы | `text-[10px]` |
| `src/app/plans/page.tsx:211` | Разделитель `border-current/10` — единственная граница вне токенного набора | Ветвление на `--fg-on-dark-60`/`--border` |
| `src/app/subscribe/page.tsx:11` | `PLAN_COPY` дословно дублирует массивы `features` из `plans/page.tsx:20-26,37-44,55-62`; обе страницы дублируют цены, которыми владеет `lib/plans.ts` | Один экспорт в `src/lib/plans.ts` |
| `src/components/auth/AuthForm.tsx:58` | Primary Clerk-кнопки `text-xs` без `font-mono`, тогда как весь остальной CTA воронки — `text-[10px]` | `text-[10px]` |
| `src/app/coming-soon/page.tsx:56` | Инлайновый `<style>` переобъявляет `fadeUp`/`fadeIn` из `globals.css`, а `dotPulse` определён дважды с разной начальной непрозрачностью (0.35 здесь, 0.4 в `FeatureCarousel.tsx:413`) — две точки на экране пульсируют по-разному | Один `dotPulse`; глобальный reduced-motion guard эти анимации, вопреки исходному предположению, покрывает |
| `src/app/sitemap-page/page.tsx:89` (и `:105`) | Outline-CTA без `rounded-xl`, в отличие от `about/page.tsx:213,244` (локально согласуется с hairline-сеткой страницы) | `rounded-xl` |
| `src/components/stylist/StylistDrawer.tsx:899` (и `:908`) | Ширина карточки задана инлайновым `style={{ width: 72 }}`, а изображение внутри — классом `w-[72px]` | Класс в обеих ветках |
| `src/components/stylist/StylistPersonalizationModal.tsx:277` | Две кнопки одного футера имеют `disabled:opacity-30` и `-40` (по проекту: 25 / 52 / 9 использований трёх значений) | `disabled:opacity-40 disabled:cursor-not-allowed` |
| `src/components/ui/parallax-floating.tsx:29` | Мёртвый код и единственный потребитель `src/hooks/use-mouse-position-ref` | Удалить оба |
| `src/components/ui/HeroBackground.tsx:10` | Мёртвый код; единственный компонент, читающий тему императивно через `useTheme()` | Удалить или задокументировать исключение |
| `src/components/ui/animated-group.tsx:140` | Достижим только через мёртвый `hero-section-1.tsx`; несёт десятый набор пресетов анимаций, расходящийся с каноном (`blur(4px)` против `blur(8px)`) | Удалить вместе с `hero-section-1.tsx` |
| `src/app/blog/page.tsx:61` | Eyebrow с `tracking-[0.22em]` вместо доминирующих `0.18em` | `tracking-[0.18em]` |
| `src/app/privacy/page.tsx:196` | `font-mono` как типографический сигнал при том, что `--font-mono` разрешается в Inter Tight (177 вхождений — визуальный no-op) | Либо реальный моноширинный стек в `globals.css`, либо убрать класс |
| `src/app/goo-studio/analytics/page.tsx:159` | Тот же баннер ошибки со скруглением на одной странице админки и без — на соседней (`goo-studio/page.tsx:147`) | Добавить `rounded-xl` |
| `src/app/goo-studio/layout.tsx:638` | Непрозрачность скрима подбирается по месту: `black/40`, `/50`, `/60`, `/70` и один инлайновый `rgba(0,0,0,0.5)` | Один класс `bg-black/60` |
| `src/app/goo-studio/page.tsx:65` | Декоративная четырёхцветная полоска (`blue/purple/emerald/amber`) на карточках дашборда, назначается по индексу массива; единственные синий и фиолетовый в админке | Убрать либо привязать к семантике |
| `src/app/goo-studio/users/page.tsx:431` | Ячейка шапки таблицы отличается от рецепта по трём осям (9px, `--foreground-subtle`, `font-medium`) | `text-[10px] … text-[var(--foreground-muted)] font-normal` |
| `src/app/goo-studio/users/page.tsx:478` | Карта `planBadge` (`:50-55`) задаёт только цвет и **не задаёт радиус вообще**, поэтому плашка плана рендерится прямоугольной; по остальной админке аналогичные плашки разъехались на три радиуса (`rounded-full` ×4, `rounded-lg` ×7, `rounded-md` ×5) | Добавить радиус в саму карту `planBadge` и свести все плашки к `rounded-full` — `rounded-md` вне шкалы (раздел 4) |
| `src/components/admin/ImageCropEditor.tsx:154` | Редактор кадрирования и его модалка на русском, вся остальная админка на английском | Привести к английскому |
