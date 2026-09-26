# Дизайн-система Goo Fashion

Этот файл — описание того, что **уже есть** в коде `goo-fashion`, а не пожелание на будущее. Он нужен разработчику (человеку или агенту), который собирается добавить новый элемент интерфейса: прочитал — и сделал так, чтобы новое было неотличимо от существующего.

Все правила выведены из фактического кода со ссылками вида `файл:строка`. Если у чего-то канонического примера в коде нет — здесь так и написано, а не придумано.

> **Сверено с кодом 2026-09-26**, после UX-правок 2026-09-12 и код-ревью сентября 2026 (`docs/CODE_REVIEW_2026-09.md`). Разделы 1, 6, 9, 10 и 11 перепроверены целиком. В разделах 2–8 исправлены найденные устаревшие утверждения (кольцо фокуса, токены и классы движения, `dark:`, Poppins, мёртвые источники рецептов) и обновлены ссылки на `ProductCard`, `OutfitCard`, `Navigation`, модалки и скримы, но остальные номера строк и часть счётчиков там сняты ещё 2026-08-20 и местами сдвинулись: `saved/page.tsx` с тех пор разнесён на `saved/page.tsx` и `src/components/look/MyLooksPanel.tsx`, шаг выбора стиля билдера переехал в `src/components/look/StylePicker.tsx`, `builder`, `browse` и `ProductClient` переписывались. Ищи рецепт по фрагменту класса, а не по номеру строки.

Характер дизайна: editorial-минимализм. Тёплый светлый фон (`#F4F2EE`) и почти чёрный тёмный (`#0A0A0A`), **тёмная тема — по умолчанию**, один шрифт (Inter Tight), монохром без акцентного цвета, крупные плотно-трекованные заголовки и мелкие uppercase-подписи, глубина выражается границей в 1px, а не тенью.

---

## 1. Токены — единственный источник цвета

Определены в `src/app/globals.css:43-82`: светлый набор — в блоке `:root, .admin-theme-light`, тёмный — в блоке `.dark, .admin-theme-dark`. Вторые селекторы нужны админке, у которой своя тема (раздел 9). Светлый блок обязан стоять раньше тёмного: `:root` и `.dark` равны по специфичности, и на `<html>` побеждает правило, записанное позже (комментарий `globals.css:37-42`).

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
| `--home-nav-h` | `66px` | — | Высота плавающего хедера; синхронизируется из `HomeFullPageScroll` (`globals.css:141-146`) |
| `--home-bottom-nav-h` | `calc(4.5rem + env(safe-area-inset-bottom))` | — | Полоса под мобильную нижнюю навигацию |

Токены движения (`--ease-*`, `--dur-*`) лежат в отдельном блоке `:root` выше, вместе со шрифтами (`globals.css:13-35`, движение — `:19-34`), и описаны в разделе 7. В админке они не переобъявляются.

Блок `@theme inline` (`globals.css:6-11`) теперь держит только кривые движения `--ease-out` / `--ease-in-out` / `--ease-drawer`, из которых Tailwind делает утилиты `ease-out`, `ease-in-out`, `ease-drawer`. shadcn-имена `--color-background`, `--color-muted-foreground` и остальные `--color-*` удалены при ревью 2026-09. Классы `bg-background`, `text-muted-foreground`, `bg-primary`, `bg-accent` и подобные остались только в двух мёртвых файлах, `src/components/ui/button.tsx` и `src/components/blocks/hero-section-1.tsx` (оба ждут удаления, раздел 6), и больше ни во что не компилируются. Не используй их.

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
2. **`bg-black/NN` для контрола, лежащего поверх фото.** `ProductCard.tsx:147,161` — кнопки корзины и лайка. Здесь фон не тема, а фотография.
3. **Семантические статусы** (`emerald` / `amber` / `red`) — токенов для них в системе **нет**. В админке для них есть устоявшийся рецепт (раздел 9), на публичном сайте — нет (раздел 11).

### Зачем `--*-overlay-*` и когда их брать

Комментарий в `globals.css:54` объясняет причину: «pre-computed semi-transparent variants (avoids Tailwind v4 opacity modifier issues with CSS vars)». Проектная договорённость — **не писать `bg-[var(--foreground)]/70`**, а брать готовую переменную.

Практическое замечание, где данные расходятся: на Tailwind v4 (в проекте `tailwindcss ^4`) модификатор непрозрачности на `var()` компилируется в `color-mix()` и технически работает — так что `src/app/builder/page.tsx:1911` ничего не ломает. Но конвенция остаётся: берём предвычисленный токен, потому что он даёт одинаковый результат в обеих темах и не зависит от версии Tailwind.

Когда что:

- фон бейджа/оверлея поверх изображения → `bg-[var(--bg-overlay-90)]` (`OutfitCard.tsx:68`);
- плотная плавающая панель (нижняя навигация) → `bg-[var(--bg-overlay-95)]` (`MobileBottomNav.tsx:91`);
- hover-заливка кнопки/строки → `hover:bg-[var(--fg-overlay-05)]` (`browse/page.tsx:92`, `StylistDrawer.tsx:734`);
- активное состояние, hover-скрим на картинке → `bg-[var(--fg-overlay-08)]` (`OutfitCard.tsx:81`, `MobileBottomNav.tsx:111`);
- текст на поверхности, залитой `--foreground` → `text-[var(--fg-on-dark-60)]` / `-70` / `-80` (`plans/page.tsx:212,246`, `profile/page.tsx:924`).

---

## 2. Типографика

Шрифт **один** — Inter Tight, подключённый через `next/font`. `globals.css:15-17` присваивает `--font-body`, `--font-display` и `--font-mono` одно и то же семейство.

Следствие: **класс `font-mono` — визуальный no-op.** Он встречается в `src/` около 180 раз (`MobileBottomNav.tsx`, `plans/page.tsx`, `StylePicker.tsx` и т.д.) и не даёт никакого контраста. Не добавляй `font-mono` ради «технического» вида — он ничего не делает. Существующие использования читай как семантический маркер, не как шрифт.

Отдельно: `var(--font-poppins)` применяется инлайновым `style` в четырёх живых местах — вордмарк в хедере (`Navigation.tsx:171`, weight 800), вордмарк формы входа (`AuthForm.tsx:294`), крупная «404» на `not-found.tsx:8` и вордмарк GOO на `error.tsx:21` — плюс в мёртвом `/coming-soon`. Для нового UI Poppins не берём.

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

Честно: **`.label` не применён нигде** — поиск `className="label"` по `src/` даёт ноль. Компонент `src/components/ui/SectionLabel.tsx`, кодирующий тот же рецепт, тоже никем не импортируется (мёртв, ждёт удаления). Все ~129 eyebrow написаны руками, и половина из них берёт `--foreground-subtle`, а не `--foreground-muted` из утилиты (66 против 56 на 2026-09-26; на публичном сайте почти все — `--foreground-subtle`, `--foreground-muted` дают в основном шапки таблиц админки). То есть утилита и реальность расходятся по цвету — это открытый вопрос, а не решённый.

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
  <div className="max-w-[1440px] mx-auto px-6 md:px-12">
    {/* ... */}
  </div>
</div>
```

Источники: `Navigation.tsx:133`, `Footer.tsx:27`, `product/[id]/page.tsx:74`, `saved/page.tsx:208`, `profile/page.tsx:185`, `about/page.tsx:11`, `blog/page.tsx:57` — около 20 файлов.

`max-w-7xl` в живом коде **не встречается ни разу** (единственное вхождение — `hero-section-1.tsx:79`, мёртвый файл). `max-w-2xl/3xl/4xl/5xl/6xl` — только внутренние меры текста (например, `privacy/page.tsx:168`: `pt-16 md:pt-24 pb-32 max-w-2xl`), никогда не внешний контейнер.

Главная страница использует более узкую внутреннюю меру: `max-w-[1280px] mx-auto px-6 md:px-12` (`page.tsx:119`, `HowItWorksSection.tsx:222`, `AIStylistShowcase.tsx:545`).

### Брейкпоинты

Стандартные Tailwind. Реально используются `sm` (640), `md` (768) — главный переключатель мобильный/десктоп, `lg` (1024), `xl` (1280) редко. `md` — точка, где меняется всё: паддинги (`px-6 md:px-12`), сетки, размер overlay-контролов, показ/скрытие нижней навигации.

### Вертикальный ритм

- Начало контента списковой страницы: `pt-12 md:pt-16` (`saved/page.tsx:209`).
- Начало контента детальной страницы после хлебных крошек: `mt-8 md:mt-12` (`ProductClient.tsx:125`).
- Секция под фолдом: `mt-20 md:mt-28` (`ProductClient.tsx:497`).
- Секция с данными, отбитая линейкой: `mt-16 border-t border-[var(--border)] pt-10`. Оба источника рецепта, `PriceHistoryChart.tsx:52` и `ProductReviews.tsx:123`, после ревью 2026-09 сняты со страницы товара и ждут удаления; живого примера рецепта сейчас нет.
- Полноширинная секция контентной страницы: `border-t border-[var(--border)]` + `py-20 md:py-28` (`about/page.tsx:58-60`).
- Футер: `mt-16 md:mt-32`, `py-10 md:py-24` (`Footer.tsx:26-27`).
- Сетка карточек: `gap-4` — везде.

### Сетки карточек

```tsx
// каталог: browse/page.tsx:1310
"grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4"
// saved: saved/page.tsx:266, MyLooksPanel.tsx:1554 (связанные товары PDP — grid-cols-2 md:grid-cols-4, ProductClient.tsx:551)
"grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
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
| Нижняя навигация, скрим корзины | 40 | `MobileBottomNav.tsx:87`, `Navigation.tsx:558` |
| Sticky-хедер, дропдауны, drawer | 50 | `Navigation.tsx:151,375,560`, `browse/page.tsx:944` |
| Скрим стилиста | 55 | `StylistDrawer.tsx:667` |
| Подменю валют, drawer стилиста, баннер cookies | 60 | `Navigation.tsx:435`, `StylistDrawer.tsx:653`, `CookieConsentBanner.tsx:38` |
| Модалка выбора стиля | 70 | `StylePicker.tsx:66` |
| UpgradeModal, модалка сохранения образа | 80 | `UpgradeModal.tsx:80`, `builder/page.tsx:2296` |
| Модалка выхода | 200 | `Navigation.tsx:622` |

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

`rounded-md` встречается 10 раз (4 — в мёртвых `ui/button.tsx` и `OutfitCarousel.tsx`, остальные — оверлей-бейджи в `saved/page.tsx:68`, `MyLooksPanel.tsx:716,1037` и три элемента админки: плашка плана и миниатюра на дашборде, бейдж «Admin» в меню, см. раздел 11) и не является частью языка — это остатки shadcn. Не использовать.

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

**Статус файла:** `src/components/ui/button.tsx` помечен к удалению по итогам код-ревью 2026-09 (`docs/CODE_REVIEW_2026-09.md`, раздел «Мёртвые файлы»: удалить одним коммитом вместе с `blocks/hero-section-1.tsx`, иначе упадёт `tsc`). Удаление ждёт разрешения CEO. Пока файл лежит в репозитории, правило ниже действует без исключений.

Факты, а не мнение:

- `src/components/ui/button.tsx` — shadcn-примитив с `cva`: 6 вариантов × 4 размера, базовый класс `rounded-md text-sm` (`button.tsx:8`). Его собственный `focus-visible`-ring больше не единственный в проекте: с 2026-09-12 есть глобальное кольцо `:focus-visible` (раздел 5.12).
- Импортирует его **ровно один файл** во всём `src/`: `src/components/blocks/hero-section-1.tsx:6`.
- Этот файл, в свою очередь, **не импортирует никто** — поиск `components/blocks` по `src/` даёт ноль.
- Значит, `<Button>` не рендерится нигде. Ноль живых использований против **~510 сырых `<button>` в 61 файле**.
- Его варианты не совпадают с реальным языком: `rounded-md` — 10 использований в проекте против ~290 `rounded-xl` и ~330 `rounded-full`; `text-sm` / `h-10` вообще не соответствуют uppercase-tracked рецептам.
- Его семантические классы (`bg-primary`, `bg-accent`, `border-input` и т.д.) после удаления `--color-*` из `@theme inline` (раздел 1) ни во что не компилируются: даже если импортировать `<Button>`, он отрисуется без фона и цвета.

Дополнительно `hero-section-1.tsx` экспортирует имя `HeroSection`, совпадающее с живым `src/components/home/HeroSection.tsx:8`, и вместе с `button.tsx` это единственные носители shadcn-семантических классов (`bg-muted`, `text-muted-foreground` и т.п.). Он выглядит как дизайн-система, но не отгружается. Тоже ждёт удаления.

### Одно правило для новых кнопок

**Пока `src/components/ui/button.tsx` существует — не импортируй его. Собирай кнопку из рецептов раздела 5.3, дословно копируя один из четырёх вариантов (primary / secondary / ghost / icon) и меняя только текст и обработчик.** В админке — рецепты раздела 9. Если рецепт не подходит — это повод обсудить расширение системы, а не написать одиннадцатый вариант инлайном. После удаления файла правило «не импортировать» теряет предмет, а правило «собирать по рецептам» остаётся.

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

В JS (framer-motion) живёт прежняя кривая `[0.25, 0.46, 0.45, 0.94]`: локальный `const EASE` в `AIStylistShowcase.tsx:20`, `OutfitExamplesCarousel.tsx:8` (и в мёртвом `FeaturesBento.tsx:14`) плюс инлайном в `FadeInView.tsx`, `OutfitCard.tsx`, `HeroSection.tsx`, `AuthForm.tsx`, `about`, `plans`, `browse` (и в мёртвых `AIStylistChat.tsx`, `HowItWorksGrid.tsx`). Общего JS-модуля motion-токенов нет, и JS-кривая не совпадает с CSS-токеном `--ease-out`. Для нового framer-кода бери ту же `[0.25, 0.46, 0.45, 0.94]`, что у соседей, — выбор единой кривой для CSS и JS не сделан.

### Длительности

Шкала-токены (`globals.css:31-34`): `--dur-press` 160ms (отклик на нажатие), `--dur-fast` 150ms, `--dur-base` 200ms, `--dur-slow` 260ms. Комментарий там же: интерфейс живёт под 300 мс, drawer и модалки — до 500.

В классах: `150ms` — opacity-переключения; `200ms` — стандартный hover (`transition-colors duration-200`); `300ms` — раскрытия, slide-переходы и зум фото `.img-zoom`; `500ms` — hover-скрим на изображении карточки образа. `duration-[260ms]` (`ProductClient.tsx:210`) — единственная произвольная длительность в классах; то же значение в CSS теперь названо `--dur-slow`.

Свойство перехода в классах названо явно: `transition-all` убран правкой 2026-09-12 (`ca206c4`, 123 → 0; сейчас одно вхождение, полоса прогресса `EmbeddingsCard.tsx:178`). В коде стоят `transition-colors`, `transition-opacity`, `transition-transform` или список свойств `transition-[…]`, если меняется раскладка (`transition-[width]`, `transition-[left]` у бегунка переключателя).

### Отклик на нажатие

Глобальное правило `globals.css:224-244`: любой `button`, `[role="button"]` и `summary` при `:active` получает `scale: 0.97` за `--dur-press`. Используется независимое свойство `scale`, а не `transform`, поэтому центрирование через `-translate-x-1/2` не ломается. Отказ — класс `.no-press` или собственный `active:scale-*` на элементе. Новой кнопке писать отклик руками не нужно.

### Оверлеи: `.ov-*` и `useOverlayPresence`

Общий рецепт входа и выхода хромы (`globals.css:657-746`) — переходы с `@starting-style`, узел снимается по `transitionend` хуком `src/lib/hooks/useOverlayPresence.ts`:

| Класс | Что | Вход / выход |
|---|---|---|
| `.ov-scrim` | затемнение фона | opacity, `--dur-base` / `--dur-fast` |
| `.ov-panel` | модалка по центру | opacity + `scale(0.97)`, `--dur-slow` / `--dur-fast` |
| `.ov-pop` / `.ov-pop-up` | выпадашка от триггера (вниз / вверх) | opacity + `scale(0.98)`, `--dur-fast` / 120ms |
| `.ov-rise` | полоса снизу (баннер, нижний лист) | translateY, `--dur-slow` / `--dur-base`, кривая `--ease-drawer` |

Закрывающееся состояние — класс `.is-closing`. Сейчас рецепт применён в `UpgradeModal`, `CartPanel`, `CookieConsentBanner`, `StylistPersonalizationModal` (без выхода — у неё нет своего `open`). Остальные модалки сайта и админки анимируются по-старому (framer-motion или `.animate-*`).

### Классы `.animate-*` из `globals.css`

| Класс | Определение | Назначение |
|---|---|---|
| `.animate-fade-up` | `fadeUp 0.5s var(--ease-out) forwards` (`:300`) | Появление статичного блока снизу на 12px |
| `.animate-fade-in` | `fadeIn 0.4s ease forwards` (`:324`) | Простое появление оверлея/панели |
| `.animate-scale-in` | `scaleIn 0.4s var(--ease-out)`, `scale(0.97) → 1` (`:400`) | Появление карточки/модалки |
| `.animate-slide-up` | `slide-up 0.28s var(--ease-drawer) both` (`:577`) — дубль снят 2026-09-12 | Нижний лист на мобильном (билдер) |
| `.animate-slide-in-right` | `slideInRight 0.38s var(--ease-out)` (`:384`) | Drawer справа |
| `.stylist-drawer-animate` | `slideUp 0.32s` на мобильном, `slideInRight 0.38s` с `md` (`:582-589`) | Drawer стилиста |
| `.animate-shimmer` | `shimmer-sweep 1.8s infinite` (`:429`) | Бегущий блик (в скелетонах не используется) |
| `.animate-progress-bar` | `progress-indeterminate 1.6s infinite` (`:438`) | Неопределённый прогресс |
| `.animate-scroll-hint` | `scroll-hint 2s infinite` (`:605`) | Стрелка «листай вниз» на hero |
| `.ai-pulse` | `aiPulseRing 1.6s infinite` (`:320`) | Пульсирующее кольцо AI-кнопки |
| `.stagger-children` | задержки 0…420ms по `nth-child` (`:329-336`) | Каскад для CSS-анимаций |
| `.img-zoom` / `.card-zoom-layer` | `transform 300ms var(--ease-out)`, `scale(1.05)` по hover — **только при настоящем курсоре** `(hover: hover) and (pointer: fine)` (`:271-286`) | Зум фото в карточке; на тач-экране не залипает |
| `.link-underline` | `::after` `scaleX(0 → 1)` за `--dur-base`, тоже только при настоящем курсоре (`:348-372`) | Подчёркивание ссылки по hover |

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

**Правило:** для карточек товаров/образов — spring из `ProductCard`; для контентных секций — `FadeInView`. Локальные копии `FadeCard` (`AIStylistShowcase.tsx:22` и в мёртвом `FeaturesBento.tsx:22`) — дубликаты `FadeInView` с разошедшимися значениями, не копируй их.

Другие spring, реально применяемые: `{ stiffness: 400, damping: 35 }` — пилюля таба (`saved/page.tsx:229-231`); `{ stiffness: 380-500, damping: 38-42, mass: 0.8 }` — drawer и сегментированный переключатель.

### prefers-reduced-motion и другие системные настройки

Глобальный guard есть и покрывает все CSS-анимации, включая инлайновые `<style>`. С 2026-09-12 он убирает **движение, но не отзывчивость**: цвет, прозрачность и подсветка фокуса продолжают плавно меняться.

```css
/* src/app/globals.css:611-628 */
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

Отклик на нажатие (`scale`) при этом выключается сам: `scale`/`transform` нет в списке переходимых свойств. Оверлеи `.ov-*` под reduced-motion только проявляются, без сдвига и масштаба (`globals.css:736-746`).

Ещё два системных сигнала (`globals.css:636-655`): `prefers-reduced-transparency: reduce` снимает `backdrop-filter` со всего, что несёт `backdrop-blur`, и подкладывает `--background`; `prefers-contrast: more` делает то же, добавляет границу `--foreground` и утолщает кольцо фокуса до 3px.

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
- Тема переключается **каскадом CSS**, а не JS. Компоненты, которые ветвятся на `useTheme()` и подставляют инлайновые стили (`Navigation.tsx:99-110`, `MobileBottomNav.tsx:13,92`), — исключение, а не образец. Единственный оправданный императивный случай — подмена растрового ассета, который нельзя переключить переменной.
- **Tailwind-вариант `dark:` к теме сайта не подключён.** В `globals.css` нет `@custom-variant dark`, поэтому на Tailwind v4 `dark:` срабатывает по системной настройке ОС (`@media (prefers-color-scheme: dark)`), а не по классу `.dark` на `<html>` и не по теме админки. Пользователь со светлой ОС и тёмной темой сайта (а это умолчание) `dark:`-стилей не увидит. Не используй `dark:` — тематизируй через токены. В живом коде `dark:` сейчас нет; остался только в мёртвых `PriceHistoryChart.tsx` и `blocks/hero-section-1.tsx`.

### Правило

**Любой новый элемент проверяется в обеих темах перед коммитом.** Практический чек: если ты написал `text-white`, `bg-black/NN`, `#hex` или `rgba(255,255,255,α)` — ответь на вопрос «что это будет в светлой теме на `#F4F2EE`?». Если ответ «невидимо» или «инвертировано» — это баг. В разделе 11 половина подтверждённых high-расхождений — ровно этот случай.

---

## 9. goo-studio (админка)

`src/app/goo-studio/**` — **отдельный диалект на том же токенном слое**, а не дрейф. Это сознательное решение, его надо уважать.

Что общего: цвет только через те же CSS-переменные. Во всех 20 живых страницах админки (плюс мёртвая `image-tools`, ждёт удаления) ноль `text-gray-*` / `bg-neutral-*` / `border-zinc-*` и ноль `dark:`.

### Тема админки

У админки своя тема, независимая от темы сайта на `<html>` (там по умолчанию тёмная).

- Корень админки (`goo-studio/layout.tsx:686-687`) несёт класс `.admin-theme-light` или `.admin-theme-dark` (карта `THEME_CLASS`, `layout.tsx:259-262`).
- Токены обеих тем объявлены в `globals.css` в тех же блоках, что и тема сайта: `:root, .admin-theme-light` (`:43-62`) и `.dark, .admin-theme-dark` (`:64-82`). Класс на корне переобъявляет **весь** набор, включая `--bg-overlay-*`, `--fg-overlay-*`, `--fg-on-dark-*`, поэтому любой элемент внутри админки берёт цвета из темы админки, а не из унаследованной темы сайта. Нативные контролы (выпадающие списки, date picker, скроллбары) следуют ей через `color-scheme` (`globals.css:86-91`).
- Светлая тема админки работает и при тёмной теме сайта, и наоборот.
- Выбор хранится в `localStorage` под ключом `goo-admin-theme` (`layout.tsx:11`) и читается через `useSyncExternalStore` (`layout.tsx:283-329`): сервер и гидратация рисуют умолчание, сохранённое значение применяется сразу после. Умолчание — светлая (`layout.tsx:363-364`). Переключатель — первая кнопка в нижнем блоке меню (`layout.tsx:573`).
- Порталов (`createPortal`) в админке нет. Если появится модалка, смонтированная вне корня админки, она получит тему сайта, а не админки — класс темы придётся повесить и на неё.

Что отличается от публичного сайта:

| Аспект | Публичный сайт | goo-studio |
|---|---|---|
| Фон холста | `--background` | `--surface` (корень и колонка контента, `layout.tsx:687,736`) |
| Фон сайдбара, верхней панели, карточки | `--surface` у карточки | `--background` (`layout.tsx:694,740`, `analytics/page.tsx:58`) |
| H1 | `text-4xl md:text-5xl font-black uppercase` | `font-display text-2xl font-light` — на всех 20 страницах (`goo-studio/page.tsx:156`, `products/page.tsx:1843`) |
| Большие числа | — | `font-display text-3xl font-light` (`users/page.tsx:401`); в карточках дашборда и аналитики на телефоне `text-2xl md:text-3xl` (`goo-studio/page.tsx:221`, `analytics/page.tsx:64`) |
| Компоненты | `ProductCard`, `.label`, `.img-zoom` | не используются вообще |
| Движение | framer `whileInView` + spring | CSS `animate-spin` / `animate-pulse`; framer только в `layout.tsx` и `page.tsx` |
| Статусы | нет токенов, нет рецепта | рецепт есть, см. ниже |

### Статусы и тосты — как в коде сейчас

Три семантических цвета: `emerald` = ok, `amber` = предупреждение / привилегия (Super Admin, Pro), `red` = ошибка. В плашках оттенок `400` идёт на фон и рамку, `500` — на текст; точка состояния — сплошной `500`:

| Что | Рецепт | Где |
|---|---|---|
| Базовая тройка | `bg-X-400/15 text-X-500 border border-X-400/30` | константы `statusOk` / `statusWarn` / `statusErr` в `email/page.tsx:50-52`, `import/page.tsx:59-61`, `waitlist/page.tsx:12-13`; `TONE_CLASSES` в `activity/page.tsx:102-106` |
| Баннер | `rounded-xl border border-X-400/30 bg-X-400/15 px-4 py-3` + текст `text-[13px] text-X-500 leading-relaxed` или `text-xs text-X-500` | `duplicates/page.tsx:364-365,374`, `audit/page.tsx:299,303`, `categories/page.tsx:45`, `brands/page.tsx:197`. `role="alert"` у баннера ошибки стоит не везде: есть в brands, activity, analytics (`activity/page.tsx:350`, `analytics/page.tsx:180`), нет в duplicates и audit |
| Бейдж | базовая тройка + `text-[10px] tracking-[0.14em] uppercase px-1.5 py-0.5 rounded-full` | `layout.tsx:554,787,949` (SA / Super Admin). Размер и радиус бейджей по админке гуляют: 9px `px-2 py-1` в users (`users/page.tsx:639-649`), `rounded-lg` в duplicates (`duplicates/page.tsx:176`), см. раздел 11 |
| Точка состояния | `w-2 h-2 rounded-full bg-X-500` | `settings/page.tsx:1117`, `email/page.tsx:286` |
| Тост | `fixed bottom-4 left-4 right-4 md:bottom-6 md:left-auto md:right-6 z-50 px-4 py-3 text-xs tracking-wide rounded-xl border`; успех — инверсия `bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]`; ошибка — `bg-[var(--background)] text-red-500 border-red-400/30`. `role="status"` для успеха, `role="alert"` для ошибки (в duplicates — всегда `role="status"`); в brands ещё `md:max-w-md`; автоскрытие по таймеру 3–6 с | `duplicates/page.tsx:411-422`, `brands/page.tsx:335-346`, `audit/page.tsx:469-480`, `categories/page.tsx:611-622` |
| Тост со статусной заливкой (второй вариант) | непрозрачная подложка `var(--background)` + внутри базовая тройка emerald/red, `text-sm`, кнопка закрытия `aria-label="Dismiss"`, `z-[100]`, `md:max-w-md` | только `products/page.tsx:3221-3250` |

Два варианта тоста — расхождение, одного канона пока нет (раздел 11).

### Мобильная версия админки

С 2026-09-26 (коммит `27ada17`) админка рассчитана на телефон; по описанию коммита каждая страница и модалка проверены на ширине 375px. Граница — `md` (768px), та же, что у сайта.

- **Сайдбар ниже `md` — drawer по рецепту 5.6.** Десктопный `<aside>` скрыт (`hidden md:flex`, `layout.tsx:690-691`). В верхней панели появляется кнопка-бургер `md:hidden w-10 h-10 rounded-lg` с `aria-label="Open menu"`, `aria-expanded`, `aria-controls` (`layout.tsx:743-756`). Drawer: `md:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px] max-w-[85vw]` на `var(--background)`, `role="dialog" aria-modal="true"`, spring `{ stiffness: 380, damping: 38, mass: 0.8 }` от `x: -280`; скрим `z-40 bg-black/60 backdrop-blur-sm` (`layout.tsx:809-855`). Закрывается по скриму, Escape, переходу на другую страницу и расширению окна за `md`; блокирует прокрутку фона (`useScrollLock`); фокус уходит на кнопку закрытия и возвращается на бургер (`layout.tsx:379-442`).
- **Верхняя панель и поля страницы:** `h-14 md:h-16`, `px-4 md:px-8`; на телефоне крошка «Admin» скрыта, если за ней есть раздел (`layout.tsx:763`). `<main>` — `p-4 md:p-8` плюс `safe-area-inset-bottom` (`layout.tsx:739,806`).
- **Цели касания 40px.** Ниже `md` у каждого `button`, `select` и текстового `input` `min-height: 40px`; у иконочной кнопки (с `aria-label`) ещё `min-width: 40px`. Правило в `@layer base` под `:where(.admin-theme-light, .admin-theme-dark)` (`globals.css:93-113`), поэтому утилита на элементе побеждает его: где контрол обязан остаться маленьким — **`min-h-0`** (и `min-w-0`). Исключены сами собой кнопки поверх картинки (`.absolute`) и переключатели (`[role="switch"]`). Ссылки, `label` и прочие элементы правило не покрывает — им высоту дают руками: `min-h-10 md:min-h-0` (`goo-studio/page.tsx:285`, `duplicates/page.tsx:127`). Иконочная кнопка, которой на десктопе нужен свой, меньший размер, пишет оба явно: `w-10 h-10 md:w-auto md:h-auto` (`layout.tsx:889,960`).
- **Поля 16px.** Ниже `md` у `input`, `select`, `textarea` внутри админки `font-size: 16px`, иначе iOS Safari зумит страницу при фокусе и не отдаёт зум обратно. Правило вне слоёв (`globals.css:115-122`), чтобы перебить `text-xs` / `text-sm` на полях. Размер шрифта поля утилитой ниже `md` не задавай — он не применится.
- **Hover-only элементы** (кнопки, проявляющиеся по наведению) дополняются `[@media(hover:none)]:opacity-100`, чтобы на тач-экране они были видны всегда, и `focus-visible:opacity-100` / `focus-within:opacity-100` для клавиатуры: `opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100` (`email/page.tsx:580`, `settings/page.tsx:142`).
- **Таблицы прокручиваются в своём контейнере**, страница вбок не едет: обёртка `rounded-xl border border-[var(--border)] overflow-x-auto` (`products/page.tsx:2309`, `goo-studio/page.tsx:366`, `outfits/page.tsx:1010`) либо внутренний `<div className="overflow-x-auto">` в карточке с `overflow-hidden` (`users/page.tsx:538`, `subscriptions/page.tsx:305`). Второстепенные колонки прячутся `hidden md:table-cell` / `hidden lg:table-cell` (`blog/page.tsx:404-410`). Широкой таблице можно задать `min-w-[900px]` (`import/page.tsx:695`).
- **Модалки:** панель `w-full` с отступом 16px от краёв экрана (`p-4` / `px-4` на скриме или `mx-4` на панели), `max-h-[90dvh]` и прокрутка внутри (`overflow-y-auto` или `flex flex-col` с прокручиваемым телом); на `md` высота может расти до `80–95vh` (`layout.tsx:866-877`, `blog/page.tsx:561-566`, `settings/page.tsx:213-218`, `products/page.tsx:2100-2102`).
- **Формы и тулбары:** сетка формы на телефоне в одну колонку (`grid-cols-1 md:grid-cols-[220px_1fr]`, `products/page.tsx:2591`), тулбары переносятся (`flex flex-wrap`), тосты на телефоне во всю ширину (рецепт выше).

### Правила для нового элемента в админке

1. Цвет — те же токены. Никаких сырых палитр Tailwind, кроме трёх семантических статусов выше, и только в оттенках `400`/`500` из рецепта.
2. Таблица: обёртка `rounded-xl border border-[var(--border)] overflow-x-auto` на `background: var(--background)`; строка шапки `border-b border-[var(--border)]` на `background: var(--surface)`; ячейки шапки `text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal` (`products/page.tsx:2309-2326`, `goo-studio/page.tsx:366-372`, `waitlist/page.tsx:15`).
3. Инпут: `rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm bg-transparent text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors`; у `select` вместо `bg-transparent` — `bg-[var(--background)]`. Подпись: `block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5` (`products/page.tsx:218-223`, `settings/recipes.tsx:8-9`).
4. Primary-кнопка: `bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg text-xs tracking-[0.12em] uppercase hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed` (`products/page.tsx:1914`, `settings/recipes.tsx:4-5`, `categories/page.tsx:43`).
5. Контурная (второстепенная) кнопка: утверждённого рецепта нет, живут не меньше восьми форм (раздел 11, «Новые расхождения»). Чаще других — `px-4 py-2 rounded-lg text-xs tracking-[0.12em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40` (`settings/recipes.tsx:6-7`, `parser/page.tsx:79`, `import/page.tsx:52`). Какая форма станет каноном — решение CEO.
6. Фильтр-пилюля: `px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase border rounded-full`, активная — `bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]` (`products/page.tsx:1947`, `analytics/page.tsx:23-27`).
7. Переключатель: `button role="switch" aria-checked`, дорожка `w-9 h-5 rounded-full` на `bg-[var(--foreground)]` / `bg-[var(--border)]`, бегунок `w-4 h-4 rounded-full bg-[var(--background)]` (`parser/page.tsx:522-533`).
8. Заголовок страницы: `font-display text-2xl font-light text-[var(--foreground)]` + подзаголовок `text-xs text-[var(--foreground-muted)] mt-1` (`analytics/page.tsx:153-154`).
9. Карточка: `rounded-xl border border-[var(--border)] p-4 md:p-5` на `background: var(--background)` (`analytics/page.tsx:58`).
10. Иконки — инлайновый SVG, `strokeWidth="1.2"` (128 из 170 атрибутов `strokeWidth` в админке), 12-16px.
11. Модалка: скрим `fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4`, панель `rounded-2xl border border-[var(--border)] w-full max-w-* max-h-[90dvh]` на `background: var(--background)`, `role="dialog" aria-modal="true"`, закрытие по скриму и Escape (`layout.tsx:866-877`).
12. Пустое/загрузочное состояние таблицы — центрированный текст `px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]` (`products/page.tsx:2311`), не скелетон. Исключение — карточки с числами на дашборде и в аналитике: там пульсирующая плашка `animate-pulse` (`analytics/page.tsx:48`, `goo-studio/page.tsx:227`).
13. Мобильные правила выше соблюдены: контрол не меньше 40px (или осознанный `min-h-0`), поле без своего размера шрифта ниже `md`, hover-only элемент с `[@media(hover:none)]:opacity-100`, таблица в `overflow-x-auto`, модалка `w-full` + `max-h-[90dvh]`.
14. **Не использовать `dark:`-варианты Tailwind.** В проекте `dark:` срабатывает по системной теме ОС (раздел 8), а не по теме админки — это рассинхрон. Тема админки выражается только токенами.

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
9. Кнопка собрана из одного из четырёх рецептов 5.3 (в админке — из рецептов раздела 9). `src/components/ui/button.tsx` не импортирован: файл помечен к удалению и ждёт разрешения CEO, но пока он лежит в репозитории, запрет действует.
10. Карточка товара/образа — импортирован `ProductCard` / `OutfitCard`, а не переписана разметка.
11. Анимация — либо spring `{ type:'spring', bounce:0.2, duration:0.8 }` (карточки), либо `FadeInView` (секции), в framer easing `[0.25,0.46,0.45,0.94]`. В CSS кривая и длительность берутся токенами `var(--ease-out)` / `var(--ease-in-out)` и `var(--dur-*)`, а не литералами. Длительность из набора 150/200/300/500 (в CSS — токены `--dur-*`, раздел 7). Появление и уход хромы — через `.ov-*` + `useOverlayPresence` (раздел 7).
12. Непрерывная анимация имеет собственную проверку `prefers-reduced-motion`.
13. Интерактивный элемент имеет `aria-label` / `aria-expanded` / `aria-pressed` там, где смысл не читается из текста; модальный слой — `role="dialog" aria-modal="true"`.
14. Если поставил `outline-none` — рядом стоит видимая замена фокуса: `outline-none` отключает общее кольцо `:focus-visible` (раздел 5.12). Если замены нет — не ставь `outline-none`.
15. Ничего не скопировано из мёртвого кода с конкурирующим языком. Все эти файлы помечены к удалению по код-ревью 2026-09 и ждут разрешения CEO: `src/components/ui/button.tsx`, `src/components/blocks/hero-section-1.tsx`, `src/components/ui/animated-group.tsx`, `src/components/ui/parallax-floating.tsx`, `HeroBackground.tsx`, `SectionLabel.tsx`, `ProductGallery.tsx`, `ProductReviews.tsx`, `PriceHistoryChart.tsx`, `OutfitCarousel.tsx`, `FeaturesBento.tsx`, `HowItWorksGrid.tsx`, `AIStylistChat.tsx`, `HeroProductCycle.tsx`, `src/app/coming-soon/` (с `FeatureCarousel.tsx`), `src/app/goo-studio/image-tools/`.
16. Элемент админки открыт на ширине 375px и прошёл мобильные правила раздела 9 (цель касания 40px, поле без своего размера шрифта ниже `md`, hover-only элемент виден на тач-экране, таблица прокручивается в своём контейнере, модалка помещается в экран) и проверен в обеих темах админки, в том числе светлая админка при тёмной теме сайта.

---

## 11. Найденные расхождения

**Это наблюдения, а не наряд на работу.** Открытые строки требуют отдельной задачи, приоритизации и проверки — самовольно чинить их по этому списку нельзя, решение за CEO. Исправленные строки оставлены для истории.

Список составлен по аудиту 2026-08-07 и сверен с кодом 2026-09-26. Колонка «Статус»:

- **✓ исправлено (ревью 2026-09)** — исправлено коммитами код-ревью 2026-09-26 (`docs/CODE_REVIEW_2026-09.md`).
- **✓ исправлено (UX-правка 2026-09-12)** — исправлено коммитами `fea1b2f` / `ca206c4` по `docs/UX_REVIEW_2026-09.md`.
- **✓ исправлено (до 2026-09)** — уже было исправлено к моменту, когда этот файл попал в репозиторий (2026-08-20).
- **◐ частично** — часть строки исправлена, остаток описан.
- **актуально** — расхождение в коде есть. У таких строк в первой колонке уже **текущие** номера строк (2026-09-26); у исправленных и мёртвых — исходные, для истории.
- **компонент мёртв, ждёт удаления** — файл никто не импортирует (для страниц `/coming-soon` и `goo-studio/image-tools` — маршрут остался, но из интерфейса на него не ведут), он помечен к удалению по код-ревью 2026-09 и ждёт разрешения CEO. Чинить в нём нечего.

Сортировка внутри таблиц: high → medium → low.

### High

| Файл:строка | Что не так | Чем заменить | Статус |
|---|---|---|---|
| `src/components/home/AIStylistShowcase.tsx:547` | Ниже `lg` карточка `bg-transparent border-0`, но Intro внутри безусловно белый (`text-white`, `white/40`, `white/55`, тайлы `border-white/10 bg-white/[0.03]`) — на телефоне в светлой теме весь блок белым по `#F4F2EE`, практически невидим | Оставить тёмную подложку на всех ширинах (`bg-[#0A0A0A] border border-white/10`) либо сделать типографику Intro тематической | ✓ исправлено (UX-правка 2026-09-12): тёмная подложка на всех ширинах |
| `src/components/ui/etheral-shadow.tsx:42` (и `:67`) | Блобы `rgba(0,0,0,0.14)` и зерно `rgba(0,0,0,0.045)` без ветки темы, а компонент смонтирован на `bg-[var(--background)]` (`HeroSection.tsx:19,23`), который по умолчанию `#0A0A0A` — чёрное по чёрному, при этом анимации крутятся | Цвет блоба и зерна из токенов: `var(--fg-overlay-08)` / `var(--fg-overlay-05)` | ✓ исправлено (UX-правка 2026-09-12): `etheral-shadow.tsx:42,66` на токенах |
| `src/components/outfit/OutfitCarousel.tsx:107` | CTA «VIEW OUTFIT» вне фото собран из `border-white/30 text-white/60 bg-black/60`; в светлой теме — тёмная пилюля с контрастом ~2.5:1 на кремовом фоне | `border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]` | ✓ исправлено (UX-правка 2026-09-12); сам компонент мёртв, ждёт удаления |
| `src/app/builder/page.tsx:2710` | Primary «Show results» в мобильном фильтр-листе — `bg-white text-black`; в светлой теме белая кнопка на почти белом фоне | `bg-[var(--foreground)] text-[var(--background)] hover:opacity-90` | ✓ исправлено (UX-правка 2026-09-12): `builder/page.tsx:2769` |
| `src/app/browse/page.tsx:656` (и `:670`) | Кольцо невыбранного чекбокса категории — `rgba(255,255,255,0.2)`; в светлой теме на `#F4F2EE` невидимо | `borderColor: checked ? "var(--foreground)" : "var(--border-strong)"` | ✓ исправлено (UX-правка 2026-09-12) |
| `src/components/product/ProductReviews.tsx:199` + системно | `outline-none` без замены; во всём `src/` ни одного рабочего `:focus-visible`; клавиатурная навигация по PDP, browse, builder не индицируется | Глобальное правило в `globals.css`: `:focus-visible { outline: 2px solid var(--border-strong); outline-offset: 2px; }` | ✓ исправлено (UX-правка 2026-09-12): правило `globals.css:216-220`. `ProductReviews.tsx` снят со страницы товара при ревью 2026-09 — компонент мёртв, ждёт удаления |
| `src/app/goo-studio/layout.tsx:231` | Админка переопределяет тёмную тему инлайновым объектом из семи хексов вместо класса, теряя `--fg-overlay-*`, `--bg-overlay-*`, `--fg-on-dark-*` | Переключать класс на корне админки, чтобы применялся весь набор токенов | ✓ исправлено (ревью 2026-09): классы `.admin-theme-light` / `.admin-theme-dark` и токены в `globals.css:43-82`, раздел 9 |
| `src/app/goo-studio/products/page.tsx:1390` (также `:587,592,1658,2359,2627-2628`) | `dark:`-варианты внутри админки не следуют теме админки — баннеры рендерят тёмное оформление в светлом хроме и не реагируют на переключатель | Рецепт админки без `dark:`: `bg-amber-400/15 text-amber-500 border border-amber-400/30` | ✓ исправлено (ревью 2026-09): `dark:` в админке ноль |
| `src/app/goo-studio/analytics/Charts.tsx:256` | Ссылка на `--foreground-rgb`, которой нет нигде в репозитории; все столбцы воронки кроме первого рисуются чёрным | `background: "var(--foreground)"` + убывающая `opacity` на элементе | ✓ исправлено (UX-правка 2026-09-12): `Charts.tsx:270-271` |
| `src/app/goo-studio/analytics/Charts.tsx:26` | Палитра recharts — пять сырых хексов серого (`#6b7280…#1f2937`), не реагируют на тему | Рампа из токенов: `color-mix(in srgb, var(--foreground) N%, var(--surface))` | ✓ исправлено (ревью 2026-09): `Charts.tsx:28-35` |

### Medium

| Файл:строка | Что не так | Чем заменить | Статус |
|---|---|---|---|
| `src/components/layout/Navigation.tsx:100-107` | Хедер строит параллельную палитру из хекс/rgba-констант в JS вместо токенов (плюс инлайновые rgba в `:216`, `:230-256`, `:276-277`, `:321-322`, `:366-367`); светлое значение `#ffffff` соответствует `--surface`, а не `--background` (`#F4F2EE`) | Токены, как в `MobileBottomNav.tsx:91,111` | актуально |
| `src/components/layout/Navigation.tsx:112` | Полный токенный путь стилей (`headerBg`, `logoColor`, `linkActive`, `linkMuted`, `iconColor`) объявлен и нигде не используется; scroll-listener не даёт визуального эффекта | Подключить переменные к `<header>` либо удалить их вместе со `scrolled`, `showWhiteText` и слушателем | ✓ исправлено (ревью 2026-09): удалено |
| `src/components/layout/ConditionalSiteLayout.tsx:63` (и `:77`) | Зазор под нижнюю навигацию задан дважды — на `<main>` и на обёртке футера; на мобильном добавляет ~72px пустоты перед футером | Оставить только на последнем элементе потока | актуально |
| `src/components/layout/Footer.tsx:89` (и мобильный `:38`) | Вордмарк в футере — Inter Tight `font-black tracking-[0.2em]`, в хедере — Poppins 800 / 22px / `tracking-[0.18em]` (`Navigation.tsx:171`) | Общий `<Wordmark>` по рецепту хедера | актуально |
| `src/app/page.tsx:42` | `.label` не применён нигде, каждый eyebrow объявляет свои значения; здесь — `text-[11px] tracking-[0.22em]` | Привести `.label` к реальному намерению и применить, либо стандартизовать строку | актуально |
| `src/app/globals.css:339` | `.label` мёртв; цвет утилиты (`--foreground-muted`) расходится с фактическим использованием (больше eyebrow на `--foreground-subtle`) | Сначала решить вопрос цвета, потом либо принять утилиту, либо удалить | актуально; `SectionLabel.tsx` — компонент мёртв, ждёт удаления |
| `src/components/home/AIStylistShowcase.tsx:22` | Копия fade-обёртки (`FadeInView` y=20/0.45, здесь y=28/0.5; третья копия — в мёртвом `FeaturesBento.tsx:22`) | Импортировать `FadeInView`, удалить локальные `FadeCard` | актуально |
| `src/app/browse/page.tsx:1332` (и `:1352`) | Обёртка грида повторяет анимацию, которую карточка уже играет сама (`ProductCard.tsx:81-84`) — два независимых определения на одно появление | Оставить каскад на родителе, анимацию — на карточке | актуально |
| `src/app/browse/page.tsx:944` | Модальный drawer без `role="dialog"`, `aria-modal`, `aria-label`; во всём файле ноль `aria-` | `role="dialog" aria-modal="true" aria-label="Filters"` + `aria-expanded` на заголовках фасетов | актуально |
| `src/app/browse/page.tsx:612` (также `529,541,560,697,730,771,836,948`) | Девять заголовков фасетов с инлайновым `textShadow: 0 0 14px rgba(255,255,255,0.4)` — эффект только для тёмной темы | Убрать `textShadow` либо завести тематический токен | актуально |
| `src/app/builder/page.tsx:908` (также `873,897,994,1028,1068,1138,2492`) | То же самое, восемь заголовков в фильтр-панели билдера | Обычный eyebrow-рецепт без тени | актуально |
| `src/app/browse/page.tsx:566` (также `582,593,624,645-647,662,676,714,758,805,815,821,846`) | Приглушённый текст = `text-[var(--foreground)]` + разные шаги `opacity` (40/50/55/60) вместо `--foreground-muted`, который в этом же файле используется 17 раз | Одна пара: `--foreground` / `--foreground-muted` | актуально |
| `src/app/browse/page.tsx:92` | Три несовместимых рецепта чипа на одном экране (9px/`--foreground` в `ActiveChip`, 10-11px/`--border`, 12px/`--border-strong`) | Один масштаб чипа, `--border-strong` в покое | актуально |
| `src/components/product/PriceHistoryChart.tsx:167` (и `:199`) | Ось Y и метки хардкодят `$`, тултип использует `formatPrice` | `{formatPrice(tick)}` | компонент мёртв, ждёт удаления: фейковый график снят со страницы товара при ревью 2026-09 |
| `src/components/product/ProductClient.tsx:248` | Eyebrow в одном файле написан вручную много раз с разными tracking: `0.2em` здесь, рядом `0.12`/`0.14`/`0.16`/`0.18em` | Один рецепт eyebrow | актуально |
| `src/components/outfit/OutfitCard.tsx:40` (и `:44`) | `rounded-2xl` + tween 0.35s против канона `rounded-xl` + spring с блюром (`ProductCard.tsx:80-84`); карточки стоят в одних сетках | Привести к рецепту `ProductCard` | актуально |
| `src/components/look/MyLooksPanel.tsx:618` (также `:1107`, `builder/page.tsx:2035`, `:2314`, `saved/page.tsx:59`) | Алгоритм коллажа переписан несколько раз вместо `OutfitCollage`; копии разошлись, один и тот же образ рисуется по-разному (`saved/page.tsx:59` — упрощённая сетка 2×2 на 4 вещи) | Один параметризованный `OutfitCollage` | актуально; копии из `saved/page.tsx:455,861` переехали в `MyLooksPanel.tsx` |
| `src/app/saved/page.tsx:68` (также `MyLooksPanel.tsx:716`, `:1037`) | Оверлей-бейдж написан тремя способами: токен (`OutfitCard.tsx:68`), `bg-black/55 text-white` 8px `rounded-md` (здесь), `bg-black/60 … text-white` (`outfit/[id]/page.tsx:116`) | `bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)]` | актуально |
| `src/app/saved/page.tsx:224` | Два соседних сегментированных контрола расходятся по типографике: `text-xs tracking-[0.12em]` против `text-[10px] tracking-[0.16em]` (`profile/page.tsx:217`) | Одна шкала подписи | актуально |
| `src/app/builder/page.tsx:2247` (также `2448,2859,2898`) | Внесистемное золото `#c9a84c` как акцент подтверждения выбора; в остальном коде выбранное состояние — `var(--foreground)` | `bg-[var(--foreground)]` с обводкой `var(--background)` | актуально |
| `src/components/look/StylePicker.tsx:180` (также `:190,225,233,256`) | Шаг try-on сбрасывает шкалу радиусов — прямоугольные миниатюра «On You», бейдж New, превью фото, зона загрузки и кнопка генерации внутри `rounded-2xl`-модалки; подписи там `font-mono` 7–8px (`:120,128,150,169,190,192,200,241`), ниже пола шкалы | `h-11 rounded-xl` для primary, `rounded-lg/xl` для превью и бейджей | актуально; шаг переехал из `builder/page.tsx:3051` в `StylePicker.tsx` |
| `src/app/builder/page.tsx:2933` | Тост ошибки: `text-red-600` на `border-red-300`, без радиуса и без тёмной темы | Домовый рецепт ошибки (на публичном сайте его пока нет, раздел 5.12) | актуально |
| `src/components/outfit/OutfitActions.tsx:62` | Primary-кнопка существует в нескольких несовместимых формах: здесь `rounded-full px-8 py-4`, в карточках `rounded-xl h-11` (`MyLooksPanel.tsx:762`, `CartPanel.tsx:327`, `AuthForm.tsx:125`) | Один рецепт плюс, при необходимости, задокументированная компактная пара | актуально |
| `src/app/plans/page.tsx:196` | Карточка тарифа залита `bg-[var(--background)]` — цветом страницы под ней, при этом шапка таблицы на этой же странице использует `--surface` | `bg-[var(--surface)]` | актуально |
| `src/app/subscribe/page.tsx:267` | Радиус меняется посреди воронки: блок сводки и кнопки прямоугольные | `rounded-2xl` контейнер, `rounded-xl` кнопки | ✓ исправлено (до 2026-09) |
| `src/app/subscribe/page.tsx:296` | Ошибка оплаты: `text-red-500` на `border-red-300`, без тёмной темы, вразрез с `report/page.tsx:351` | Единый токенизированный рецепт ошибки | ◐ частично: радиус `rounded-xl` есть (был уже к 2026-08-20), цвета прежние |
| `src/components/upgrade/UpgradeModal.tsx:49` | Модалка без `backdrop-blur`, без анимации появления и без кнопки закрытия | `backdrop-blur-sm` + анимация и крестик | ✓ исправлено (UX-правка 2026-09-12): `.ov-scrim` / `.ov-panel`, крестик, Escape, `role="dialog"` (`UpgradeModal.tsx:76-97`) |
| `src/app/report/page.tsx:306` | Подпись «max 10MB», при этом `processFile` отклоняет всё больше 3.5MB (`:63-64`) | «optional · max 3.5MB» | актуально |
| `src/app/not-found.tsx:15` (и `error.tsx:28`) | `var(--muted-foreground)` не определена нигде — всегда срабатывал литерал `rgba(128,128,128,0.9)` | `text-[var(--foreground-muted)]` | ✓ исправлено (UX-правка 2026-09-12). Рядом появилось новое расхождение — модификатор `/20` на переменной, см. «Новые расхождения» |
| `src/components/ui/button.tsx:8` / `:42` | Мёртвый примитив: единственный импортёр — `blocks/hero-section-1.tsx:6`, который сам никем не импортируется | Удалить вместе с `hero-section-1.tsx` либо перекроить варианты под реальные рецепты и внедрить | компонент мёртв, ждёт удаления (решение CEO); пока файл есть — не импортировать (раздел 6) |
| `src/components/blocks/hero-section-1.tsx:30` / `:84` | Мёртвый шаблонный файл: экспортирует имя `HeroSection`, конфликтующее с живым; единственный носитель shadcn-классов, сырой палитры `zinc`, градиента `#9B99FE→#2BC8B7`, `<img>` на внешние CDN | Удалить | компонент мёртв, ждёт удаления |
| `src/app/blog/[slug]/page.tsx:99` | Чип категории на странице поста без `rounded-full` | Добавить `rounded-full` | ✓ исправлено (до 2026-09): `blog/[slug]/page.tsx:117` |
| `src/app/blog/[slug]/page.tsx:165` | Карточки постов на странице поста — `gap-px` hairline без границ и радиуса | Привести к рецепту листинга | ✓ исправлено (до 2026-09): `gap-4` + `rounded-xl border` (`:183-193`, `:220-225`) |
| `src/app/goo-studio/analytics/page.tsx:219` (и др.) | Внутри одного файла карточки одной семантики то `rounded-xl`, то без радиуса | `rounded-xl border border-[var(--border)]` | ✓ исправлено (ревью 2026-09) |
| `src/app/goo-studio/users/page.tsx:152` | Три формы одного сегментированного фильтра в админке | Один рецепт пилюли (`products/page.tsx:1947`) | ◐ частично (ревью 2026-09): analytics и activity взяли рецепт products (`analytics/page.tsx:23-27`); users — `rounded-full`, но другой размер (9px, `tracking-[0.14em]`, `px-3 py-2.5`) |
| `src/app/goo-studio/settings/page.tsx:428` (и `:403`) | Единственная страница админки, не использующая рецепт H1 | `font-display text-2xl font-light` | ✓ исправлено (ревью 2026-09): H1 по рецепту на всех 20 страницах |
| `src/app/goo-studio/settings/page.tsx:512` (также `ImageCropEditor.tsx:308,315`) | Primary-кнопка админки без радиуса | Добавить `rounded-lg` | ✓ исправлено (ревью 2026-09): `PRIMARY_BTN` в `settings/recipes.tsx:4-5`, `ImageCropEditor.tsx:332,339` |
| `src/app/goo-studio/settings/page.tsx:517` (и др.) | Успех выражен шкалой `green-*`, остальная админка — `emerald-*` | `emerald-*` | ✓ исправлено (ревью 2026-09): `green-*` в админке ноль |
| `src/app/goo-studio/settings/page.tsx:844` (и др.) | Инпут написан вручную: потерян `rounded-lg`, `bg-[var(--surface)]`, `text-[12px]` | Общий рецепт инпута админки | ✓ исправлено (ревью 2026-09): `INPUT` в `settings/recipes.tsx:8-9` |
| `src/app/goo-studio/users/page.tsx:101` | В админке нет ни одного focus-стиля | Токенный ring в общие рецепты | ✓ исправлено (UX-правка 2026-09-12): общее кольцо `:focus-visible` действует и в админке; поля по-прежнему фокусируются сменой границы (`outline-none` + `focus:border-[var(--foreground)]`) |

### Low

| Файл:строка | Что не так | Чем заменить | Статус |
|---|---|---|---|
| `src/components/layout/Navigation.tsx:451` | Sign up — единственная интерактивная поверхность в хроме без радиуса | Добавить `rounded-full` | ✓ исправлено (до 2026-09): `Navigation.tsx:497,546` |
| `src/components/layout/Navigation.tsx:558` (и `:623`) | Три рецепта скрима: `bg-black/20`, инлайновый `rgba(0,0,0,0.45)`+blur, `bg-black/40` в `StylistDrawer.tsx:667` | Один токенизированный скрим | актуально |
| `src/components/layout/Navigation.tsx:631` (и `:648,661`) | Кнопки модалки выхода собраны из инлайновых свойств, `borderRadius: 10`; оболочка `borderRadius: 20` против `rounded-2xl` у соседних панелей | `rounded-xl` кнопки, `rounded-2xl` оболочка | актуально |
| `src/components/layout/Navigation.tsx:435` | `z-[60]` совпадает со слоем `StylistDrawer.tsx:653-654` при отсутствии шкалы z-index | Именованная лестница в `globals.css` | актуально |
| `src/components/layout/Footer.tsx:60` | Ссылки мобильного дерева реагируют только на `active:`, десктопного — на `hover:` | Добавить `hover:` | актуально |
| `src/components/layout/Footer.tsx:112` | Именованная шкала размеров (`text-xs/sm/2xl/3xl`, `:38,89,93,112`) вперемешку с bracket-px в том же файле (`:52,73,104`) | Одна форма записи на файл | актуально |
| `src/components/home/AIStylistShowcase.tsx:20` | Канонический easing продублирован как локальный `const EASE` в нескольких файлах и инлайном | Один экспорт `EASE_STANDARD` | ◐ частично (UX-правка 2026-09-12): в CSS кривые стали токенами `--ease-*`; в JS `const EASE` остался (`AIStylistShowcase.tsx:20`, `OutfitExamplesCarousel.tsx:8`) плюс инлайн ещё в ~13 местах (раздел 7) |
| `src/components/home/AIStylistShowcase.tsx:97` (и `:495,507`) | Два tracking для eyebrow в одном компоненте: `0.22em` здесь против `0.18em` | Одно значение | актуально |
| `src/components/home/AIStylistShowcase.tsx:590` | Контейнер `px-6` без шага `md:px-12`, в отличие от всех соседних секций | `px-6 md:px-12` | актуально |
| `src/components/home/HowItWorksSection.tsx:224` | Рецепт H2 скопирован вместо `SectionH2`, базовый шаг 26px вместо 30px (цвет `text-white` здесь корректен — секция на `#050505`) | Экспортировать `SectionH2` с вариантом `onDark` | актуально |
| `src/components/home/HowItWorksSection.tsx:36` (и `:40`) | Комментарий утверждает идентичность с кнопкой лайка карточки, но размер `w-8 h-8 bg-black/85` против `w-9 h-9 md:w-7 md:h-7 bg-black/80` (`ProductCard.tsx:161`) | Совместить размер или убрать утверждение из комментария | актуально |
| `src/components/home/FeaturesBento.tsx:236` (и `:354`) | Единый CTA «в билдер» в трёх радиусах и двух весах | Один радиус кнопки | компонент мёртв, ждёт удаления |
| `src/components/home/FeaturesBento.tsx:203` | Четыре геометрии точек-пейджера | Один `<Dots>` с `tone` | компонент мёртв, ждёт удаления |
| `src/components/home/FeaturesBento.tsx:57` / `:249` | `FeaturesBento`, `HowItWorksGrid`, `AIStylistChat`, `HeroProductCycle` — мёртвый код с конкурирующим языком | Удалить | компонент мёртв, ждёт удаления (все четыре файла) |
| `src/app/browse/page.tsx:1311` (и `:1299`) | Скелетон инвертирует поверхности карточки: оболочка `--background`, блоки `--surface`, тогда как загруженная карточка — `--surface` | Оболочка `--surface`, блоки `--fg-overlay-05` | актуально |
| `src/app/browse/page.tsx:1331` | Обёртка `rounded-xl` вокруг `rounded-2xl` `OutfitCard` — hover-тень обрезается по меньшему радиусу | Снять радиус/фон с обёртки | актуально |
| `src/app/browse/page.tsx:1409` | Активная страница пагинации `rounded-lg`, тогда как все прочие выбранные контролы — `rounded-full` пилюли | `rounded-full` | актуально |
| `src/app/browse/page.tsx:893` (и `:1368`) | Две outline-кнопки одного класса разного масштаба и радиуса: «Clear filters» `rounded-lg py-2` 10px bold против «Show more» `rounded-full px-6 py-3 text-xs` | Один outline-рецепт | актуально |
| `src/components/ui/SectionLabel.tsx:23` | Мёртвый компонент, дублирующий `.label` с другим цветовым токеном | Удалить или применить `.label` | компонент мёртв, ждёт удаления |
| `src/components/ui/ClampedText.tsx:161` | Вуаль клампа уходит в `--background`, но компонент используется и внутри `--surface`-панелей — виден переход | Цвет вуали параметром | актуально |
| `src/components/product/ProductGallery.tsx:80` | Мёртвый файл со старым языком | Удалить | компонент мёртв, ждёт удаления |
| `src/components/product/PriceHistoryChart.tsx:230` | Тултип и скелетон без радиуса | `rounded-lg` / `rounded-xl` | компонент мёртв, ждёт удаления |
| `src/components/product/ProductReviews.tsx:168` | «Load more» и кнопка отправки различаются шкалой подписи и паддингом; обе без радиуса | Привести к outline-рецепту PDP | компонент мёртв, ждёт удаления |
| `src/components/product/ProductClient.tsx:210` (и `setTimeout` `:78-81`, `:88`) | Магические 260ms в трёх местах, единственная произвольная длительность в классах | Именованная константа, лучше `duration-300` | актуально; в CSS то же значение теперь токен `--dur-slow` (`globals.css:34`) |
| `src/app/builder/page.tsx:1911` | `bg-[var(--foreground)]/70` — модификатор непрозрачности на переменной вопреки договорённости `globals.css:54` (технически на Tailwind v4 работает) | Предвычисленный токен или `opacity-70` на элементе | актуально |
| `src/app/builder/page.tsx:1902` | `var(--surface-hover, var(--surface))` — токен `--surface-hover` не определён нигде, hover нулевой | `hover:bg-[var(--fg-overlay-05)]` | ✓ исправлено (UX-правка 2026-09-12) |
| `src/app/builder/page.tsx:2360` | `.animate-slide-up` объявлен в `globals.css` дважды — выигрывает второй, первый мёртв | Оставить одно объявление | ✓ исправлено (UX-правка 2026-09-12): одно объявление `globals.css:577`; анимация снова работает после починки `--ease-drawer` (ревью 2026-09) |
| `src/components/outfit/OutfitCollage.tsx:63` | Разделители коллажа — `bg-gray-200` (плашки `bg-white` при этом корректны) | `bg-[var(--border)]` | актуально; тот же `bg-gray-200` во всех копиях коллажа (строка про коллаж в Medium), в `MyLooksPanel.tsx:629` ещё `bg-[#f0f0f0]` |
| `src/components/outfit/OutfitCard.tsx:89` | Размер кнопки лайка `md:w-8 md:h-8` против `md:w-7 md:h-7` у `ProductCard.tsx:161`. Заливка здесь токенная, у `ProductCard` — сырая | Совместить размер на `md:w-7 md:h-7`, заливку двигать к токену | актуально |
| `src/app/outfit/[id]/page.tsx:204` | Обёртка `rounded-xl` вокруг `rounded-2xl` `OutfitCard` | `rounded-2xl` | актуально |
| `src/app/plans/page.tsx:202` | Бейдж «Most popular» — `text-[8px]`, ниже пола шкалы | `text-[10px]` | актуально |
| `src/app/plans/page.tsx:218` | Разделитель `border-current/10` — единственная граница вне токенного набора | Ветвление на `--fg-on-dark-60`/`--border` | актуально |
| `src/app/subscribe/page.tsx:11` | `PLAN_COPY` дословно дублирует массивы `features` из `plans/page.tsx:20,37,55`; обе страницы дублируют то, чем владеет `lib/plans.ts` | Один экспорт в `src/lib/plans.ts` | актуально |
| `src/components/auth/AuthForm.tsx:125` | Primary Clerk-кнопки `text-xs`, тогда как CTA воронки на `/subscribe` — `text-[10px]` | `text-[10px]` | актуально |
| `src/app/coming-soon/page.tsx:56` | Инлайновый `<style>` переобъявляет `fadeUp`/`fadeIn`, `dotPulse` определён дважды с разной начальной непрозрачностью | Один `dotPulse` | компонент мёртв, ждёт удаления (страница и `FeatureCarousel.tsx`; гейт «coming soon» снят при ревью 2026-09) |
| `src/app/sitemap-page/page.tsx:95` (и `:111`) | Outline-CTA без `rounded-xl`, в отличие от `about/page.tsx` (локально согласуется с hairline-сеткой страницы) | `rounded-xl` | актуально |
| `src/components/stylist/StylistDrawer.tsx:899` (и `:908`) | Ширина карточки задана инлайновым `style={{ width: 72 }}`, а изображение в соседней ветке — классом `w-[72px]` (`:870`) | Класс в обеих ветках | актуально |
| `src/components/stylist/StylistPersonalizationModal.tsx:288` (и `:296`) | Две кнопки одного футера имеют `disabled:opacity-30` и `-40` | `disabled:opacity-40 disabled:cursor-not-allowed` | актуально |
| `src/components/ui/parallax-floating.tsx:29` | Мёртвый код и единственный потребитель `src/hooks/use-mouse-position-ref` | Удалить оба | компонент мёртв, ждёт удаления |
| `src/components/ui/HeroBackground.tsx:10` | Мёртвый код; читает тему императивно через `useTheme()` | Удалить | компонент мёртв, ждёт удаления |
| `src/components/ui/animated-group.tsx:140` | Достижим только через мёртвый `hero-section-1.tsx`; свой набор пресетов анимаций, расходящийся с каноном | Удалить вместе с `hero-section-1.tsx` | компонент мёртв, ждёт удаления |
| `src/app/blog/page.tsx:61` | Eyebrow с `tracking-[0.22em]` вместо доминирующих `0.18em` | `tracking-[0.18em]` | ✓ исправлено (до 2026-09): `blog/page.tsx:27`, листинг теперь в `components/blog/JournalFeed.tsx` |
| `src/app/privacy/page.tsx:401` | `font-mono` как типографический сигнал при том, что `--font-mono` разрешается в Inter Tight (~180 вхождений в `src/` — визуальный no-op) | Либо реальный моноширинный стек в `globals.css`, либо убрать класс | актуально (на `privacy` осталось одно вхождение) |
| `src/app/goo-studio/analytics/page.tsx:159` | Тот же баннер ошибки со скруглением на одной странице админки и без — на соседней | Добавить `rounded-xl` | ✓ исправлено (ревью 2026-09): `analytics/page.tsx:180`, `goo-studio/page.tsx:159,193` |
| `src/app/goo-studio/products/page.tsx:2507` (и `:3091`) | Непрозрачность скрима подбиралась по месту: `black/40`, `/50`, `/60`, `/70` и инлайновый `rgba(0,0,0,0.5)` | Один класс `bg-black/60` | ◐ частично (ревью 2026-09): 12 скримов админки на `bg-black/60`; две модалки products остались на `bg-black/50` |
| `src/app/goo-studio/page.tsx:84` (и `:215`) | Декоративная четырёхцветная полоска (`blue/purple/emerald/amber`) на карточках дашборда, назначается по индексу массива; единственные синий и фиолетовый в админке | Убрать либо привязать к семантике | актуально (синий и фиолетовый из `activity/page.tsx` убраны при ревью 2026-09) |
| `src/app/goo-studio/users/page.tsx:431` | Ячейка шапки таблицы отличается от рецепта (9px, `--foreground-subtle`, `font-medium`) | `text-[10px] … text-[var(--foreground-muted)] font-normal` | ✓ исправлено (ревью 2026-09): `users/page.tsx:564` |
| `src/app/goo-studio/page.tsx:309` (также `:383`, `layout.tsx:677`) | Плашки админки разъехались по радиусам; `rounded-md` вне шкалы (раздел 4) | Свести плашки к `rounded-full`, `rounded-md` убрать | ◐ частично (ревью 2026-09): карта `planBadge` получила `rounded-full` (`users/page.tsx:68-73`), `rounded-md` ушёл из subscriptions; остались плашка плана на дашборде (`:309`), миниатюра (`:383`) и бейдж «Admin» в меню (`layout.tsx:677`); статус-бейдж в duplicates — `rounded-lg` (`duplicates/page.tsx:176`) |
| `src/components/admin/ImageCropEditor.tsx:172` | Редактор кадрирования и его модалка на русском, вся остальная админка на английском | Привести к английскому | актуально; то же на странице Prompts (`prompts/page.tsx`) — ревью вынесло перевод отдельным вопросом к CEO |

### Новые расхождения (сверка 2026-09-26)

Найдены при код-ревью сентября 2026 (`docs/CODE_REVIEW_2026-09.md`) и при сверке этого файла с кодом, проверены по коду 2026-09-26. Правила те же: это наблюдения, решение и отдельная задача — за CEO.

| Файл:строка | Что не так | Чем заменить | Важность |
|---|---|---|---|
| `src/app/globals.css:10` и `:29` | Токен `--ease-drawer` объявлен через самого себя: `--ease-drawer: var(--ease-drawer)` (и в `@theme inline`, и в `:root`; так же в собранном CSS). Циклическая переменная недействительна, поэтому `.animate-slide-up` (`:577`, нижние листы билдера `builder/page.tsx:2414,2804,2945`) и переход `.ov-rise` (`:719-723`, баннер cookies `CookieConsentBanner.tsx:38`) теряют анимацию входа: лист и баннер появляются рывком. Похоже на артефакт замены литералов токеном 2026-09-12. Найдено при сверке документа; стоит глазами проверить в браузере | Задать токену значение. До 2026-09-12 `.animate-slide-up` шёл на `cubic-bezier(0.32, 0.72, 0, 1)` — вероятно, это и есть задуманная «кривая Ionic/iOS» из комментария `globals.css:25` | ✓ исправлено (ревью 2026-09): токену задано `cubic-bezier(0.32, 0.72, 0, 1)` в обоих блоках |
| `src/app/goo-studio/analytics/page.tsx:66` (также `:84`, `analytics/Charts.tsx:252`, `goo-studio/page.tsx:233`) | Текст успеха `text-emerald-600` вместо `text-emerald-500` из статус-рецепта админки; то же с `text-amber-600` (`goo-studio/page.tsx:311`, `products/page.tsx:2036,2571,2573`) и hover `text-red-600` / `-700` (`users/page.tsx:1139`, `products/page.tsx:3060`) | Оттенки рецепта: текст `-500`, фон и рамка `-400` | low |
| `src/app/goo-studio/page.tsx:211` (и `:231-234`) | Карточки дашборда — `rounded-2xl` и `hover:shadow-md`, хотя карточка админки `rounded-xl`, а глубина передаётся границей; чип динамики — `bg-emerald-500/12 text-emerald-600 border-emerald-500/20` вместо базовой тройки. Ревью решило тень пока не трогать | Рецепт карточки и статус-бейджа раздела 9 | low |
| `src/app/goo-studio/settings/recipes.tsx:6-7`, `parser/page.tsx:79-80`, `import/page.tsx:52`, `email/page.tsx:391,434,670`, `parser/collect/page.tsx:52-53`, `brands/page.tsx:17-18`, `retailers/page.tsx:61-62`, `duplicates/page.tsx:59-60`, `audit/page.tsx:291`, `users/page.tsx:460` (и `:467,483,702,709`), `products/page.tsx:1853` (и `:1863,1880,1892`), `products/page.tsx:2522`, `products/page.tsx:3037,3212`, `ImageCropEditor.tsx:339` | Контурная кнопка админки без канона: радиус у всех уже `rounded-lg`, но форм не меньше восьми, основные — `text-xs`/`0.12em`/`px-4 py-2` (settings, parser, import; в email с `px-5 py-2.5`); `11px`/`0.12em`/`px-4 py-2` (collect); `11px`/`0.08em`/`px-3 py-1.5` (brands, retailers); `11px`/`0.1em`/`px-3 py-2` (duplicates, audit); `9px`/`0.14em`/`px-3`–`px-4 py-2` (users); `text-xs`/`0.1em`/`px-3 py-2` (тулбар products); `10px`/`0.1em`/`px-3 py-1.5` (products, модалка; в email `10px`/`0.12em`/`px-2.5 py-1`); `text-xs`/`0.12em`/`px-4 py-2.5`–`px-5 py-3` с заливкой по hover (ImageCropEditor, products, email). Трекинги `0.08em` и `0.1em` вне шкалы раздела 2 | Выбрать одну форму (решение CEO) и завести её в §9 рядом с primary; кандидат — самая частая, `settings/recipes.tsx:6-7` | low |
| `src/app/goo-studio/activity/page.tsx:298` (также `:388,392,418`) и по админке (`users/page.tsx:152-153,476,605-614`, `parser/page.tsx:474,505`, `audit/page.tsx:360,392`, `products/page.tsx:337,2176,2203`, `outfits/page.tsx:734,779,1150`, `goo-studio/page.tsx:231,309`) | Бейджи и подписи 9px с трекингом `0.16em` / `0.14em` / `0.12em` / `0.1em`; `0.1em` вне шкалы раздела 2 (при этом тот же `0.1em` стоит в канонической фильтр-пилюле админки, §9 п.6). Сам 9px в разделе 2 записан как «микро-подпись, чип», но там же пол шкалы назван 10px, а чеклист §10 п.6 требует «ничего меньше 10px» — документ противоречит сам себе. Ревью решило 9px не трогать | Решить, допустим ли 9px (CEO); tracking свести к `0.12` / `0.14` / `0.16` / `0.18em` | low |
| `src/app/goo-studio/analytics/page.tsx:490` (и `prompts/page.tsx:224`) | Текст 8px — ниже любой трактовки шкалы (подписи часов на тепловой карте, бейдж на Prompts); `parser/page.tsx:189` — eyebrow 9px с `tracking-[0.22em]` | `text-[10px]` (или 9px, если CEO его разрешит), `tracking-[0.18em]` | low |
| `src/app/goo-studio/products/page.tsx:3221-3250` | Второй рецепт тоста: статусная заливка на непрозрачной подложке, кнопка закрытия, `z-[100]`; на duplicates / brands / audit / categories — инверсная заливка без кнопки, `z-50` (раздел 9) | Выбрать один рецепт тоста админки | low |
| `src/app/goo-studio/products/page.tsx:2100` (также `:2507,3048,3091`) | Четыре модалки products без `role="dialog"` / `aria-modal` (у остальных модалок админки они есть); у bulk-модалки `shadow-xl` (`:2102`); бейдж «New» в таблице без радиуса (`:2434`) | Рецепт модалки §9 п.11; бейдж `rounded-full` | low |
| `src/app/goo-studio/users/page.tsx:1192-1208` (и `blog/page.tsx:801-813`) | Переключатель в users — вся строка-кнопка без `role="switch"` / `aria-checked`; в blog переключатель другого размера (`h-6 w-11` против `w-9 h-5` у `parser/page.tsx:522-533`) | Рецепт переключателя §9 п.7 | low |
| `src/app/not-found.tsx:28` (также `error.tsx:41`, `MyLooksPanel.tsx:1049`, `HeroSection.tsx:59`, `builder/page.tsx:1676`, `StylistPersonalizationModal.tsx:92`) | Модификатор непрозрачности на переменной расползся: `border-[var(--foreground)]/20`, `hover:bg-[var(--foreground)]/5`, `bg-[var(--background)]/85`, `/80`, `bg-[var(--surface)]/50` — вопреки договорённости раздела 1 (на Tailwind v4 технически работает) | Предвычисленные `--bg-overlay-*` / `--fg-overlay-*` или `opacity-*` на элементе | low |
