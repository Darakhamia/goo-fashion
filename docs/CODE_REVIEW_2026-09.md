# Код-ревью Goo Fashion — сентябрь 2026

Ревью начато 2026-09-26 по указанию CEO, вне порядка волн `AUDIT_DEV_PLAN.md`. Цель — проверить весь код: мёртвый код, поломки, оптимизации и отдельно админку (`/goo-studio`).

## План ревью

| # | Блок | Статус |
|---|---|---|
| 1 | Мёртвый код и мусор во всём репозитории | исправлено; удаление файлов ждёт разрешения CEO |
| 2 | Админка: каждая страница — работоспособность, дубли, дизайн, скорость | исправлено, плюс мобильная версия |
| 3 | API и безопасность серверной части | впереди (заметная часть закрыта по ходу: см. «Итоги») |
| 4 | Публичный сайт: страницы, компоненты, вес и скорость | впереди |
| 5 | База данных: миграции, запросы, индексы | впереди |
| 6 | Парсер и расширение | впереди |
| 7 | Качество кода: линтер, файлы-гиганты, дубли | впереди |

## Как проверялось

Блоки 1–2 прогнали 42 агента. Для каждой группы находок отдельный агент-скептик пытался опровергнуть каждую находку по коду. Опровергнуто 4, остальные подтвердились полностью или частично. У частично подтверждённых ниже уже стоит исправленное предложение. Одна и та же проблема часто найдена с разных сторон, поэтому часть пунктов повторяется.

Автоматика на момент ревью: `tsc` — чисто; `eslint` — 11 ошибок и 51 предупреждение; `knip` — 14 неиспользуемых файлов в `src/` и 3 неиспользуемых пакета.

## Решения CEO по развилкам

CEO принял рекомендации ревью («начать чинить»):

1. Режим «скоро запуск»: публичная часть удаляется — `/coming-soon`, `/api/unlock`, гейт в `proxy.ts`, публичный `/api/waitlist` и картинки. Раздел Waitlist в админке остаётся архивом уже собранных адресов, данные в базе не трогаются.
2. Image Tools в админке удаляется вместе с роутом.
3. Вкладка «AI Stylist» в Prompts удаляется: стилист этот промт не читал.
4. Звёздочка «Feature on homepage» подключается к карусели образов на главной.
5. Отзывы на товарах убираются: модерации не было, отзыв никогда не появлялся. Таблица в базе не трогается.
6. Фейковый график «Price history» удаляется целиком.
7. Блок Newsletter на `/blog` удаляется: кнопка ничего не делала.
8. Vercel Analytics и Speed Insights удаляются: прод не на Vercel. Остаются своя аналитика и PostHog.
9. Модалка Import в Products удаляется, отдельная страница Import остаётся.
10. На странице Brands появляется загрузка логотипа (роут уже был).
11. Баг-репорт переводится с Anthropic SDK на уже подключённый OpenAI.
12. Эмбеддинги: флаг семантического поиска не включается; в Settings появляется покрытие и кнопка догрузки.
13. Мобильная версия админки нужна (ответ CEO) — сделана целиком: drawer вместо сайдбара, все страницы и модалки на 375px.
14. Ответы CEO: прод на Coolify; graphify ставить (установлен, ставится сам при старте сессии). Открыто: где прод (какой провайдер сервера под Coolify и в какой стране — его надо назвать в `privacy/page.tsx`, раздел 6; пока там безымянный «Server hosting provider» вместо неверного Vercel) и заведён ли cron `/api/billing/cron/renew` в Coolify; модель цены (`price_min` в двух миграциях 019); graphify (не установлен, хуки его требуют); чистка хранилища от файлов-сирот; обложки блога с чужих сайтов.


## Итоги исправлений (2026-09-26)

Всё — в ветке `claude/elegant-pascal-z9vtak`, PR Darakhamia/goo-fashion#879. После каждого шага: `tsc` чисто, `next build` зелёный, CI зелёный. Линтер: 3 ошибки, и все в мёртвых файлах, ждущих удаления (`coming-soon/FeatureCarousel.tsx`, `ProductReviews.tsx`, `parallax-floating.tsx`); после удаления будет 0 и в CI можно снять `continue-on-error` у шага lint.

### Как делали

1. 16 групп исполнителей по непересекающимся файлам, у каждой — проверяющий, который искал регрессии и недоделки.
2. Финальный проход: связки между группами (журнал действий, передачи), SSRF, мобильная админка, слияние дублей.
3. Второе ревью всей ветки против `master` семью взглядами (безопасность, деньги, публичный сайт, админка, парсер и импорт, дизайн и мобильная версия, скорость): 37 находок, скептики опровергли 19, подтверждённые 18 исправлены.
4. Документация переписана по коду, у каждого документа — фактчекер.

### Коммиты

| Коммит | Что |
|---|---|
| `3712a73` | Данные: без демо-данных на проде, лёгкие выборки каталога, отмеченные образы на главной, noindex для ?d= |
| `5a7a1d4` | Audit, Duplicates, Categories: честные ошибки и счётчики, NUL-байты |
| `a6492a2` | Users и Subscriptions: удаление выключает автопродление, честные суммы, пагинация |
| `a274422` | Blog: даты, черновики, ошибки; `/api/blog` только для админа |
| `520efe6` | Мёртвый код внутри живых файлов |
| `a505c1a` | Сайт: без гейта coming-soon, фейкового графика цен, отзывов без модерации, Vercel Analytics; Tailwind сканирует только `src/` |
| `ec6da4f` | Products: без Seed, без чужого фото, удаление с проверкой образов, ошибки видны |
| `d18bd59` | Analytics и Activity |
| `69c9683` | Parser: ссылки на расширение, несохранённые правки |
| `9c0cd7a` | Brands (логотипы) и Retailers |
| `454b44e` | CSV-импорт через общий конвейер |
| `3f81f88` | Каркас админки и дашборд |
| `57fe45f` | Settings и Prompts (миграция `024_settings.sql`) |
| `57e20c7` | Email и Waitlist (архив) |
| `11fc1bd` | Outfits и модерация |
| `3376cb2` | `/api/upload` только для админа, лимиты на аналитику |
| `e27f10d` | `/goo-studio/brightdata` → `/goo-studio/import` с редиректом |
| `bc2f968` | Проверка внутренних адресов, предупреждения о несохранённых колонках |
| `0a26263` | Журнал действий для каталога, образов, блога, брендов, почты, промптов |
| `27ada17` | Мобильная админка, тема админки через классы |
| `2ec319f` | Удалены пакеты Vercel Analytics, Speed Insights, Anthropic SDK |
| `48786da` | Общие хелперы: «таблицы нет», текст, валюта, хост |
| `25efe50` | Предупреждение о cron на Subscriptions, редиректы при зеркалировании фото |
| `9e25210` | 18 находок второго ревью |
| `dc0bf44` | Утечка начала токена Replicate и ошибок стилиста; кривая `--ease-drawer` |
| `3d5f73d`, `f57e69e`, `e3f4ec2` | Документация |
| `fbf7d08` | graphify: граф перестроен, CLI ставится при старте сессии |

### Что открыто

**Ждёт разрешения CEO — удаление файлов.** Автоматическая проверка безопасности среды дважды заблокировала удаление, несмотря на «делай». Всё ниже проверено grep'ом: живых ссылок нет. Удалять одним коммитом, затем убрать `pathname === "/coming-soon"` из `ConditionalSiteLayout.tsx`, типы `PricePoint`/`ProductReview` из `src/lib/types.ts`, пакеты `lucide-react`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge` и строку про `button.tsx` из `CLAUDE.md`/`DESIGN_SYSTEM.md`.

- компоненты: `src/components/ui/button.tsx`, `src/components/blocks/` (hero-section-1), `src/components/ui/animated-group.tsx`, `src/components/home/{FeaturesBento,HeroProductCycle,AIStylistChat,HowItWorksGrid}.tsx`, `src/components/outfit/OutfitCarousel.tsx`, `src/components/product/{ProductGallery,PriceHistoryChart,ProductReviews}.tsx`, `src/components/ui/{parallax-floating,HeroBackground,SectionLabel}.tsx`, `src/hooks/`, `src/lib/utils.ts`;
- роуты и страницы: `src/lib/services/` + `src/app/api/nike/`, `src/app/api/admin/hero-image/`, `src/app/goo-studio/image-tools/` + `src/app/api/admin/image-tools/`, `src/app/coming-soon/`, `src/app/api/unlock/`, `src/app/api/waitlist/`, `src/app/logo.png/`, `src/app/api/products/[id]/{price-history,reviews}/`, `src/app/api/products/bulk/`, `src/app/api/admin/email/preview/`;
- мусор: `.twprobe/`, `training/`, `supabase-migration-color-groups.sql`, `public/{file,globe,next,vercel,window}.svg`, `public/cs/{.gitkeep,hoodie-card,icon-price,icon-stylist,hoodie,jeans,sneakers,outfit}.png`, `graphify-out/2026-08-07/`;
- по желанию: `vercel.json` (на Coolify не работает; если деплой на Vercel ещё жив — сначала выключить его cron, иначе два планировщика могут списать дважды).

**Вопросы CEO — деньги:**
1. Заведён ли в Coolify Scheduled Task для `/api/billing/cron/renew` и задан ли `CRON_SECRET`. Пока нет — автопродление не работает. Страница Subscriptions теперь показывает это сама.
2. Жив ли ещё деплой этого репозитория на Vercel (его cron из `vercel.json` плюс задача в Coolify = риск двойного списания).
3. `MONOBANK_PRICE_*` читаются только на сервере: если на проде они заданы, `/plans`, `/subscribe`, `/profile` и окно апгрейда показывают цены по умолчанию (399/999/1799), а списывается значение из переменных.
4. Пробелы биллинга из `BILLING.md` («Known gaps»): past_due не списывается повторно и сохраняет платный план; отменённая подписка не теряет план после конца периода; брошенный апгрейд оставляет строку pending.

**Вопросы CEO — остальное:** модель цены (две миграции 019); хостинг-провайдер и страна для раздела 6 Privacy Policy; обложки блога с чужих сайтов; чистка хранилища от файлов-сирот; удалять ли неиспользуемую таблицу `import_jobs`; настроен ли в Clerk session token с public metadata (иначе флаг isAdmin из Users → Access не пускает в админку); канон контурной кнопки и тоста в админке; допустим ли 9px.

**Проверено только по коду, без живого прогона** (в контейнере нет базы, Clerk и Upstash): поведение на реальных данных (главная с отмеченными образами, `/product/[id]` с ISR, постраничное чтение подписок и аналитики, повторный CSV-импорт), 429 на лимитах, мобильная админка в настоящем браузере. После деплоя стоит открыть главную, карточку товара, `/goo-studio/subscriptions`, `/goo-studio/products` и админку с телефона.

**Следующие блоки ревью:** 3 (API и безопасность — остаток: редиректы в прямом режиме парсера, `/api/user/looks` для вошедших, размер истории чата), 4 (публичный сайт и скорость), 5 (база), 6 (парсер и расширение), 7 (линтер, файлы-гиганты: `products/page.tsx`, `builder/page.tsx`).

---

## Полный список находок

Обозначения: 🔴 high · 🟠 medium · ⚪ low. Действие: delete / fix / simplify / merge / ask-ceo.

### Мёртвые файлы и компоненты (22)

- 🟠 **dead-file · delete** — `src/components/blocks/hero-section-1.tsx:30`  
  Старый шаблонный hero (417 строк) и его единственная зависимость animated-group.tsx (168 строк) — замкнутый мёртвый остров. Файл экспортирует имя HeroSection, как и живой home/HeroSection.tsx.  
  → Удалить оба файла и пустую папку blocks/. Всего уходит 585 строк.
- 🟠 **dead-file · delete** — `src/components/home/FeaturesBento.tsx:57`  
  Четыре секции старой главной: FeaturesBento (394), HeroProductCycle (176), AIStylistChat (136), HowItWorksGrid (50). Всего 756 строк, после редизайна их заменили AIStylistShowcase и HowItWorksSection.  
  → Удалить все четыре файла.
- 🟠 **dead-route · delete** — `src/lib/services/nikeApi.ts:217`  
  nikeApi.ts (231 строка) мёртв. Единственный вызывающий публичного роута /api/nike (50 строк) — он сам. Роут без авторизации проксирует платный RapidAPI-ключ и отдаёт наружу тело ошибки апстрима.  
  → Удалить nikeApi.ts, src/app/api/nike/route.ts и пустую папку src/lib/services. Если RAPIDAPI_NIKE_KEY задан в Vercel — убрать его. Из PROJECT_ANALYSIS.md убрать упоминание.
- 🟠 **not-wired · ask-ceo** — `src/app/goo-studio/outfits/page.tsx:496`  
  В админке «Outfits» звёздочка «Feature on homepage» записывает is_homepage_featured, но сайт этот флаг не читает. Единственный читатель — getFeaturedOutfits в db.ts, а его никто не вызывает.  
  → Нужно решение CEO. Вариант А: подключить карусель «Outfit examples» к отмеченным образам. Вариант Б: убрать колонку-звёздочку из админки вместе с getFeaturedOutfits (около 44 строк).
- 🟠 **broken · fix** — `src/lib/data/db.ts:461`  
  Если запрос к базе упал или таблица outfits пуста, публичный сайт показывает демо-образы из data/outfits.ts (Unsplash-фото, магазины с url "#"). На /outfit/o-001 фейковый образ открывается всегда, вместо 404.  
  → В ветках «ошибка» и «пусто» возвращать []/undefined — на главной уже есть пустое состояние (page.tsx:135). Демо-данные оставить только для ветки !isSupabaseConfigured (локальная разработка).
- 🟠 **perf · fix** — `src/app/saved/page.tsx:172`  
  /saved скачивает весь каталог без кэша (/api/products?raw=true, no-store), чтобы показать лайкнутые вещи. На вкладке Looks MyLooksPanel скачивает его второй раз. Демо-массив products (23 КБ исходника) попадает в клиентский бандл только как стартовое значение, которое сразу перезаписывается.  
  → Загружать каталог один раз в /saved и передавать в MyLooksPanel пропсом; стартовое значение сделать []. В идеале брать только лайкнутые вещи по ids.
- ⚪ **dead-file · delete** — `src/components/ui/button.tsx:56`  
  shadcn-кнопка на cva (56 строк). Её импортирует только мёртвый hero-section-1.tsx, до живого кода она не доходит.  
  → Удалить одним коммитом вместе с hero-section-1.tsx, иначе tsc упадёт на битом импорте. Затем убрать упоминания файла из CLAUDE.md (запрет импорта) и DESIGN_SYSTEM.md (§6, пункт 9 чеклиста §10, строка 856 в §11) — CLAUDE.md правится только с согласия.
- ⚪ **unused-dep · delete** — `package.json:14`  
  Пакеты @radix-ui/react-slot, class-variance-authority и lucide-react используются только в button.tsx и hero-section-1.tsx.  
  → После удаления двух файлов выполнить npm uninstall этих трёх пакетов и закоммитить обновлённый package-lock.
- ⚪ **dead-file · delete** — `src/components/outfit/OutfitCarousel.tsx:117`  
  Старая карусель образов (249 строк), её заменила home/OutfitExamplesCarousel. В список С3 из UX_REVIEW она не попала.  
  → Удалить файл и строку 814 из §11 DESIGN_SYSTEM.md, потому что чинить там нечего. OutfitCollage и Price остаются: их используют OutfitCard и outfit/[id].
- ⚪ **dead-file · delete** — `src/components/product/ProductGallery.tsx:14`  
  Старая галерея товара (141 строка). Карточка товара рисует галерею внутри ProductClient.  
  → Удалить файл.
- ⚪ **dead-file · delete** — `src/components/ui/parallax-floating.tsx:94`  
  parallax-floating.tsx (122 строки) мёртв. Единственный потребитель хука src/hooks/use-mouse-position-ref.ts (33 строки) — он сам, так что хук мёртв цепочкой.  
  → Удалить оба файла и пустую папку src/hooks. Живые хуки лежат в src/lib/hooks.
- ⚪ **dead-file · delete** — `src/components/ui/HeroBackground.tsx:10`  
  Фон hero с переключением картинок по теме (20 строк), нигде не используется.  
  → Удалить файл.
- ⚪ **dead-file · delete** — `src/components/ui/SectionLabel.tsx:9`  
  Компонент eyebrow-подписи (38 строк), нигде не импортируется. Дублирует утилиту .label, но с другим цветовым токеном.  
  → Удалить компонент. Судьба .label в globals.css — отдельное решение, этой находкой оно не затрагивается.
- ⚪ **unused-dep · simplify** — `src/lib/utils.ts:4`  
  После удаления мёртвых файлов cn() (clsx + tailwind-merge) останется только в gooey-text-morphing.tsx, в трёх вызовах. В живых вызовах слияние классов ничего не меняет, а tailwind-merge попадает в бандл главной.  
  → Заменить три вызова cn на шаблонную строку, удалить src/lib/utils.ts и пакеты clsx и tailwind-merge.
- ⚪ **design · delete** — `src/app/globals.css:4`  
  15 shadcn-токенов --color-background…--color-destructive-foreground в @theme inline нужны только button.tsx и hero-section-1.tsx. После их удаления токены никому не нужны.  
  → Удалить globals.css:5-19 (строки --color-*), блок --ease-* оставить. Поправить DESIGN_SYSTEM.md §1 (стр. 32).
- ⚪ **dead-file · delete** — `src/app/globals.css:339`  
  Шесть @keyframes никем не используются: marquee, marquee-vertical (его брал только мёртвый HeroProductCycle), cardSlideInFromRight, cardSlideOutToLeft, cardSlideInFromLeft, cardSlideOutToRight.  
  → Удалить globals.css:338-347 и 400-420.
- ⚪ **dead-export · delete** — `src/lib/data/outfits.ts:357`  
  Мёртвые функции-хелперы: getOutfitById, getAIOutfits, getFeaturedOutfits в data/outfits.ts; getProductById, getProductsByCategory, getFeaturedProducts в data/products.ts; getProductsByCategory в db.ts:371; preferredRetailerUrl в cart-item.ts:22; blogCategoryGroup в blog-categories.ts:81.  
  → Удалить эти функции. Сами массивы в data/*.ts живые (db.ts, seed-роут, /saved), их не трогать.
- ⚪ **code-quality · delete** — `src/components/layout/Navigation.tsx:158`  
  В шапке остался код от старого прозрачного хедера: state scrolled, слушатель scroll, isHero, showWhiteText и 5 классов (headerBg, logoColor, linkActive, linkMuted, iconColor). Всё это вычисляется и нигде не используется, а слушатель лишний раз перерисовывает Navigation (703 строки) на пороге 40px.  
  → Удалить строки 65, 97, 100, эффект 152-156 и 158-173.
- ⚪ **code-quality · delete** — `src/app/builder/page.tsx:43`  
  В билдере лежат неиспользуемые константы и состояние: FIGURE_SLOTS, CATALOG_CHIPS, PRICE_BUCKETS (~35 строк), state activeSlot (пишется в 4 местах, никогда не читается), lookNumber, функция buildDescription, переменные grpUniqueVals и groupUniqueValues.  
  → Удалить FIGURE_SLOTS, CATALOG_CHIPS, PRICE_BUCKETS, state activeSlot вместе с вызовами setActiveSlot (606, 632, 1731, 1749), lookNumber, buildDescription, grpUniqueVals и groupUniqueValues. Это примерно минус 50 строк из 3272 в builder/page.tsx. Мелочь, но по пути к Б10-1.
- ⚪ **code-quality · delete** — `src/components/outfit/OutfitCard.tsx:29`  
  Мелкие остатки: у OutfitCard пропсы size (не читается) и compact (никто не передаёт, ветка :105 всегда true); у ProductCard setActiveVariant не вызывается (useState можно заменить константой); неиспользуемые GENDERS (browse:24), sectionCls (goo-studio/products:220), theme (profile:333).  
  → Удалить пропсы size и compact, useState в ProductCard заменить константой, три переменные удалить.
- ⚪ **junk-file · delete** — `public/cs/icon-price.png`  
  Картинки, на которые никто не ссылается: public/cs/hoodie-card.png, icon-price.png, icon-stylist.png (около 2,2 МБ) и пять SVG из шаблона create-next-app (file, globe, next, vercel, window).  
  → Удалить эти 8 файлов.
- ⚪ **orphan-page · ask-ceo** — `src/proxy.ts:7`  
  Гейт «coming soon» выключен константой COMING_SOON = false, но страница /coming-soon (659 строк с FeatureCarousel) и /api/unlock остались. Страницу можно открыть и проиндексировать: в ней фейковые цены и форма waitlist.  
  → Решение CEO. Вариант А: удалить /coming-soon (page.tsx + FeatureCarousel.tsx), /api/unlock, ветку гейта в proxy.ts и четыре картинки (hoodie.png, jeans.png, sneakers.png, outfit.png — около 4,4 МБ). POST /api/waitlist после этого останется без отправителя, админку waitlist можно оставить как архив. Вариант Б: закрыть /coming-soon от индексации в robots.ts.

### Мёртвые функции в lib (18)

- 🟠 **not-wired · ask-ceo** — `src/app/goo-studio/outfits/page.tsx:496`  
  Звёздочка «Feature on homepage» в админке образов сохраняет флаг, но главная его не читает. Единственная функция, которая его читает (getFeaturedOutfits в db.ts), нигде не вызывается.  
  → Решить: либо главная берёт отмеченные образы (getFeaturedOutfits, иначе первые 9), либо убрать звёздочку, toggleOutfitHomepageFeatured и getFeaturedOutfits.
- 🟠 **broken · fix** — `src/lib/data/db.ts:461`  
  На проде при ошибке базы или пустой таблице сайт молча показывает демо-образы и демо-статьи (Unsplash-фото, магазины с url "#"). Они же уходят в sitemap и открываются по адресам /outfit/o-001.  
  → Отдавать демо-данные только когда Supabase не настроен (dev). При ошибке возвращать []/undefined и логировать, как уже делает getAllProducts.
- 🟠 **perf · fix** — `src/app/api/products/route.ts:24`  
  Запрос /api/products?ids= (корзина и «Recently viewed») грузит из базы весь каталог страницами по 1000, чтобы вернуть не больше 24 товаров. В lib нет функции «товары по списку id».  
  → Добавить в db.ts getProductsByIds(ids) через .in("id", ids) и вызывать её в ветке ids=, по аналогии и для outfits.
- 🟠 **perf · fix** — `src/app/saved/page.tsx:172`  
  Публичная /saved и панель «My looks» скачивают весь каталог через админский /api/products?raw=true без кеша (no-store), чтобы показать несколько лайкнутых вещей. Вдобавок до ответа в состояние кладутся демо-товары (~23 КБ исходника) из data/products.ts, и они попадают в клиентский бандл.  
  → Запрашивать только нужные id (?ids= пачками или отдельным эндпоинтом) и начинать с useState<Product[]>([]) без импорта демо-данных.
- 🟠 **dead-file · delete** — `src/lib/services/nikeApi.ts:217`  
  nikeApi.ts (231 строка) никто не импортирует, а это единственный вызывающий /api/nike. Сам /api/nike публичный: без авторизации проксирует платный RapidAPI.  
  → Удалить src/lib/services/nikeApi.ts и src/app/api/nike/route.ts, убрать RAPIDAPI_NIKE_KEY из окружения.
- 🟠 **code-quality · fix** — `src/app/goo-studio/categories/page.tsx:68`  
  В двух файлах админки внутри строк стоит сырой NUL-байт. Из-за этого git и grep считают их бинарными: в PR их изменения не видны («Binary file not shown»), а поиск по коду их пропускает.  
  → Заменить сырые байты на escape "\u0000" в обеих строках. Поведение не меняется, а diff и поиск снова работают.
- ⚪ **dead-export · delete** — `src/lib/data/db.ts:372`  
  В db.ts две функции нигде не вызываются: getProductsByCategory (:372) и deleteOutfit (:835). DELETE /api/outfits/[id] удаляет образ сам, в обход deleteOutfit и без её логики.  
  → Удалить обе функции. getFeaturedOutfits решается в находке про звёздочку на главной.
- ⚪ **dead-export · delete** — `src/lib/data/products.ts:573`  
  Шесть хелперов в конце демо-файлов не вызываются: getProductById, getProductsByCategory, getFeaturedProducts (products.ts:573-580) и getOutfitById, getAIOutfits, getFeaturedOutfits (outfits.ts:357-364). Страницы берут одноимённые функции из db.ts.  
  → Удалить все шесть функций, оставить только массивы демо-данных.
- ⚪ **dead-export · delete** — `src/lib/server/parser/storefront.ts:168`  
  В парсере есть мёртвые «ручки для тестов», а тестов в репо нет: resetStorefrontCache → resetShopifyCache, resetWooCache → resetStoreJsonCache, плюс resetCookieJar и forgetTransformSupport. Там же не используются PERMISSIVE, extractProductNodes и missingFields.  
  → Удалить только extractProductNodes, missingFields и PERMISSIVE. Ручки сброса кешей (reset*Cache, resetCookieJar, forgetTransformSupport) оставить: ими пользуются проверки через jiti, которыми закрываются задачи.
- ⚪ **dead-export · delete** — `src/lib/server/monobank.ts:133`  
  Мелкие функции, которые никто не вызывает: getInvoiceStatus (monobank.ts:133, вместе с InvoiceStatusResult), preferredRetailerUrl (cart-item.ts:22), blogCategoryGroup (blog-categories.ts:81), inferCategoryFromName (product-fields.ts:759), повторный экспорт upscaleImageUrl (product-fields.ts:1034), счётчики styleTermCounts/garmentTermCounts/colourTermCounts (taxonomy/*) и default-экспорт AnalyticsCharts (goo-studio/analytics/Charts.tsx:293).  
  → Удалить. getInvoiceStatus — 5 строк, при нужде (сверка платежей по Б1) пишется заново.
- ⚪ **dead-export · delete** — `src/lib/context/auth-context.tsx:20`  
  В контекстах есть поля, которые никто не читает: register в useAuth (с ним openSignUp), AuthUser.avatar и AuthUser.isAdmin, ratesLoading в валютном контексте (вместе со своим useState). Сигнатура login(email, password) вводит в заблуждение: на деле функция просто открывает окно Clerk.  
  → Удалить register/openSignUp, avatar/isAdmin из AuthUser и ratesLoading; login и logout объявить без аргументов.
- ⚪ **perf · fix** — `src/lib/server/storage/product-images.ts:22`  
  ensureProductImagesBucket не запоминает, что бакет уже есть, и шлёт createBucket в Supabase перед каждой загрузкой фото. При импорте товара это лишний запрос на каждую картинку.  
  → Добавить модульный флаг bucketReady, как в storage.ts.
- ⚪ **code-quality · merge** — `src/app/api/admin/csv-import/route.ts:80`  
  csv-import держит свои копии SIZE_SUFFIXES, cleanName и getBaseProductName, один в один как в product-fields.ts, хотя комментарий на :87-89 говорит, что хелперы туда переехали. Копия getBaseProductName в product-fields при этом никем не вызывается, и ещё одна инлайн-копия есть в goo-studio/brightdata/page.tsx:153.  
  → В csv-import импортировать cleanName и getBaseProductName из product-fields, локальные копии удалить.
- ⚪ **code-quality · merge** — `src/lib/server/duplicates.ts:53`  
  Функция hostOf написана 7 раз, а выражение «hostname без www.» ещё 15 раз встречается прямо в коде. Четыре копии работают одинаково, остальные тихо различаются (host с портом, www не убирается, запасное значение "invalid").  
  → Завести в src/lib один bareHost(url) и перевести на него копии с одинаковым поведением. Варианты с .host оставить отдельно и назвать иначе.
- ⚪ **code-quality · merge** — `src/lib/seo.ts:18`  
  Таблица валют (символ и позиция знака) ведётся в двух местах: seo.ts и currency-context.tsx, а знак ₴ ещё раз прописан в plans.ts. Новая валюта в одном месте будет форматироваться иначе, чем в другом.  
  → Вынести CURRENCIES в серверно-безопасный модуль (например src/lib/currency.ts) и брать символы и позиции оттуда и в seo.ts, и в контексте.
- ⚪ **code-quality · merge** — `src/lib/taxonomy/styles.ts:186`  
  Словари таксономии копируют друг у друга мелкие хелперы: isCyrillic (3 одинаковые копии), normalize (2 одинаковые, в gender.ts вариант) и экранирование RegExp (всего 7 копий в src/lib).  
  → Сделать src/lib/taxonomy/text.ts с isCyrillic, normalize и escapeRegExp и импортировать их во всех словарях и в парсере.
- ⚪ **code-quality · merge** — `src/app/api/brands/route.ts:64`  
  Проверка «таблицы ещё нет» (42P01/PGRST205) скопирована в 6 местах. Копия в /api/brands неполная: без PGRST205 отсутствующая таблица даёт сырой 500 вместо понятного TABLE_MISSING.  
  → Экспортировать isMissingTable из одного модуля в lib/server и использовать его во всех шести местах, заодно исправив brands.
- ⚪ **code-quality · merge** — `src/app/api/admin/email/preview/route.ts:4`  
  Предпросмотр письма в админке держит свою копию шаблона (esc, inlineFormat, textToHtml, buildHtml). Если поменять шаблон рассылки, предпросмотр продолжит показывать старый.  
  → Вынести четыре функции в src/lib/server/email-template.ts и импортировать в оба роута.

### Публичные API-роуты (12)

- 🔴 **security · fix** — `src/app/api/upload/route.ts:6`  
  /api/upload до сих пор без проверки входа: любой человек из интернета может заливать файлы до 10 МБ в публичный бакет outfit-images. Дыра из раздела 7 брифа не закрыта.  
  → Добавить requireAdmin() первой строкой, как в соседних админских роутах, и пускать только растровые типы (jpeg/png/webp/avif).
- 🔴 **broken · fix** — `src/app/api/products/[id]/price-history/route.ts:46`  
  На странице каждого товара блок «Price history» рисует выдуманный график: случайное блуждание цены за 30 дней со «скидкой в %». Настоящую историю цен никто не пишет.  
  → Сразу убрать mock и отдавать [] (при меньше чем 2 точках график сам прячется). POST и schema.sql удалить, если CEO не решит собирать настоящие снимки цен.
- 🟠 **not-wired · ask-ceo** — `src/app/api/products/[id]/reviews/route.ts:88`  
  Отзывы сохраняются с is_approved=false, а одобрить их негде. Покупатель видит «pending approval», а отзыв никогда не появится.  
  → Решить: сделать модерацию отзывов в админке или убрать блок отзывов вместе с роутом и schema.sql.
- 🟠 **security · fix** — `src/app/api/looks/share/route.ts:73`  
  /api/looks/share без входа и без лимита пишет строки в user_looks, в каждой картинка до 2 МБ. Скриптом можно быстро раздуть базу.  
  → Добавить checkNamedRateLimit с отдельным бакетом (например name:"look-share"), а не checkRateLimit. generatedImage принимать только как http(s)-URL длиной до ~2000 символов (как httpUrl в db.ts), data-URL отбрасывать.
- 🟠 **dead-route · delete** — `src/app/api/products/seed/route.ts:18`  
  Кнопка «Seed catalog» в админке товаров одним кликом добавит в живой каталог 24 демо-товара с фото из Unsplash и выдуманными ценами. Реальной пользы у неё больше нет.  
  → Удалить POST и кнопку «Seed catalog». GET можно оставить как проверку БД или перенести её в /api/admin/me.
- 🟠 **dead-route · delete** — `src/app/api/nike/route.ts:5`  
  /api/nike и src/lib/services/nikeApi.ts полностью мёртвые: их никто не вызывает. При этом роут открыт всем и тратит ключ RapidAPI, если тот задан.  
  → Удалить src/app/api/nike/route.ts и src/lib/services/nikeApi.ts (вместе с папкой services).
- 🟠 **perf · fix** — `src/app/api/products/route.ts:24`  
  Запрос ?ids= (до 24 товаров) каждый раз вытягивает из Supabase весь каталог через select * и фильтрует его в памяти.  
  → Для ?ids= делать отдельный запрос supabase.from("products").select("*").in("id", ids) и сохранять порядок как сейчас.
- ⚪ **security · fix** — `src/app/api/blog/route.ts:10`  
  GET /api/blog?all=true отдаёт черновики блога кому угодно. А публичного вызова GET без all=true в коде нет вообще.  
  → Поставить requireAdmin() на GET и убрать ветку «только опубликованные».
- ⚪ **dead-route · delete** — `src/app/api/color-groups/route.ts:11`  
  Метод POST /api/color-groups никто не вызывает, создать цветовую группу из интерфейса нельзя.  
  → Удалить POST, GET оставить.
- ⚪ **dead-route · simplify** — `src/app/api/products/group/route.ts:47`  
  Автомиграция в /api/products/group (GET-проверка и POST {action:"migrate"}) — остаток старой установки. Она не может сработать, потому что RPC run_sql нигде не создаётся.  
  → Удалить GET и ветку action:"migrate" в /api/products/group, MigrationModal с MIGRATION_SQL, ссылку «View variant migration SQL» (products/page.tsx:1853-1859) и ветки needsMigration в products/page.tsx:1132 и 1792. POST связывания и DELETE оставить.
- ⚪ **dead-route · ask-ceo** — `src/app/api/unlock/route.ts:13`  
  Набор «coming soon» не работает: /api/unlock нужен только при выключенном навсегда гейте, а /api/waitlist вызывается только со страницы /coming-soon, на которую нет ни одной ссылки.  
  → Спросить CEO. Если удаляем, то весь набор: гейт COMING_SOON/BYPASS_KEY в proxy.ts, /api/unlock, src/app/coming-soon, /api/waitlist, /api/admin/waitlist, goo-studio/waitlist и его пункты меню в goo-studio/layout.tsx:174 и 274, ветку в ConditionalSiteLayout.tsx:42, строку про waitlist в privacy/page.tsx:134. Пункт waitlist из Б5-2 тогда отпадает.
- ⚪ **security · fix** — `src/app/api/analytics/pageview/route.ts:34`  
  pageview и web-vitals, как и analytics/event, без входа и без лимита пишут строки в БД. В Б5-2 они не упомянуты.  
  → Повесить на pageview и web-vitals (и на analytics/event в рамках Б5-2) checkNamedRateLimit с отдельным бакетом, например name:"analytics" с лимитом порядка 60-120 в минуту. Общий checkRateLimit стилиста не использовать.

### API админки (15)

- 🟠 **broken · fix** — `src/app/api/admin/email/route.ts:178`  
  Рассылка считает письма отправленными, даже если Resend их отклонил. SDK Resend v6 не бросает исключение на ошибку API, а возвращает { error }, а код ловит только throw. Админ увидит «Sent 120 of 120» при битом ключе или неверифицированном домене, и с тестовой отправкой то же самое.  
  → Читать ответ batch.send: если есть res.error, класть сообщение в errors и не увеличивать sent. Так же сделано в billing-alerts.ts.
- 🟠 **broken · fix** — `src/app/goo-studio/products/page.tsx:290`  
  Когда админ уходит из поля картинки товара, файл, который уже лежит в нашем хранилище, заливается заново. Проверка «уже у нас» ищет подстроку supabase.co, а прод-хранилище живёт на supabase.goo-fashion.com. Каждый клик в поле и обратно даёт новый дубль в бакете и новый URL. Сам роут качает без таймаута, без лимита размера и без браузерных заголовков, а UI молча глотает ошибки.  
  → В роуте: если isAlreadyMirrored(url), вернуть URL как есть, иначе вызвать mirrorImageUrl(url). В UI убрать проверку по подстроке и показывать ошибку.
- 🟠 **not-wired · ask-ceo** — `src/app/api/admin/prompts/route.ts:41`  
  Промт «AI Stylist — System» в разделе Prompts редактируется и сохраняется, но стилист его не читает: системный промт зашит в коде. Правки в админке ни на что не влияют.  
  → Решение за CEO. Вариант 1: убрать вкладку AI Stylist из Prompts вместе с ключом и DEFAULT_STYLIST_PROMPT. Вариант 2: подключить getPrompt в стилисте, но сначала синхронизировать дефолт с зашитым текстом.
- 🟠 **stale-doc · fix** — `MIGRATION_RUNBOOK.md:378`  
  SUPER_ADMIN_USER_ID и NEXT_PUBLIC_SUPER_ADMIN_USER_ID нет ни в .env.example, ни в списке переменных для переезда. Если их не перенести, журнал действий отдаёт 403 всем, выдать или снять админа нельзя, и аккаунт владельца теряет защиту от удаления и бана другими админами.  
  → Добавить SUPER_ADMIN_USER_ID, NEXT_PUBLIC_SUPER_ADMIN_USER_ID и ADMIN_USER_IDS в .env.example и в шаг 2 runbook. Заодно отдавать isSuperAdmin из /api/admin/users, как уже делает /api/admin/users/[id].
- 🟠 **not-wired · ask-ceo** — `src/app/api/admin/brand-logo/route.ts:14`  
  Роут загрузки и удаления логотипа бренда рабочий, и логотипы видны покупателю на главной и в карточке товара. Но в админке нет ни одной кнопки, которая его вызывает: поставить логотип сейчас можно только руками через API или SQL.  
  → Решение CEO. Либо вернуть в Brands кнопку «логотип» (загрузить или убрать) на этот роут, либо удалить роут и ставить логотипы через SQL. Я за подключение: логотипы видит покупатель.
- 🟠 **not-wired · ask-ceo** — `src/app/api/admin/embeddings/route.ts:37`  
  Догрузку эмбеддингов (POST) и отчёт покрытия (GET) админка не вызывает. Импорт новым товарам эмбеддинг не ставит. Поэтому семантический поиск стилиста и режим ?knn=1 в field-mining работают только на товарах, для которых кто-то руками дёрнул этот роут.  
  → Спросить CEO, включён ли STYLIST_SEMANTIC_SEARCH в проде. Если да, добавить в Settings кнопку «догнать эмбеддинги» с покрытием из GET. Если нет и не планируется, роут можно удалить.
- 🟠 **ux · fix** — `src/app/goo-studio/settings/page.tsx:880`  
  Блок OpenAI API Key в Settings утверждает, что ключ питает AI Stylist и без него стилист выключен. Это неправда: стилист работает через Replicate. Без ключа OpenAI отвалятся AI-разбор в парсере, генератор постов, AI-письма и эмбеддинги, а про это там ни слова.  
  → Переписать три строки: перечислить, что реально выключится без ключа (AI в парсере, блог, письма, семантический поиск).
- ⚪ **broken · fix** — `src/app/api/admin/stats/route.ts:158`  
  Если ключ OpenAI сохранён через Settings в базе, дашборд всё равно показывает красное «OPENAI_API_KEY missing», хотя все OpenAI-функции этот ключ используют.  
  → В stats брать `await getOpenAIKey()` и в detail писать, откуда ключ (env или database).
- ⚪ **dead-route · delete** — `src/app/api/admin/hero-image/route.ts:1`  
  Роут загрузки hero-картинки главной (GET/POST/DELETE) никто не вызывает. Ключи hero_image_url и hero_image_url_light, которые он пишет в settings, сайт нигде не читает. Мёртв целиком.  
  → Удалить src/app/api/admin/hero-image целиком. Главная от этого не изменится.
- ⚪ **dead-route · ask-ceo** — `src/app/api/admin/field-mining/route.ts:72`  
  Отчёт-замер словарей автозаполнения (474 строки) из UI не вызывается, его открывают руками по ?format=text. Это диагностика: последний раз CEO присылал его 2026-09-25.  
  → Не мёртвый, не трогать. Роут — рабочий инструмент замеров, CEO гоняет его руками, и повторный прогон ещё ждёт своей очереди (BRIEF-7, 2026-09-25). Вопрос об удалении роута и помощников из mining.ts поднимать только после того, как CEO закроет донастройку словарей.
- ⚪ **orphan-page · ask-ceo** — `src/app/api/admin/image-tools/route.ts:38`  
  Роут удаления фона через Replicate вызывается только со страницы /goo-studio/image-tools, а на неё нет ни одной ссылки: в меню её нет. Это тестовый стенд. Каждый прогон кладёт в хранилище два файла, которые ни к какому товару не привязываются.  
  → Спросить CEO, нужен ли инструмент. Если нет, удалить страницу и роут. Если да, добавить в меню и дать кнопку «применить к товару», иначе файлы копятся мусором.
- ⚪ **code-quality · simplify** — `src/app/api/admin/email/preview/route.ts:4`  
  Функции сборки письма (esc, inlineFormat, textToHtml, buildHtml) скопированы один в один в роуты рассылки и превью. Поменяют шаблон в одном месте, и превью перестанет совпадать с тем, что уходит людям.  
  → Вынести четыре функции в src/lib/server/email-html.ts и импортировать их в оба роута. Роут превью оставить: он нужен странице.
- ⚪ **broken · fix** — `src/app/api/admin/email/route.ts:104`  
  Пользователи тянутся из Clerk одним запросом без пагинации. Рассылка «All users» уйдёт только 500 самым новым, счётчик тоже покажет максимум 500. Страница Users видит только 200 самых новых, и фильтр по тарифу ищет только среди них. Сейчас это незаметно, всплывёт с ростом базы.  
  → В resolveRecipients и счётчиках обходить всех по offset пачками по 500. На странице Users сделать серверную пагинацию или догрузку.
- ⚪ **code-quality · fix** — `src/app/api/admin/label-audit/route.ts:64`  
  Разделитель в claimKey — буквальный NUL-байт внутри строки. Из-за него git и grep считают файл бинарным: в PR и git diff правки этого файла не видны построчно.  
  → Заменить литеральный NUL на escape "\u0000" в двух местах: src/app/api/admin/label-audit/route.ts:64 и src/app/goo-studio/categories/page.tsx:68. Поведение не изменится, оба файла снова станут текстовыми для git и grep.
- ⚪ **dead-route · ask-ceo** — `src/app/api/admin/waitlist/route.ts:5`  
  Лист ожидания наполнялся только со страницы /coming-soon. Этот режим выключен в коде (COMING_SOON = false), ссылок на страницу нет, так что новые адреса больше не приходят. Раздел Waitlist показывает только старые записи до запуска.  
  → Спросить CEO: выгрузить адреса (кнопка Copy all есть) и удалить Waitlist вместе с /coming-soon, /api/waitlist и /api/unlock, или оставить на случай, если сайт снова закроют.

### Страницы и маршруты (11)

- 🟠 **broken · fix** — `src/components/layout/Navigation.tsx:493`  
  В выпадающем меню профиля есть пункт «Settings», он ведёт на /settings. Такой страницы нет, поэтому любой залогиненный пользователь получает 404.  
  → Перенаправить пункт на /profile?tab=account или убрать его: пункт «My profile» (строка 431) уже ведёт в профиль.
- 🟠 **orphan-page · ask-ceo** — `src/proxy.ts:7`  
  Гейт «coming soon» выключен константой в коде, а страница /coming-soon со всеми зависимостями осталась. На неё нет ни одной ссылки, и она показывает «Launching 2026» на живом сайте. От неё зависит только Waitlist в админке: форма подписки есть только внутри FeatureCarousel, поэтому новых записей в Waitlist почти не бывает.  
  → CEO решает: либо удалить /coming-soon, FeatureCarousel, /api/unlock, /api/waitlist, ветку COMING_SOON в proxy и абзацы на /cookie и /privacy (Waitlist в админке оставить только для просмотра старых email или тоже убрать), либо оставить и повесить rate-limit на /api/waitlist и noindex на страницу.
- ⚪ **orphan-page · ask-ceo** — `src/app/goo-studio/image-tools/page.tsx:1`  
  Страница админки Image Tools — тестовый стенд удаления фона через Replicate. Её нет ни в меню, ни в pageTitles, ссылок на неё нигде нет. Результат не привязывается ни к одному товару.  
  → Если удаление фона для товаров не планируется — удалить страницу и /api/admin/image-tools, поправить комментарии в product-images.ts, image.ts и PARSER.md. Если нужно — добавить пункт в меню, раздел Imports или System.
- ⚪ **dead-route · delete** — `src/app/api/nike/route.ts:1`  
  Публичный маршрут /api/nike (прокси к Nike RapidAPI) никто не вызывает. Его единственный клиент, lib/services/nikeApi.ts, нигде не импортируется.  
  → Удалить src/app/api/nike/route.ts и src/lib/services/nikeApi.ts (281 строка), убрать строку из PROJECT_ANALYSIS.md.
- ⚪ **dead-route · delete** — `src/app/api/admin/hero-image/route.ts:20`  
  Админский маршрут /api/admin/hero-image никто не вызывает. Ключи hero_image_url и hero_image_url_light, которые он пишет в settings, тоже никто не читает. Фон hero на главной от них не зависит.  
  → Удалить маршрут целиком.
- ⚪ **not-wired · ask-ceo** — `src/app/api/admin/brand-logo/route.ts:14`  
  Маршрут загрузки лого бренда есть, а кнопки в админке, которая его вызывает, нет. Поле logo_url, которое читают /api/brands и витрина магазинов, из интерфейса заполнить нельзя.  
  → CEO решает: добавить загрузку лого на /goo-studio/brands (маршрут уже готов) или удалить маршрут.
- ⚪ **dead-route · delete** — `src/proxy.ts:16`  
  В защищённых маршрутах proxy.ts указан /stylist(.*), а страницы /stylist больше нет: стилист теперь выдвижная панель.  
  → Удалить строку "/stylist(.*)" из isProtectedRoute.
- ⚪ **ux · simplify** — `src/app/goo-studio/layout.tsx:263`  
  Словарь pageTitles заполнен вручную и отстал от меню. На страницах Retailers, Duplicates, Image Tools и Parser/Collect в верхней строке написано «Admin / Admin» вместо названия.  
  → Брать заголовок из NAV_ITEMS (самый длинный href, с которого начинается pathname) и убрать отдельный словарь pageTitles.
- ⚪ **code-quality · simplify** — `src/app/goo-studio/layout.tsx:197`  
  Раздел «Import» живёт по адресу /goo-studio/brightdata, хотя внутри обычный CSV-импорт фидов (AWIN, Farfetch-скрейпер), и от BrightData ничего не осталось. Серверный маршрут берёт тип данных прямо из клиентской страницы.  
  → Переименовать папку в /goo-studio/csv-import, а пункт меню — в «CSV Import». Тип CSVMappedRow перенести в src/lib (например, рядом с product-fields), чтобы API не зависел от page.tsx.
- ⚪ **not-wired · fix** — `src/app/plans/page.tsx:33`  
  Окно апгрейда отправляет на /plans?highlight=<план>, но /plans этот параметр не читает. Пользователь, которому нужен Basic, видит выделенным Pro.  
  → Читать ?highlight на /plans и выделять нужный тариф, либо убрать параметр из ссылок.
- ⚪ **stale-doc · fix** — `src/app/sitemap-page/page.tsx:25`  
  В HTML-карте сайта в разделе Legal только Privacy и Terms. Страниц /cookie и /refund там нет, хотя они есть в футере и в sitemap.xml.  
  → Добавить Cookie Policy и Refund Policy в раздел Legal.

### Мусор в репозитории (19)

- 🟠 **perf · fix** — `src/app/globals.css:1`  
  Tailwind собирает классы со всего репозитория: из .md, .twprobe, graphify-out, training, extension — всего 402 файла вместо 307 из src. Из-за этого в продовый CSS попадают 28 лишних правил, в том числе битое `text-[var(--fg-on-dark-60/70/80)]` из DESIGN_SYSTEM.md и запрещённое `text-gray-500`.  
  → Ограничить сканер папкой src: `@import "tailwindcss" source("../");` в globals.css. После этого .md и прочий мусор перестанут влиять на CSS, а dev-сервер больше не упадёт на строке из документации.
- 🟠 **not-wired · ask-ceo** — `vercel.json:1`  
  Прод живёт не на Vercel, а на своём сервере (Coolify + nixpacks). Поэтому ежедневный cron автопродления подписок, объявленный только в vercel.json, скорее всего не запускается. При этом nixpacks.toml и .npmrc в комментариях называют платформой Railway.  
  → CEO должен подтвердить две вещи: жив ли проект в Vercel и заведён ли в Coolify Scheduled Task на /api/billing/cron/renew. Если Vercel мёртв — удалить vercel.json, перенести cron в Coolify и исправить «Railway» на «Coolify» в комментариях.
- 🟠 **stale-doc · fix** — `.env.example:1`  
  В .env.example нет переменных, без которых часть сайта не работает. Главная — ADMIN_USER_IDS: без неё админка закрыта для всех. Лишних, мёртвых переменных в файле нет.  
  → Добавить в .env.example первые девять переменных из списка с короткими комментариями. PLANE_API_KEY, RAPIDAPI_NIKE_KEY и BYPASS_KEY не добавлять: сначала решить судьбу мёртвых роутов (Plane, /api/nike, coming-soon).
- 🟠 **broken · fix** — `.env.example:4`  
  В примере NEXT_PUBLIC_SITE_URL указан с www, а сайт отвечает на www редиректом на адрес без www. Из этой переменной строится адрес вебхука monobank, так что при таком значении уведомления об оплате придут на редирект. Комментарий про Vercel Cron в том же файле тоже устарел.  
  → Поменять значение в примере на https://goo-fashion.com, а комментарий к CRON_SECRET переписать под планировщик Coolify. Отдельно сверить значение переменной в проде.
- 🟠 **code-quality · fix** — `supabase-schema.sql:1`  
  Корневые SQL-файлы не дублируют supabase/migrations, а дополняют их: только в них описаны базовые таблицы. Но даже вместе с ними схема неполная — 6 таблиц, с которыми работает код, нигде в репозитории не создаются. Поднять чистую базу из репозитория нельзя.  
  → Снять pg_dump --schema-only с прода для waitlist, stylist_chats и pending_looks. Собрать baseline-миграцию supabase/migrations/000_baseline.sql из корневых .sql, src/app/api/products/[id]/price-history/schema.sql, DDL settings из settings/page.tsx:1102 и этого дампа. Потом обновить ссылки в AUDIT_DEV_PLAN.md:119,137 и BILLING.md:28,52.
- 🟠 **code-quality · ask-ceo** — `supabase/migrations/019_product_price_usd.sql:1`  
  Два файла с номером 019 задают `price_min` противоположный смысл. Первый говорит, что это «цена в валюте магазина, а для фильтров есть price_min_usd». Второй — «price_min уже в долларах, а исходная цена лежит в source_price». Код сейчас пишет в обе схемы.  
  → CEO выбирает одну модель цены. Потом одна новая миграция приводит данные к ней и убирает лишние колонки, а один из файлов 019 перенумеровывается, чтобы номера не повторялись.
- ⚪ **junk-file · delete** — `supabase-migration-color-groups.sql:17`  
  Корневой файл про color_groups полностью заменён миграцией 021 и к тому же сломан: запустить его нельзя.  
  → Удалить supabase-migration-color-groups.sql.
- ⚪ **stale-doc · delete** — `BUILD_PROGRESS.md:1`  
  Шесть корневых .md описывают уже выполненные апрельские и июньские планы или состояние кода, которого больше нет: AI_STYLIST_ARCHITECTURE, BUILD_PROGRESS, FOLLOWUP_PLAN, IMPLEMENTATION_PLAN, PROJECT_ANALYSIS, STYLIST_IMPROVEMENTS. Это ≈163 КБ, которые путают агентов и засоряют CSS.  
  → Удалить все шесть файлов; история останется в git. Актуальный AI_ARCHITECTURE.md оставить.
- ⚪ **stale-doc · fix** — `README.md:47`  
  README — шаблон с заглушками и неверным хостингом. Как поднять проект, какие нужны переменные и где лежит админка, из него не узнать.  
  → Переписать README в 20–30 строк: реальный стек (Clerk, self-hosted Supabase, Replicate/OpenAI/Anthropic), деплой (Coolify + nixpacks), ссылка на .env.example, ссылки на AI_ARCHITECTURE, BILLING, PARSER, extension/README и MIGRATION_RUNBOOK.
- ⚪ **stale-doc · fix** — `BILLING.md:35`  
  BILLING.md правильно описывает код оплаты, но в инструкции по запуску велит «Deploy to Vercel» и полагается на Vercel Cron, которого на проде нет.  
  → Заменить шаг 3 на «Scheduled Task в Coolify: GET /api/billing/cron/renew, 0 9 * * *, заголовок Authorization: Bearer $CRON_SECRET». Сделать вместе с решением по vercel.json.
- ⚪ **stale-doc · fix** — `PARSER.md:598`  
  PARSER.md в основном актуален, но в нём нет главного способа сбора с защищённых магазинов — расширения и роута collect. Список файлов тоже отстал от кода.  
  → Дописать раздел «Сбор расширением» со ссылкой на extension/README.md и обновить дерево файлов.
- ⚪ **stale-doc · ask-ceo** — `graphify-out/GRAPH_REPORT.md:13`  
  Граф graphify устарел на 1,5 месяца, а CLI для его обновления не установлен. Хуки в .claude/settings.json при этом на каждый grep/Read требуют «MANDATORY graphify query» — агентам мешает шум, который невозможно выполнить. Внутри ещё и копия графа (папка 2026-08-07).  
  → Решение за CEO: либо поставить graphify и перестроить граф, либо убрать graphify-out, хуки и раздел в CLAUDE.md. Папку graphify-out/2026-08-07 (дубль) можно удалить при любом решении.
- ⚪ **junk-file · delete** — `.twprobe/probe.html:1`  
  .twprobe — черновая проба синтаксиса `!` в Tailwind. Никто её не использует, но сканер находит её, и 4 её класса попадают в продовый CSS.  
  → Удалить папку .twprobe.
- ⚪ **junk-file · delete** — `training/goo-stylist-dataset.jsonl:1`  
  Датасет для дообучения стилиста никто не читает, и завязан он на старый мок-каталог. Стилист работает на gpt-4.1 через Replicate без дообучения.  
  → Удалить папку training.
- ⚪ **junk-file · delete** — `public/next.svg:1`  
  В public лежат шаблонные SVG от create-next-app и три неиспользуемые PNG (≈2,2 МБ).  
  → Удалить 5 SVG, эти три PNG и .gitkeep.
- ⚪ **dead-file · delete** — `scripts/normalize_image.py:1`  
  Python-скрипт нормализации фото товаров (OpenCV) никто не вызывает и нигде не описывает. Картинки на сайте обрабатываются sharp в TypeScript.  
  → Удалить scripts/normalize_image.py, если CEO не запускает его вручную.
- ⚪ **junk-file · delete** — `.claude/settings.local.json:17`  
  Личный файл настроек Claude Code лежит в git. В нём Windows-путь конкретного компьютера, путь к временному файлу старой сессии и разрешения на git push и npm install для всех, кто склонирует репозиторий.  
  → Удалить из файла одноразовые строки 19-23. CEO решает, нужны ли общие разрешения на git и npm всем сессиям: если нужны — перенести их в .claude/settings.json. После этого убрать settings.local.json из git (git rm --cached) и добавить его в .gitignore.
- ⚪ **code-quality · simplify** — `src/app/logo.png/route.tsx:1`  
  /logo.png — не картинка, а edge-роут, который рисует «GOO» системным шрифтом. Логотип в JSON-LD поэтому не совпадает с фавиконом и шапкой (Poppins ExtraBold). Готовый icon.png 512×512 лежит рядом, а в разметке блога логотипом вообще указан favicon.ico.  
  → Указать /icon.png в обоих местах seo.ts (276 и 320) и удалить роут src/app/logo.png.
- ⚪ **not-wired · fix** — `src/app/goo-studio/parser/page.tsx:130`  
  Расширение живое и правильно связано с сайтом, но из админки на него нет ни одной ссылки. Экран /goo-studio/parser/collect открывается только из самого расширения, а вкладка «Collect catalog» про расширение молчит.  
  → Во вкладку «Collect catalog» добавить строку «Магазин блокирует сервер? Соберите его расширением» со ссылкой на /goo-studio/parser/collect, где есть инструкция по установке.

### Пакеты и настройки (14)

- 🟠 **unused-dep · delete** — `package.json:14`  
  Три пакета (@radix-ui/react-slot, class-variance-authority, lucide-react) используются только мёртвыми файлами. Живой код их не трогает. Один только lucide-react весит 39 МБ в node_modules, и эти мегабайты зря качаются при каждом `npm ci`.  
  → Удалить blocks/hero-section-1.tsx, ui/button.tsx, ui/animated-group.tsx, ui/parallax-floating.tsx и hooks/use-mouse-position-ref.ts. Затем убрать из package.json три пакета и заново собрать lock-файл.
- 🟠 **not-wired · ask-ceo** — `src/app/api/admin/prompts/route.ts:41`  
  На вкладке Prompts → «AI Stylist» админ может сохранить системный промт стилиста, но чат его не читает. Промт стилиста жёстко прописан в коде, так что правка в админке ни на что не влияет.  
  → Советую удалить вкладку «AI Stylist», ключ prompt_stylist и DEFAULT_STYLIST_PROMPT. Если подключать промт из админки, правка может сломать JSON-контракт и защиту от инъекций, поэтому это решение продукта.
- 🟠 **dup-feature · ask-ceo** — `src/app/layout.tsx:93`  
  На сайте четыре системы аналитики: своя, PostHog, Vercel Analytics и Vercel Speed Insights. Speed Insights собирает те же web-vitals, что и своя. Vercel Analytics считает те же просмотры, что и своя.  
  → Оставить свою аналитику (её видно в админке) и PostHog, если ключ задан. Убрать @vercel/analytics и @vercel/speed-insights вместе с абзацем в cookie/page.tsx:103.
- 🟠 **not-wired · ask-ceo** — `vercel.json:1`  
  Сборка настроена под Railway (nixpacks), а код рассчитан на функции, которые есть только у Vercel. Если прод на Railway, ежедневный cron продления подписок из vercel.json не запускается вовсе, а Vercel-аналитика не заработает никогда.  
  → Нужен ответ CEO, где живёт прод. Если на Railway, перенести cron в планировщик Railway или внешний, убрать Vercel-аналитику и поправить README/privacy.
- 🟠 **not-wired · ask-ceo** — `src/app/api/stylist/chat/route.ts:23`  
  Семантический поиск стилиста включается только переменной окружения STYLIST_SEMANTIC_SEARCH, в админке про неё ничего нет. Эмбеддинги заполняются только ручным POST-запросом без кнопки, а новые товары их вообще не получают. Выходит, функция либо выключена и это мёртвый код, либо включена и не видит новые товары.  
  → Не удалять admin/embeddings, lib/server/embeddings.ts и колонку. Починить реальную дыру: считать эмбеддинг при импорте или сохранении товара, либо дать в админке кнопку бэкфилла с покрытием из GET /api/admin/embeddings. Включать ли STYLIST_SEMANTIC_SEARCH в чате, решает CEO (см. BRIEF-7, строка 169).
- ⚪ **dead-route · ask-ceo** — `src/proxy.ts:7`  
  `COMING_SOON = false` зашит в код, поэтому гейт «скоро запуск» навсегда выключен. Код гейта, /api/unlock и BYPASS_KEY мёртвые. При этом страница /coming-soon с формой вейтлиста по-прежнему открыта всем и индексируется.  
  → Если закрытый режим больше не нужен: удалить гейт из proxy.ts, /coming-soon, /api/unlock, абзац про goo_preview, а заодно /api/waitlist и /goo-studio/waitlist. Тогда отпадёт и рейт-лимит для waitlist из Б5-2. Если нужен: сделать флаг через env, как советует комментарий в proxy.ts:6.
- ⚪ **dup-feature · ask-ceo** — `src/app/api/report-bug/route.ts:3`  
  Из-за одной фичи оформления баг-репортов на сайте держится третий LLM-провайдер со своим ключом: @anthropic-ai/sdk и ANTHROPIC_API_KEY. Всё остальное AI работает через OpenAI SDK и Replicate. Вдобавок модель claude-sonnet-4-20250514 у Anthropic помечена устаревшей.  
  → Вариант 1: перевести report-bug на уже подключённый клиент OpenAI (картинки он принимает) и удалить @anthropic-ai/sdk и ANTHROPIC_API_KEY. Вариант 2: оставить Claude, но заменить модель на актуальную.
- ⚪ **dead-route · delete** — `src/app/api/admin/hero-image/route.ts:1`  
  Роут загрузки hero-картинки пишет в настройки ключи hero_image_url и hero_image_url_light, которые никто не читает. Кнопки для него в админке тоже нет.  
  → Удалить роут целиком. По желанию стереть строки hero_image_url* из таблицы settings.
- ⚪ **broken · fix** — `src/app/api/admin/stats/route.ts:158`  
  В Settings можно сохранить ключ OpenAI в базу, и весь AI-код его подхватывает. Но блок здоровья на Overview проверяет только env и показывает «OPENAI_API_KEY missing», хотя всё работает.  
  → В stats/route.ts проверять `await getOpenAIKey()` вместо process.env.
- ⚪ **code-quality · fix** — `src/app/goo-studio/layout.tsx:9`  
  Супер-админ задан двумя разными переменными: клиент смотрит на NEXT_PUBLIC_SUPER_ADMIN_USER_ID, сервер на SUPER_ADMIN_USER_ID. Если они разойдутся или одну забудут задать, пункт Activity пропадёт у настоящего супер-админа или появится у обычного админа, который получит 401.  
  → Везде брать признак из /api/admin/me и удалить NEXT_PUBLIC_SUPER_ADMIN_USER_ID. Заодно Clerk-id супер-админа перестанет попадать в публичный бандл.
- ⚪ **not-wired · fix** — `src/lib/server/parser/configs.ts:156`  
  Парсер умеет применять свои настройки загрузки к отдельному сайту (например, рендер JS), но задать их нельзя. API выбрасывает это поле при сохранении, а в UI его нет.  
  → Вариант 1: добавить в карточку сайта галочку «Render JS» и таймаут и пропускать fetch в санитайзере. Вариант 2: удалить поле и функцию.
- ⚪ **code-quality · fix** — `src/app/goo-studio/settings/page.tsx:1102`  
  Для таблицы settings нет миграции. В ней хранятся ключ OpenAI, промты, настройки парсера и главной. Её SQL лежит только текстом в админке и в BUILD_PROGRESS.md, так что на новом окружении половина админки молча не работает.  
  → Добавить supabase/migrations/023_settings.sql с `create table if not exists settings` и RLS, а блок с SQL из UI убрать.
- ⚪ **code-quality · fix** — `src/app/api/admin/label-audit/route.ts:64`  
  В двух исходниках прямо в строках стоит сырой символ NUL. Из-за него git считает файлы бинарными: в PR их дифф не виден, а grep и линтеры по ним не ищут.  
  → Заменить сырой символ на экранирование "\u0000". Поведение не изменится.
- ⚪ **unused-dep · simplify** — `src/lib/utils.ts:1`  
  После удаления мёртвых файлов (см. dead-shadcn-deps) функция cn(), а с ней clsx и tailwind-merge, останется нужна одному файлу, gooey-text-morphing.tsx. Там три вызова без конфликтующих классов.  
  → Заменить cn на склейку `[a, b].filter(Boolean).join(" ")`, удалить lib/utils.ts, clsx и tailwind-merge. Делать только после dead-shadcn-deps.

### Админка: analytics+activity (17)

- 🔴 **broken · fix** — `src/app/api/admin/analytics/route.ts:121`  
  Все цифры аналитики считаются из сырых строк, а Supabase отдаёт не больше 1000 строк на запрос, и .limit(200_000) этот потолок не снимает. Как только в окне больше 1000 просмотров, счётчики упираются в 1000. А из-за сортировки ts по возрастанию сохраняются самые старые строки, поэтому последние дни пропадают.  
  → Сначала проверить PGRST_DB_MAX_ROWS у сервиса rest в Coolify. Если там 1000, находка high, и подсчёт надо переносить в SQL (RPC с count/group by). Если лимита нет, сейчас достаточно сменить сортировку pvQ на убывание и показывать предупреждение, когда пришло ровно limit строк. Перенос в SQL отложить до роста трафика (связано с BRIEF-7: таблицы не чистятся).
- 🟠 **broken · fix** — `src/app/api/admin/analytics/route.ts:342`  
  Unique Visitors, DAU/WAU/MAU и New/Returning считаются по session_id, а он меняется после 30 минут простоя. Поэтому Returning почти всегда около нуля, stickiness занижена в разы, а Unique Visitors на деле число сессий (та же цифра уже стоит подписью «unique sessions» под Page Views).  
  → Быстрый вариант: честно переименовать метрики в Sessions и убрать Returning и Stickiness. Постоянный id посетителя меняет обещание cookie-политики, это решение за CEO.
- 🟠 **not-wired · fix** — `src/app/api/admin/analytics/route.ts:300`  
  Шаги воронки Saved outfit и Generated look и карточка Image Generations всегда показывают 0, а под карточкой написано «no failures». События save_outfit, generate_success и generate_error на сайте нигде не отправляются.  
  → Пока не сделана Б4-2, скрыть эти шаги и карточку или подписать «not tracked yet», чтобы ноль не читался как факт.
- 🟠 **broken · fix** — `src/components/analytics/AnalyticsTracker.tsx:62`  
  Время загрузки берётся из navigation-записи браузера, а она одна на вкладку. При переходах внутри сайта каждой новой странице приписывается время первой загрузки, поэтому Avg Load Time, p75 и «ms avg» в Top Pages врут. Кроме того, Avg TTFB и TTFB в Web Vitals считаются по разным формулам и показывают на экране две разные цифры.  
  → Писать load_ms и ttfb_ms только для первого (жёсткого) просмотра во вкладке, остальным ставить null. Карточку Avg TTFB убрать: TTFB уже есть в Core Web Vitals.
- 🟠 **broken · fix** — `src/app/api/analytics/web-vitals/route.ts:14`  
  Web Vitals собираются и со страниц админки: трекер не пропускает /goo-studio, а сервер отсекает только старый префикс /admin. Тяжёлые админ-страницы портят p75 сайта.  
  → В обоих роутах заменить /admin на /goo-studio, а в трекере не отправлять vitals с путей /goo-studio.
- 🟠 **broken · fix** — `src/app/api/admin/analytics/route.ts:163`  
  Ошибки запросов к page_views, web_vitals и analytics_events не проверяются. При таймауте или сбое админ видит нули вместо сообщения об ошибке.  
  → Если упал любой из основных запросов, возвращать 500 с текстом ошибки: баннер на странице уже есть.
- 🟠 **broken · fix** — `src/app/api/admin/analytics/route.ts:195`  
  График Traffic Over Time никогда не показывает сегодняшний день, а в режиме 24h текущий час. Корзины заканчиваются вчера или прошлым часом, и сегодняшние просмотры отбрасываются. Stylist Messages на 24h при этом считает весь вчерашний день плюс сегодня.  
  → Строить корзины от текущего дня или часа назад. Для 24h фильтровать стилиста по сегодняшней дате или подписать «since yesterday».
- 🟠 **dup-feature · ask-ceo** — `src/app/layout.tsx:93`  
  На сайте три параллельные системы аналитики: своя (page_views, web_vitals, analytics_events), PostHog (только после согласия на куки) и Vercel Analytics + Speed Insights. Админка показывает только свою: PostHog и Vercel в ней нигде не читаются, Vercel по плану отдаёт 404, а Web Vitals пишутся дважды.  
  → Vercel Analytics и Speed Insights убрать: два компонента в layout.tsx, две зависимости в package.json, упоминания в cookie/page.tsx:103 и privacy/page.tsx:219. На текущем хостинге они не могут работать (это закрывает Б4-1 веткой «отказ»). Решение за CEO только одно: оставлять ли PostHog вместе со своей системой.
- ⚪ **broken · fix** — `src/app/goo-studio/analytics/page.tsx:108`  
  Переключение 24h/7d/30d/90d не отменяет предыдущий запрос. Если медленный ответ (90d) придёт после быстрого, на экране останутся чужие данные, а в заголовке будет выбранный диапазон. После ошибки старые данные тоже подписаны новым диапазоном.  
  → Добавить AbortController или игнорировать ответ, у которого data.range не совпадает с выбранным. Подпись брать из data.range.
- ⚪ **dup-feature · delete** — `src/app/goo-studio/analytics/page.tsx:229`  
  Блок Revenue & Subscriptions повторяет страницу Subscriptions: та же таблица subscriptions и те же формулы MRR, past_due, canceled и autoRenewOff, только беднее.  
  → Убрать блок и запрос subscriptions из аналитики или заменить блок ссылкой на /goo-studio/subscriptions.
- ⚪ **dead-export · delete** — `src/app/goo-studio/analytics/Charts.tsx:293`  
  Default-экспорт AnalyticsCharts нигде не импортируется, knip прав. API ещё считает поля, которые страница не читает (medianLoadMs, p90, median, generatedAt), и выбирает лишние колонки.  
  → Удалить default-экспорт, неиспользуемые поля ответа и колонки из select, поправить комментарий в types.ts.
- ⚪ **broken · fix** — `src/app/goo-studio/activity/page.tsx:112`  
  Кнопки фильтра по админам строятся из уже загруженных записей. После выбора админа остаются только его записи, остальные кнопки пропадают, и переключиться на другого можно только через All admins. Грузятся последние 100 записей без Load more, а при фильтре подпись «across all admins» неверна.  
  → Список админов получать отдельно (distinct admin_id/admin_email) и добавить Load more через offset.
- ⚪ **ux · fix** — `src/app/goo-studio/activity/page.tsx:17`  
  Подписи и цвета есть только для 9 из 27 действий, которые реально пишутся в журнал. Остальные 18 (parser.*, products.*, categories.updated, retailer_domain.*, settings.homepage_*) показываются сырым ключом вроде parser.crawl_batch с иконкой-карандашом.  
  → Типизировать ACTION_LABELS как Record<AdminAction, string>, чтобы TS заставил заполнить все действия, и добавить фильтр по типу действия.
- ⚪ **broken · fix** — `src/lib/server/audit.ts:43`  
  14 записей в журнал делаются через void logAdminAction без await, уже после ответа клиенту, а ошибки записи глотаются. На Vercel функция может остановиться раньше, чем insert дойдёт, и часть действий не появится в Activity.  
  → Не переписывать на after(): на текущем хостинге это ничего не даст. Достаточно брать общий клиент из @/lib/supabase (с таймаутом) и логировать error из insert через console.error. Severity low.
- ⚪ **design · fix** — `src/app/goo-studio/activity/page.tsx:189`  
  Список Activity сделан не по рецепту карточки админки. У обёртки нет фона --background и overflow-hidden, поэтому hover строк bg-[var(--surface)] совпадает с холстом и не виден. Бейджи используют blue и purple (вне трёх статусов), оттенки 500/600 не по рецепту, текст 9px и tracking 0.16/0.12/0.1em.  
  → Обёртке дать rounded-xl border overflow-hidden и фон var(--background) (рецепт карточки админки). Тогда существующий hover:bg-[var(--surface)] станет виден, --fg-overlay не нужен. blue и purple заменить на нейтральный бейдж или amber. 9px и tracking не трогать, это по шкале раздела 2. Поправить DS-11:917: синий и фиолетовый есть ещё в activity/page.tsx:34-35.
- ⚪ **not-wired · simplify** — `src/app/goo-studio/activity/page.tsx:80`  
  Доступ к Activity держится на двух разных переменных с одним значением: NEXT_PUBLIC_SUPER_ADMIN_USER_ID (меню и экран) и SUPER_ADMIN_USER_ID (API). Ни одной нет в .env.example. Без публичной пункт меню пропадает, без серверной страница открывается, но всегда получает 403.  
  → В layout и activity брать признак супер-админа из /api/admin/me и убрать публичную переменную. Как минимум, добавить обе переменные в .env.example.
- ⚪ **stale-doc · fix** — `DESIGN_SYSTEM.md:820`  
  Строка DS-11 про --foreground-rgb в Charts.tsx:256 устарела: в коде это уже исправлено.  
  → Пометить строку 820 в разделе 11 как исправленную.

### Админка: audit+duplicates (13)

- 🟠 **broken · fix** — `src/app/goo-studio/audit/page.tsx:315`  
  На странице Audit строки различаются только по «поле + товар», а не по самому предложению. Поэтому если нажать Dismiss или Apply в одной строке, другая строка того же товара тоже покажется «Dismissed» или «Applied», хотя с ней ничего не делали.  
  → Для ключа hidden/busy и React key брать всё предложение целиком (id+field+stored+suggested), как claimKey в API. Для done ключ «поле+товар» оставить только у полей с одним значением, у colour group — тоже по полному предложению.
- 🟠 **ux · fix** — `src/app/goo-studio/duplicates/page.tsx:219`  
  Кнопка «Not the same item» навсегда запоминает, что все карточки группы — разные вещи. Подтверждения нет, галочки Merge она не учитывает, и отменить это в интерфейсе нельзя.  
  → Добавить confirm() с перечнем карточек и запоминать «разные» только для снятых галочкой карточек против оставляемой. Либо дать способ вернуть такую пару.
- 🟠 **dup-feature · ask-ceo** — `src/app/api/admin/recategorize/route.ts:107`  
  Кнопка «Fix categories» на странице Products массово переписывает категории по той же таблице ключевых слов (matchCategory по названию), по которой Audit предлагает правки по одной. При этом Audit прямо говорит, что массового применения здесь нет и быть не должно. Два инструмента с противоположными подходами к одному и тому же.  
  → Не удалять и не отвлекать на это CEO: инструменты не конфликтуют. Самое большее — одна строка в заметке на странице Audit о том, что «Fix categories» на Products массово применяет тот же словарь, но только к товарам без подкатегории.
- ⚪ **code-quality · fix** — `src/app/api/admin/label-audit/route.ts:77`  
  Если таблицу отклонённых предложений прочитать не удалось, API молча считает, что отклонённых нет. Все отклонённые пункты возвращаются в список, а админ не понимает почему. Без миграции 012 Audit тоже молчит, пока не нажмёшь Dismiss.  
  → Вернуть из label-audit флаг наподобие dismissalsAvailable (и отличать «таблицы нет» от прочих ошибок) и показать баннер, как на Duplicates.
- ⚪ **broken · fix** — `src/app/goo-studio/audit/page.tsx:236`  
  Счётчики на Audit врут в двух случаях. В режиме Dismissed в «N things worth a second look» попадают уже отклонённые пункты. А если в разделе больше 300 пунктов, в шапке стоит полное число, показаны только 300, и об этом нигде не сказано.  
  → Считать итог без отклонённых и под разделом писать «показано 300 из N», если список обрезан.
- ⚪ **design · fix** — `src/app/goo-studio/audit/page.tsx:273`  
  Audit сделан не по рецептам админки, хотя соседняя Duplicates сделана правильно. У плашки ошибки нет радиуса и цвета не те, тост ошибки с тенью и красной заливкой, у кнопки Apply нет скругления, а у соседних кнопок оно есть.  
  → Добавить rounded-xl баннеру ошибки на audit/page.tsx:273 (как в DS-11 для analytics:159) и rounded-lg кнопке Apply на :364. Цвета баннера и тост не трогать: канона для них нет, и такой же стиль стоит на соседних страницах.
- ⚪ **code-quality · fix** — `src/app/goo-studio/audit/page.tsx:119`  
  Таймер тоста в Audit не сбрасывается. Если сделать два действия подряд, второй тост пропадёт раньше времени по таймеру первого.  
  → Сделать как в Duplicates: таймер в useEffect, зависящем от toast, с clearTimeout.
- ⚪ **perf · simplify** — `src/app/goo-studio/audit/page.tsx:148`  
  Кнопка «Dismissed» заново прогоняет весь аудит на сервере, хотя ей нужно только показать или скрыть уже известные строки.  
  → Всегда отдавать отклонённые с пометкой dismissed и фильтровать их на клиенте, без повторного запроса.
- ⚪ **code-quality · delete** — `src/app/api/admin/label-audit/route.ts:439`  
  Текстовый вывод аудита (?format=text) никто не вызывает. Кроме того, он держит второй набор названий разделов, который дублирует тексты на странице.  
  → Удалить ветку format=text и словарь titles, если CEO подтвердит, что не открывает эту ссылку вручную.
- ⚪ **broken · fix** — `src/app/api/admin/recategorize/route.ts:179`  
  «Undo fix» всегда отменяет последний прогон, даже если его уже отменили. Второе нажатие выдаёт «Restored 0 · N changed since» и пишет лишнюю запись в журнал. Отменить более ранний прогон нельзя.  
  → Если после последнего прогона уже есть запись recategorize_undone, отвечать «уже отменено» и ничего не писать.
- ⚪ **perf · simplify** — `src/app/api/admin/recategorize/route.ts:133`  
  Recategorize обновляет товары по одному запросу на товар и по очереди, а Undo делает по два запроса на товар. На большом прогоне это сотни запросов подряд в одном HTTP-вызове, и maxDuration не задан.  
  → Низкий приоритет, делать только попутно: сгруппировать update по целевой категории через .in('id', ids), а в undo читать текущие категории одним select .in('id', …). Срочности нет, потому что на размеченном каталоге изменений почти нет.
- ⚪ **ux · fix** — `src/app/goo-studio/layout.tsx:263`  
  На странице Duplicates верхняя строка показывает «Admin / Admin», потому что для неё не задан заголовок. То же на Retailers.  
  → Добавить в pageTitles строки для duplicates и retailers, а лучше брать заголовок из NAV_ITEMS, чтобы списки больше не расходились.
- ⚪ **dead-route · keep** — `src/app/api/admin/field-mining/route.ts:72`  
  На field-mining нет ни одной кнопки в админке, открыть его можно только по ссылке вручную. Но это рабочий инструмент замера, которым CEO пользуется, поэтому удалять не нужно.  
  → Оставить как есть. Если роут когда-нибудь удалят, вместе с ним удалить хелперы mining.ts из списка, но matchCategoryByRules оставить: он нужен matchCategory (product-fields.ts:740), убрать можно только export.

### Админка: blog (15)

- 🔴 **security · fix** — `src/app/api/blog/route.ts:7`  
  GET /api/blog?all=true отдаёт всем подряд, без входа, все посты вместе с черновиками и полным текстом. Любой может прочитать ещё не опубликованные анонсы.  
  → В GET поставить requireAdmin(), хотя бы для all=true. Роут нужен только админке, так что можно закрыть его целиком или перенести в /api/admin/blog.
- 🟠 **broken · fix** — `src/app/goo-studio/blog/page.tsx:129`  
  Каждое сохранение поста сдвигает дату публикации на смещение часового пояса админа: в Киеве на 2–3 часа назад. Пост, опубликованный около полуночи по UTC, после одного «Save changes» уезжает на предыдущий день.  
  → Заполнять поле местным временем (сдвинуть на getTimezoneOffset перед slice) либо отправлять publishedAt только когда админ его реально поменял.
- 🟠 **broken · fix** — `src/app/goo-studio/blog/page.tsx:217`  
  Если удаление не прошло (500, 401, 501, сеть), админ ничего не видит: строка остаётся, ошибки нет. Сетевой сбой вообще уходит в необработанный promise rejection.  
  → Добавить обработку !res.ok и catch, показать ошибку через alert или строку над таблицей.
- 🟠 **broken · fix** — `src/lib/data/db.ts:887`  
  Если таблица blog_posts пуста или Supabase вернул ошибку, админка молча показывает 6 зашитых фейковых постов как настоящие. Кнопки Edit и Delete на них не работают. Удалишь последний реальный пост — эти фейки всплывут и в админке, и на публичном /blog.  
  → Для all=true (админка) не подставлять заглушку: при ошибке отдавать её явно, при пустой таблице — пустой список. Если прод-БД живая, файл src/lib/data/blog.ts и фолбэк можно выпилить совсем.
- 🟠 **broken · fix** — `src/lib/data/db.ts:874`  
  Пост, созданный вручную без раскрытия «Advanced options», сохраняется с пустой категорией. На публичной странице поста рисуется пустая рамка-пилюля со ссылкой на /blog?category=.  
  → В blogPostToDb писать p.category?.trim() || "General" либо сделать категорию обязательной и вынести её из Advanced в основную форму.
- ⚪ **broken · fix** — `src/app/goo-studio/blog/page.tsx:513`  
  Крестик AI-модалки работает и во время генерации. Если закрыть модалку и открыть правку другого поста, пришедший ответ AI затрёт форму, а правка тихо превратится в «New Post»: несохранённые изменения пропадут.  
  → Добавить крестику disabled={aiLoading} или игнорировать ответ, если модалку закрыли (флаг или AbortController).
- ⚪ **ux · fix** — `src/app/goo-studio/blog/page.tsx:255`  
  Кнопка называется «AI Draft», но сгенерированный текст открывается с включённым «Published», и главная кнопка — «Publish post». Один клик — и непроверенный AI-текст уже на сайте.  
  → Для AI-черновика ставить isPublished: false, чтобы главная кнопка была «Save draft».
- ⚪ **broken · fix** — `src/lib/data/db.ts:883`  
  Когда черновик переключают в Published, дата публикации остаётся датой создания черновика. Пост, пролежавший в черновиках неделю, выходит задним числом и встаёт в ленте ниже более новых.  
  → При переходе draft→published, если дату не меняли руками, ставить publishedAt = сейчас.
- ⚪ **broken · fix** — `src/app/api/blog/[id]/route.ts:52`  
  После удаления страница поста /blog/<slug> ещё до 5 минут открывается из кеша. То же со старым адресом после смены slug.  
  → В DELETE перед удалением прочитать slug и вызвать revalidatePath(`/blog/${slug}`). В PUT делать то же для старого slug.
- ⚪ **ux · fix** — `src/app/goo-studio/blog/page.tsx:377`  
  Если поиск ничего не нашёл, таблица пишет «No posts yet. Click New Post to create one», хотя посты есть.  
  → Если posts.length > 0, выводить «Nothing matches “…”».
- ⚪ **ux · fix** — `src/app/goo-studio/blog/page.tsx:357`  
  На экранах уже 1024px колонка Status скрыта: с телефона или планшета не видно, черновик это или опубликованный пост. При этом декоративная колонка Cover видна всегда.  
  → Показывать Status с md или выводить маленькую метку Draft под заголовком на узком экране.
- ⚪ **design · fix** — `src/app/goo-studio/blog/page.tsx:345`  
  Blog — единственная страница админки, где таблица, миниатюра, плашки и переключатель остались прямоугольными. На остальных страницах таблицы rounded-xl, у шапки фон surface, а переключатель круглый.  
  → Добавить обёртке таблицы rounded-xl (DS §9 п.2), фон var(--surface) у строки thead, миниатюре rounded-lg или rounded-xl, плашкам категории и статуса rounded-full (как советует DS-11). Тумблеру дать rounded-full и role=switch/aria-checked, но цвета оставить токенами (bg-[var(--foreground)] / bg-[var(--border)] и bg-[var(--background)] у кружка), а не копировать bg-white/bg-emerald-500 из parser.
- ⚪ **broken · fix** — `src/app/api/admin/generate-post/route.ts:154`  
  Промпт URL-режима просит 500–800 слов HTML плюс 6 полей JSON, а лимит ответа — 1500 токенов. Запаса почти нет: если статья выйдет длиннее, JSON обрежется и админ получит «Could not parse AI response as JSON», хотя деньги за вызов уже списаны.  
  → Это не поломка, а риск (kind: risk, low). Поднять max_tokens до примерно 2500-3000, добавить response_format: { type: 'json_object' } (слово JSON в промпте уже есть), а при finish_reason === 'length' возвращать понятную ошибку «ответ AI обрезан» вместо «Could not parse».
- ⚪ **design · ask-ceo** — `src/app/api/admin/generate-post/route.ts:176`  
  В URL-режиме обложкой поста становится og:image чужого сайта (Vogue и т.п.), он хотлинкается навсегда. Такая картинка может в любой момент пропасть или закрыться от хотлинка, и есть вопрос прав на изображение.  
  → Решение за CEO: оставлять чужие обложки, перезаливать их к себе через /api/admin/upload-image или не подставлять og:image вовсе.
- ⚪ **code-quality · simplify** — `src/app/goo-studio/blog/page.tsx:49`  
  Функция slugify скопирована слово в слово в страницу и в роут генерации. Если поменять одну копию, slug от AI и ручной разойдутся.  
  → Вынести в src/lib/blog-render.ts (или рядом) и импортировать в обоих местах.

### Админка: brands+retailers (12)

- 🟠 **not-wired · ask-ceo** — `src/app/api/admin/brand-logo/route.ts:14`  
  Роут загрузки и удаления логотипа бренда (POST и DELETE) никто не вызывает. Сайт при этом логотипы читает, а поставить их из админки негде.  
  → Решить: либо добавить в Brands кнопку загрузки логотипа в строке бренда (роут уже готов), либо удалить роут. Если удалять, остаётся запасной вариант с фавиконкой по домену.
- 🟠 **dup-feature · ask-ceo** — `src/app/goo-studio/products/page.tsx:391`  
  Сами страницы Brands и Retailers друг друга не дублируют, а данные о магазинах пересекаются. В поле Store редактора товара подсказываются бренды из таблицы brands (Zara, Acne…), а не названия магазинов из правил Retailers (Farfetch…). Логотип магазина тоже ищется в brands по имени магазина.  
  → Вопрос к CEO: где живёт «магазин». Минимум без миграций: добавить в datalist поля Store названия из правил Retailers (retailer_domains.name), а логотип магазина без записи в brands брать из фавиконки домена (storeFaviconUrl). Если хранить свои логотипы магазинов, нужна колонка logo в retailer_domains, и это отдельная задача.
- 🟠 **broken · fix** — `src/app/goo-studio/retailers/page.tsx:348`  
  Страница ищет товары правила по точному совпадению домена, а сервер относит к правилу и поддомены. Возьмём правило shop.com при товарах на eu.shop.com: в колонке «In catalogue» будет «—», а Apply to existing заблокирована с ложной подсказкой «No products link to this domain».  
  → Для правила суммировать productCount по всем строкам discovered, у которых ruledBy === rule.domain, и от этой суммы включать кнопку Apply.
- 🟠 **broken · fix** — `src/app/goo-studio/retailers/page.tsx:159`  
  Удаление правила не проверяет ответ сервера: если удаление не прошло (500/503/401), правило просто остаётся, и сообщения нет. Ошибка Apply выводится тем же серым текстом, что и успех, и её легко не заметить.  
  → В remove проверять res.ok и показывать json.error красным (text-red-500, как formError). Для Apply завести отдельное состояние ошибки красного цвета.
- ⚪ **broken · fix** — `src/app/api/admin/retailer-domains/apply/route.ts:50`  
  Сбор доменов и Apply читают товары одним запросом .limit(5000), без пагинации и сортировки. Supabase по умолчанию отдаёт не больше 1000 строк. Когда каталог перерастёт 1000 товаров, Apply молча обновит только часть, а предупреждение «scanned the first N» не появится.  
  → Листать товары через .order('id').range() страницами по 1000, как в duplicates/route.ts, и вынести это в общий хелпер для обоих роутов.
- ⚪ **code-quality · simplify** — `src/app/goo-studio/brands/page.tsx:9`  
  Около 90 строк страницы уходят на режим «таблицы нет, работаем в памяти»: вшитый SQL, лишний запрос к /api/products/seed, баннеры и ветки добавления в память. SQL устарел, в нём нет колонки logo_url. При любой временной ошибке БД API отдаёт 24 бренда-заглушки, и страница показывает «таблица не найдена».  
  → Удалить режим «в памяти», SQL-блок и пробу seed. При ошибке API показывать текст ошибки и отсылку к supabase-schema.sql. Список брендов по умолчанию оставить только в SQL-схеме.
- ⚪ **broken · fix** — `src/app/goo-studio/brands/page.tsx:76`  
  В handleAdd и handleDelete нет try/catch. При сетевой ошибке или ответе не в JSON кнопка навсегда остаётся в «…» до перезагрузки. Если нажать Enter дважды, уходят два POST, и второй показывает сырую ошибку Postgres о дубликате ключа. Ошибка загрузки списка показывается как «No brands yet.».  
  → Обернуть обе функции в try/finally с тостом ошибки, в начале handleAdd выходить при saving, а при ошибке загрузки показывать текст ошибки вместо «No brands yet».
- ⚪ **ux · fix** — `src/app/goo-studio/retailers/page.tsx:113`  
  Кнопки Edit и Add rule в таблицах внизу страницы заполняют форму вверху, но не прокручивают к ней. Админ жмёт кнопку, и на экране ничего не меняется.  
  → Повесить ref на блок редактора: при startEdit/startNew вызывать scrollIntoView и ставить фокус на поле Store name.
- ⚪ **ux · fix** — `src/app/goo-studio/retailers/page.tsx:131`  
  Если вручную ввести в «New rule» домен, у которого правило уже есть, старое правило молча перезапишется: название, официальность, пол и заметка.  
  → В режиме создания, если домен уже есть в report.rules, переключать форму в Edit этого правила или показывать предупреждение.
- ⚪ **ux · fix** — `src/app/goo-studio/retailers/page.tsx:342`  
  Если загрузка не удалась, обе таблицы показывают «пусто» («No rules yet…», «No product links found.») рядом с красной ошибкой. Выглядит так, будто правил действительно нет.  
  → Когда loadError непустой, писать в таблицах «Could not load» вместо пустого состояния.
- ⚪ **ux · fix** — `src/app/goo-studio/layout.tsx:263`  
  В словаре заголовков верхней панели нет /goo-studio/retailers (и /goo-studio/duplicates), поэтому на этих страницах хлебная крошка выглядит как «Admin / Admin».  
  → Брать заголовок из NAV_ITEMS по href, а не вести второй список вручную. Минимум — добавить две строки.
- ⚪ **design · fix** — `src/app/goo-studio/brands/page.tsx:150`  
  Brands расходится с рецептами админки: баннеры собраны на amber-500/5, amber-700 и amber-800 без скругления, копирующая кнопка bg-amber-600 text-white, кнопка Add контурная и без rounded-lg. text-amber-800 на тёмной поверхности админки почти не читается.  
  → Если принят пункт brands-in-memory-legacy-mode, баннеры уходят вместе с ним. Иначе привести баннер к рецепту §9, а Add — к primary-рецепту с rounded-lg.

### Админка: categories (17)

- 🟠 **broken · fix** — `src/app/goo-studio/categories/page.tsx:271`  
  Стрелки ↑/↓ шлют два PATCH-запроса и не проверяют ответ. Если сервер вернёт ошибку, админ ничего не увидит. Если упадёт сеть, busy навсегда остаётся true и все кнопки на странице блокируются до перезагрузки.  
  → Пустить перестановку через обёртку с try/finally и тостом ошибки. Ещё лучше сделать один серверный вызов «поменять местами», чтобы не было половинчатого состояния.
- 🟠 **ux · fix** — `src/app/goo-studio/categories/page.tsx:172`  
  После каждой правки (сохранить, добавить, удалить, ↑/↓) весь список заменяется надписью «Loading…» и рисуется заново. Страница схлопывается, и прокрутка прыгает вверх, поэтому двигать пункты внизу списка мучительно.  
  → Показывать «Loading…» только при первой загрузке, пока `tree === null`. Повторные загрузки делать тихо, не размонтируя список.
- 🟠 **not-wired · simplify** — `src/app/goo-studio/categories/page.tsx:473`  
  Выпадающий список типа размеров (Letter/Number/EU/One size) сохраняется в базу, но его никто не читает. Пункт «Use the category's chart» ничего не меняет: редактор товара смотрит только на список размеров.  
  → Либо убрать выпадающий список и оставить одно поле размеров (пустое значит «как у категории»), либо сделать так, чтобы «Use the category's chart» очищал и список размеров.
- 🟠 **broken · fix** — `src/app/api/categories/route.ts:118`  
  При переименовании или удалении подкатегории сервер сначала меняет само дерево, потом переписывает товары. Если переписать товары не вышло, ошибка глотается, а админ видит «Saved.»/«Deleted.». Товары остаются со старой меткой, которой в дереве уже нет.  
  → Отличать отсутствие колонки (код 42703) от прочих ошибок. На прочих возвращать предупреждение в ответе, а страница пусть показывает его тостом.
- 🟠 **security · fix** — `src/app/api/categories/route.ts:123`  
  `GET /api/categories?counts=1` нужен только админке, но открыт всем. Любой анонимный запрос запускает постраничный проход по всей таблице products.  
  → Понизить до low и перевести в hardening, а не security. При counts=1 требовать requireAdmin() (правка на xs). При этом помнить, что закрытие одного counts не уменьшает нагрузку от анонимов, пока /api/products?raw=true открыт без кэша. Если бороться с нагрузкой, то закрывать оба.
- 🟠 **broken · fix** — `src/app/goo-studio/categories/page.tsx:95`  
  В поле «＋ new value…» нельзя напечатать дефис, хотя подсказка обещает «letters, digits and dashes». При наборе «home-decor» получается «homedecor», и это значение навсегда уходит в products.category.  
  → Нормализовать значение при потере фокуса или при сохранении, а не на каждой клавише. Сервер всё равно нормализует и проверяет (route.ts:70-77).
- ⚪ **broken · fix** — `src/lib/server/category-tree.ts:59`  
  Любую ошибку базы (сбой, таймаут), а также пустую таблицу групп сервер помечает как «таблиц нет». Админ видит «Category tables not found, run migration 011», и страница уходит в режим только чтения. Если удалить последнюю группу или прогнать показанный SQL без seed, группу уже не добавить из интерфейса.  
  → Различать три случая: таблиц нет, таблицы пусты, ошибка чтения. Для пустых таблиц админке отдавать source "db" с пустым деревом (витрина всё равно откатится на дефолт в useCategoryTree.ts:25), для ошибки показать «не удалось загрузить».
- ⚪ **not-wired · fix** — `src/app/api/categories/route.ts:340`  
  При удалении непустой группы сервер отвечает «Move or delete them first», но переносить подкатегории в другую группу страница не умеет, хотя API это поддерживает. Переставлять группы местами UI тоже не умеет. Кнопка Delete при этом показывается и у непустых групп.  
  → Выключать Delete у группы, в которой есть подкатегории, и добавить в строку редактирования выбор «Group» (API готов). Либо убрать неиспользуемые ветки API.
- ⚪ **ux · fix** — `src/app/goo-studio/categories/page.tsx:174`  
  Если загрузка дерева не удалась, страница молча показывает «0 groups · 0 subcategories» без сообщения об ошибке и без кнопки «повторить». Все кнопки правки при этом скрыты.  
  → Проверять `res.ok` и при ошибке показывать строку «Couldn't load categories» с кнопкой Retry.
- ⚪ **broken · fix** — `src/app/goo-studio/categories/page.tsx:303`  
  Новая подкатегория получает номер «количество + 1». После удаления из середины этот номер совпадает с номером последнего пункта, и порядок двух строк становится случайным. База сортирует только по sort_order.  
  → Брать максимальный sort_order + 1 и добавить `.order("id")` вторым ключом сортировки.
- ⚪ **broken · fix** — `src/app/goo-studio/categories/page.tsx:523`  
  Кнопки блокируются на время запроса, а Enter в полях нет. Двойной Enter отправляет два POST: сначала тост «added», затем его перекрывает ошибка «already exists».  
  → В начале addSub/addGroup/saveSub/saveGroup делать `if (busy) return`.
- ⚪ **code-quality · fix** — `src/app/goo-studio/categories/page.tsx:68`  
  В исходнике стоит настоящий нулевой байт внутри строки NEW_BUCKET. Из-за него git и grep считают файл бинарным: диффы этой страницы в PR не видны, а поиск по коду её пропускает.  
  → Заменить литеральный байт на экранирование `"\0new-bucket"` или на обычную строку вроде `"__new__"`. То же сделать в label-audit/route.ts:64.
- ⚪ **stale-doc · simplify** — `src/app/goo-studio/categories/page.tsx:27`  
  Внутри страницы лежит ручная копия SQL миграции 011, уже устаревшая: нет колонок size_type/sizes из миграции 013 и нет seed. Если прогнать её, таблицы окажутся пустыми, и страница останется в режиме только чтения.  
  → Убрать встроенный SQL и кнопку Show SQL, оставить в баннере ссылку на файлы миграций 011 и 013.
- ⚪ **design · fix** — `src/app/goo-studio/categories/page.tsx:63`  
  Кнопки Save/Add/Add group сделаны прямоугольной обводкой без радиуса. Такой рецепт есть только на этой странице, а в соседних разделах админки основная кнопка залитая и с rounded-lg. У второстепенных кнопок tracking 0.1em, которого нет в шкале.  
  → Не чинить точечно в categories. Дописать в DS-11 рядом с записью settings/page.tsx:512 все места с контурной кнопкой без радиуса (categories:63, brands:207, audit:364, products:2580) и привести их к рецепту §9 п.4 одной дизайн-задачей по решению CEO. audit_task: DS-11.
- ⚪ **design · fix** — `src/app/goo-studio/categories/page.tsx:372`  
  Жёлтые баннеры собраны из сырых amber-600/700/800 и без скругления. В тёмной теме админки текст SQL цветом amber-800 почти не читается на фоне #141414.  
  → Перевести оба баннера на рецепт статуса из §9 и добавить rounded-xl. Заодно поправить копию в brands.
- ⚪ **dead-route · delete** — `src/app/api/color-groups/route.ts:11`  
  POST /api/color-groups (создать цветовую группу) никто не вызывает, и экрана для управления цветами в админке нет. Сам обработчик без проверки полей, без аудита, и на кривом JSON падает с 500.  
  → Удалить POST, оставить только GET. Если цветами нужно управлять из админки, это отдельная задача по решению CEO.
- ⚪ **code-quality · simplify** — `src/app/api/categories/route.ts:162`  
  После каждой правки сервер вызывает revalidatePath("/browse"), но это ничего не даёт. Страница /browse клиентская и берёт дерево из некэшируемого /api/categories.  
  → Убрать шесть вызовов revalidatePath и импорт.

### Админка: import+imagetools (13)

- 🔴 **broken · fix** — `src/app/api/admin/csv-import/route.ts:470`  
  Импорт CSV считает товар импортированным, даже если база отказала в записи. supabase-js не бросает исключение, он возвращает `{ error }`, а код этот error не проверяет. В итоге админ видит «Imported N», хотя записано могло быть 0.  
  → Разбирать `{ error }` у каждого запроса и класть ошибку в `errors`, а не увеличивать `imported`. Писать через writeProductRow, как это делает парсер.
- 🔴 **broken · fix** — `src/app/api/admin/csv-import/route.ts:475`  
  Повторный импорт того же фида целиком перезаписывает уже существующий товар. Затираются ручные правки названия, категории и описания, стилевые теги (становятся []), список магазинов и зеркальные фото, а товар снова помечается как новый. UI при этом не говорит, сколько товаров будет обновлено, а сколько создано.  
  → При обновлении писать только цену, наличие, размеры и магазин из фида, а поля, которые правит редактор, не трогать. В превью показывать «будет создано X, обновлено Y».
- 🔴 **broken · fix** — `src/app/api/admin/csv-import/route.ts:455`  
  Цены из CSV пишутся в валюте фида (по умолчанию GBP) без пересчёта в доллары, и price_min_usd не заполняется. При этом фильтр каталога, бюджет стилиста и поиск читают price_min как доллары, поэтому £100 для них превращается в $100.  
  → Пересчитывать цену через toUsd и писать source_price/source_currency/price_min_usd, как это делает парсер. Проще всего провести строки CSV через importParsedProduct.
- 🟠 **dup-feature · merge** — `src/app/api/admin/csv-import/route.ts:402`  
  У CSV-импорта свой отдельный конвейер записи товара, и в нём нет того, что делает общий importParsedProduct: фото не зеркалируются в наше хранилище (остаются ссылками на CDN Awin/Farfetch), не проставляются color_group_ids (товар не попадает в цветовой фильтр), не замеряется bg_color, нет поиска дублей из другого магазина. Parser, crawl и расширение идут через общий путь, CSV единственный идёт мимо.  
  → Оставить в CSV-роуте только разбор и группировку по цветам, а запись каждой группы делать через importParsedProduct. Это же закроет находки про валюту, перезапись и неловленные ошибки.
- 🟠 **perf · fix** — `src/app/goo-studio/brightdata/page.tsx:71`  
  Весь CSV (а .gz сначала распаковывается в браузере) уходит на сервер одним телом запроса, и сервер возвращает все строки обратно одним JSON. На Vercel лимит тела функции 4.5 МБ в обе стороны, так что обычный фид Awin на десятки МБ не загрузится, а админ увидит невнятную ошибку разбора JSON.  
  → Разбирать CSV прямо в браузере (сервер для этого шага не нужен, базы там нет), а на сервер слать импорт порциями.
- 🟠 **perf · fix** — `src/app/api/admin/csv-import/route.ts:402`  
  Импорт идёт одним запросом, товар за товаром, по 2 последовательных запроса в базу на каждый, и у роута нет maxDuration. Тысяча товаров уже упрётся в таймаут функции: часть запишется, часть нет, а админ ничего об этом не узнает.  
  → Слать импорт с клиента порциями (например, по 50 групп) с прогрессом, как это сделано в Parser, и выставить maxDuration.
- 🟠 **broken · fix** — `src/app/goo-studio/brightdata/page.tsx:107`  
  Если импорт падает по сети или по таймауту (ответ не JSON), ошибка никуда не выводится: спиннер просто пропадает, и админ не понимает, что случилось и сколько успело записаться.  
  → Добавить catch с выводом ошибки в parseError и явный текст «импорт мог пройти частично».
- 🟠 **broken · fix** — `src/app/api/admin/csv-import/route.ts:336`  
  Если в строке пустая колонка colour, разные цвета одного товара («Polo - Blue - M», «Polo - Navy - M») склеиваются в одну карточку: фото и название берутся от первого цвета, а в «Где купить» появляется второй магазин со ссылкой на другой цвет.  
  → Если колонка цвета пустая, брать цвет из отрезанного суффикса названия, а resolve научить пропускать пустые значения.
- 🟠 **orphan-page · delete** — `src/app/goo-studio/image-tools/page.tsx:92`  
  Страница Image Tools не в меню и никуда не подключена. Это тестовый стенд удаления фона через Replicate: результат ни к какому товару не применяется. Зато каждый запуск стоит денег (Replicate) и оставляет в бакете product-images 2 файла, на которые никто не ссылается.  
  → Удалить страницу и /api/admin/image-tools (и поправить 4 комментария, которые на них ссылаются). Если удаление фона понадобится, делать его кнопкой в карточке товара на Products.
- ⚪ **broken · fix** — `src/app/goo-studio/image-tools/page.tsx:255`  
  Если API ответит ошибкой без поля steps (например, 401 после истёкшей сессии), страница падает с TypeError вместо того, чтобы показать ошибку. Актуально только если страницу оставят.  
  → Если страницу оставляют, делать `steps: data.steps ?? []` и показывать data.error.
- ⚪ **code-quality · fix** — `src/app/goo-studio/layout.tsx:197`  
  Раздел называется /goo-studio/brightdata, но интеграции с BrightData в коде нет: ни API, ни ключей, ни вебхуков. Это обычный CSV-импорт (Awin плюс CSV-выгрузка Farfetch-скрейпера). Имя сбивает с толку, а серверный роут берёт тип из клиентского page.tsx.  
  → Переименовать маршрут в /goo-studio/import, а тип CSVMappedRow вынести в src/lib (например, lib/types или lib/server/csv-import).
- ⚪ **dead-route · delete** — `src/app/api/admin/csv-import/route.ts:488`  
  `revalidatePath("/admin/products")` сбрасывает кэш несуществующего пути: админка живёт на /goo-studio, а /admin прокси редиректит на главную.  
  → Удалить строку и оставить revalidatePath("/").
- ⚪ **design · fix** — `src/app/goo-studio/brightdata/page.tsx:573`  
  Внутри одной страницы кнопки разного вида: primary на :366/:419 со скруглением rounded-lg, а primary «View products» и outline-кнопки без радиуса. Таблица и статусы тоже не по рецепту админки. Красный и зелёный текст -400 плохо читается на светлой теме.  
  → Добавить rounded-lg кнопкам и rounded-xl блокам, шапку таблицы привести к рецепту §9 п.2, статусы делать по рецепту `bg-X-400/15 text-X-500 border border-X-400/30`.

### Админка: layout+dashboard (16)

- 🟠 **broken · fix** — `src/app/goo-studio/layout.tsx:389`  
  Кнопка «Light mode» в админке не делает её светлой, если на сайте тёмная тема, а она стоит по умолчанию. В светлом режиме админка не задаёт свои цвета и берёт тёмные с <html class="dark">, поэтому переключатель ничего не меняет.  
  → На корне админки задавать полный набор токенов для обеих тем (класс-скоуп light/dark), а не только тёмный объект darkVars. Это тот же фикс, что DS-11 предлагает для строки про darkVars.
- 🟠 **ux · ask-ceo** — `src/app/goo-studio/layout.tsx:391`  
  Мобильного меню нет. Сайдбар всегда занимает 224px (в свёрнутом виде 60px), у контента отступ 32px с каждой стороны. На телефоне шириной 375px под контент остаётся около 90px, и работать в админке нельзя.  
  → Ниже md прятать сайдбар за бургер (выезжающая панель), отступ контента на мобильном p-4, сохранять collapsed в localStorage. Если админка с телефона не нужна, решить это явно.
- 🟠 **broken · fix** — `src/app/api/admin/stats/route.ts:47`  
  Плашка «±X% vs last month» сравнивает неполный текущий месяц с полным прошлым. Поэтому в начале каждого месяца карточки Products/Outfits/Users краснеют (3-го числа около −90%), хотя падения нет.  
  → Сравнивать равные отрезки: с 1-го по сегодняшнее число прошлого месяца или последние 30 дней против предыдущих 30.
- 🟠 **broken · fix** — `src/app/api/admin/stats/route.ts:157`  
  System Health показывает OpenAI красным («OPENAI_API_KEY missing»), если ключ сохранён через Settings в базе, хотя OpenAI при этом работает. Платёжный Monobank и почтовый Resend в блоке не проверяются вообще.  
  → Для OpenAI вызывать getOpenAIKey(), добавить плитки Monobank и Resend (хотя бы «ключ есть»).
- ⚪ **orphan-page · delete** — `src/app/goo-studio/image-tools/page.tsx:92`  
  Страницы Image Tools нет в меню, и ссылок на неё нигде нет. По сути это тестовый стенд удаления фона через Replicate: каждый прогон стоит денег и кладёт файл в Storage, но результат ни к одному товару не привязывается.  
  → Если ручное удаление фона не нужно, удалить страницу и src/app/api/admin/image-tools/route.ts (общие хелперы в product-images.ts оставить). Если нужно, добавить пункт в Catalog.
- ⚪ **broken · simplify** — `src/app/goo-studio/layout.tsx:263`  
  На страницах Retailers, Duplicates, Image Tools и Parser → Collect в верхней строке написано «Admin / Admin»: их не добавили в словарь заголовков.  
  → Брать заголовок из NAV_ITEMS (label пункта с самым длинным совпавшим href), словарь pageTitles удалить.
- ⚪ **broken · ask-ceo** — `src/app/goo-studio/layout.tsx:444`  
  В окне Customize все пункты идут одним списком без групп, а сайдбар всегда рисует группы в жёстком порядке. Если перетащить пункт выше чужой группы, окно пишет «Changes save automatically», но в меню ничего не меняется. Работает только перестановка внутри одной группы, и только мышью.  
  → Либо показывать в модалке группы и разрешать перетаскивание только внутри группы, либо убрать кастомизацию (19 пунктов в 7 группах, пользы мало).
- ⚪ **code-quality · fix** — `src/app/goo-studio/layout.tsx:341`  
  Меню решает, показывать ли пункт Activity, по клиентской переменной NEXT_PUBLIC_SUPER_ADMIN_USER_ID, а сервер проверяет другую, SUPER_ADMIN_USER_ID. Если они разойдутся, настоящий супер-админ не увидит Activity или её увидит тот, кого API не пустит (403).  
  → В layout брать isSuperAdmin из /api/admin/me и убрать NEXT_PUBLIC_SUPER_ADMIN_USER_ID. Админские переменные вписать в .env.example.
- ⚪ **ux · fix** — `src/app/goo-studio/page.tsx:224`  
  Если статистика не загрузилась с первого раза, страница выглядит как вечная загрузка: подпись «Loading live data…», пульсирующие заглушки в System Health, пустые рамки вместо списков. Ошибку выдаёт только красная плашка сверху.  
  → Сделать отдельную ветку error && !data: плашка с ошибкой и кнопкой Retry, без заглушек.
- ⚪ **broken · fix** — `src/app/api/admin/stats/route.ts:103`  
  Когда Supabase или Clerk не отвечает, карточки показывают «0» и зелёную плашку «Flat vs last month»: сбой выглядит как настоящие нули. Ошибки запросов «за месяц», AI-образов и брендов не проверяются вовсе.  
  → Для метрики с упавшим запросом отдавать null и рисовать «—» без плашки роста.
- ⚪ **dup-feature · delete** — `src/app/goo-studio/page.tsx:356`  
  Блок Quick Actions повторяет сайдбар. «Add Product» и «Add Outfit» просто открывают списки, форма добавления не появляется. «Manage Users» и «Settings» — те же пункты, что в меню.  
  → Удалить блок. Если он нужен, сделать «Add» настоящими: параметр ?new=1 открывает форму.
- ⚪ **ux · simplify** — `src/app/goo-studio/page.tsx:121`  
  Зелёная плашка «Catalog coverage» на карточке Brands — вписанный в код текст, а не метрика. Она всегда зелёная и ничего не измеряет.  
  → Убрать плашку или заменить реальной цифрой (например, число брендов без товаров).
- ⚪ **perf · simplify** — `src/app/api/admin/stats/route.ts:124`  
  Отдельный запрос в Clerk за 6 последними пользователями повторяет следующий запрос на 200 пользователей в том же порядке. Регистрации «за месяц» считаются по этой выборке из 200: если за два месяца придёт больше 200 человек, рост будет занижен.  
  → recentSignups брать как signupSample.data.slice(0, 6) — минус один вызов Clerk. Убрать из ответа users.thisMonth, outfits.thisMonth, lastSignInAt, isAdmin. В описании риска написать, что при более чем 200 регистрациях за 2 месяца рост пользователей искажается, обычно в плюс.
- ⚪ **code-quality · simplify** — `src/app/goo-studio/layout.tsx:352`  
  orderedItems и customizableItems вычисляются одинаково, это две копии одного списка. Запись в localStorage при перетаскивании и сбросе не обёрнута в try/catch, хотя остальные обращения в этом файле обёрнуты.  
  → Оставить одну переменную, запись обернуть в try/catch.
- ⚪ **design · fix** — `src/app/goo-studio/layout.tsx:459`  
  В меню подписи групп набраны 8px, бейджи SA и Super Admin — 7px, плашки на дашборде — 9px, а минимум по дизайн-системе 10px. Карточки дашборда и Quick Actions дают тень при наведении, хотя глубина в системе передаётся только границей.  
  → Поднять только 8px и 7px (layout.tsx:459, :502, :629, :718) до text-[9px] или [10px]. 9px-чипы и hover:shadow не трогать.
- ⚪ **ux · fix** — `src/app/goo-studio/layout.tsx:634`  
  Пока профиль не загрузился, в шапке показывается выдуманный адрес admin@goo.com и имя «Admin».  
  → Пока user нет, показывать пустое место или заглушку, без фейкового адреса.

### Админка: outfits (15)

- 🔴 **not-wired · ask-ceo** — `src/app/goo-studio/outfits/page.tsx:1074`  
  Звёздочка «Feature on homepage» в колонке Homepage ничего не меняет на сайте. Флаг пишется в базу, но его никто не читает.  
  → Решение CEO: либо подключить карусель главной к отмеченным образам (если отмеченных нет — брать 9 новых), либо удалить колонку, PATCH-ветку, toggleOutfitHomepageFeatured и обе getFeaturedOutfits.
- 🔴 **security · fix** — `src/app/api/upload/route.ts:6`  
  Эндпоинт загрузки обложки образа (единственный вызывающий — эта страница) не проверяет, кто загружает. Любой аноним может залить файлы до 10 МБ в публичный бакет.  
  → Добавить в начало `if (!(await requireAdmin())) return 401` и оставить только растровые типы.
- 🟠 **broken · fix** — `src/app/goo-studio/outfits/page.tsx:1054`  
  На экранах уже lg заголовок «Price Range» скрыт, а ячейка с ценой остаётся. Все колонки справа съезжают: цена встаёт под «Homepage»/«Actions», у кнопок действий заголовка нет.  
  → Дать ячейке цены `hidden lg:table-cell` или убрать цену из скрываемых заголовков. Одна строка.
- 🟠 **ux · fix** — `src/app/goo-studio/outfits/page.tsx:1110`  
  Одиночное удаление образа срабатывает с одного клика, без подтверждения. Иконка — такой же крестик, как «закрыть». При сетевой ошибке строка всё равно пропадает, будто удалена. «Reject» в модерации тоже без подтверждения.  
  → Добавить confirm на удаление и на Reject, как у массового удаления. При сетевой ошибке показывать deleteError, а не убирать строку.
- 🟠 **broken · delete** — `src/app/goo-studio/outfits/page.tsx:344`  
  Если запрос сохранения упал по сети или вернул 501, окно закрывается и образ появляется в таблице как сохранённый, хотя в базе его нет. Это остаток прототипа без базы.  
  → Удалить saveLocally и ветки «501 = успех». При любой неудаче показывать saveError/deleteError и не закрывать окно.
- 🟠 **broken · fix** — `src/app/goo-studio/outfits/page.tsx:162`  
  При пустой таблице outfits или ошибке базы админка показывает 18 демо-образов (o-001…o-018) как настоящие. Их правка падает с ошибкой, а удаление «проходит», но после перезагрузки они возвращаются.  
  → Админке отдавать реальные данные или ошибку: убрать staticOutfits из страницы, а для админа читать outfits без подмены демо-данными. Оставлять ли фолбэк на публичном сайте — отдельный вопрос.
- 🟠 **ux · fix** — `src/app/goo-studio/outfits/page.tsx:198`  
  Если «Approve» или «Reject» не прошли, ничего не показывается: модалка просто остаётся открытой. Ошибка загрузки очереди выглядит как «No looks awaiting review». Звёздочка при ошибке тоже молчит.  
  → Завести строку ошибки в модалке модерации и выводить в ней res.json().error. Для вкладки Pending — отдельное состояние «ошибка загрузки».
- 🟠 **perf · fix** — `src/app/goo-studio/outfits/page.tsx:1193`  
  Редактор образа грузит весь каталог со всеми цветовыми вариантами и рисует каждую позицию картинкой. Весь этот грид перерисовывается на каждую букву, набранную в Name или Description.  
  → Severity low. Завернуть filteredProducts в useMemo и показывать первые ~60 совпадений с подсказкой «уточните поиск». Модалку в отдельный компонент не выносить.
- ⚪ **ux · fix** — `src/app/goo-studio/outfits/page.tsx:198`  
  Одобренный образ не появляется во вкладке Outfits, пока страницу не перезагрузить.  
  → После успешного approve перезапросить /api/outfits (или возвращать из роута гидрированный образ) и добавить revalidatePath("/").
- ⚪ **code-quality · fix** — `src/app/api/looks/approve/route.ts:84`  
  Approve не проверяет, что заявка ещё pending, и не проверяет, удалось ли сменить её статус. Если второй шаг упал, заявка остаётся в очереди, и повторное одобрение создаст дубль образа. Цена образа берётся из заявки, которую прислал клиент.  
  → Выбирать заявку только со status='pending', проверять ошибку update. Цену считать по товарам из pieces на сервере.
- ⚪ **ux · fix** — `src/app/goo-studio/outfits/page.tsx:633`  
  Счётчик заявок на вкладке «Pending» всегда пуст, пока не кликнешь на неё. Админ не видит, что пользователи прислали образы. Других мест в админке с этим счётчиком нет.  
  → Загружать очередь (или только её размер) один раз при открытии страницы.
- ⚪ **dead-route · delete** — `src/app/api/admin/hero-image/route.ts:1`  
  Роут загрузки hero-картинки никто не вызывает. Ключи settings, которые он пишет (hero_image_url, hero_image_url_light), нигде не читаются.  
  → Удалить файл целиком (126 строк).
- ⚪ **design · fix** — `src/app/goo-studio/outfits/page.tsx:867`  
  Плашка ошибки удаления сделана из светлой палитры (bg-red-50, border-red-300, text-red-600) без радиуса. В тёмной теме это яркий розовый прямоугольник, хотя плашка экспорта прямо под ней сделана по рецепту админки.  
  → Перевести плашку на тот же рецепт, что у exportNote на :880.
- ⚪ **design · fix** — `src/app/goo-studio/outfits/page.tsx:1409`  
  На одной странице два визуальных языка. Модалка модерации скруглённая, с чипами 11px. В редакторе образа чипы, плитки товаров, карточки выбранных вещей, select роли и зона загрузки прямоугольные, а подписи там 7–9px, ниже минимума шкалы. Кнопки Approve/Reject без радиуса.  
  → Привести редактор к рецептам: выбираемые чипы (:1173, :1409) — по 5.7 (rounded-full, 11px), кнопки, поля, select и плитки — rounded-lg/rounded-xl, один inputCls на странице. Размер поднимать только у надписей 7–8px. 9px у информационных подписей допустим по разделу 2.
- ⚪ **ux · fix** — `src/app/goo-studio/outfits/page.tsx:1246`  
  Подпись «Selected items (n/4)» обещает лимит в 4 вещи, но его нигде нет: можно выбрать сколько угодно, а коллаж на сайте рисует до 6.  
  → Либо убрать «/4», либо ввести реальный лимит (6, под коллаж).

### Админка: parser (13)

- 🟠 **broken · fix** — `src/app/goo-studio/parser/collect/page.tsx:216`  
  Если нажать Stop на странице приёма, флаг остановки остаётся включённым. Следующий запуск из расширения сразу обрывается с «Stopped by the admin». Сбросить флаг можно только кнопкой Clear (её нет, когда ничего не собрано) или перезагрузкой вкладки.  
  → Сбрасывать stoppedRef (и счётчики прошлого прогона) в обработчике hello: воркер шлёт его в начале каждого прогона. На plan сбрасывать нельзя — он приходит каждый круг.
- 🟠 **not-wired · fix** — `src/app/goo-studio/parser/page.tsx:371`  
  Страница Parser и все подсказки при отказе магазина ничего не знают про расширение. За каталогом они отправляют к платному провайдеру, за одной вещью — к букмарклету. Ссылки на /goo-studio/parser/collect в админке нет нигде.  
  → На вкладке Collect catalog и в текстах отказа (crawl.ts, parse-page.ts) дать ссылку «Собрать через расширение» на /goo-studio/parser/collect и коротко объяснить установку. Про платный провайдер писать вторым вариантом.
- 🟠 **dup-feature · ask-ceo** — `src/lib/parser-bookmarklet.ts:1`  
  Букмарклет с панелью «Paste page» — старый ручной путь для защищённых магазинов. Расширение делает то же автоматически и лучше: присылает фото из hydration, цену, размеры, цвета и описание. Сейчас в коде живут оба пути и две копии санитайзера.  
  → Спросить CEO, но честно описать разницу. Расширение заменяет букмарклет для одной вещи, только если адрес узнаётся как товарный и лимит поставлен 1; иначе оно тянет соседние товары со страницы. Ещё оно только для Chrome и ставится вручную. Если CEO скажет удалять, сначала научить расширение режиму «только эта страница» (например, при limit=1 не добавлять ссылки со страницы), и уже потом удалить букмарклет, PastePagePanel, handoff/isRefusal и тексты про «Goo: copy page».
- ⚪ **dup-feature · ask-ceo** — `src/app/goo-studio/parser/page.tsx:571`  
  Во вкладке Parse URL есть свой мини-сбор листинга: найти ссылки, распарсить 24, выбрать галочками, импортировать по одной. Это повторяет вкладку Collect catalog, только с потолком 24 и шагом выбора.  
  → Спросить CEO только про parseAllLinks и LinksPanel. Если ручной выбор не нужен, заменить LinksPanel кнопкой «Собрать в Collect catalog» с переносом адреса и удалить parseAllLinks. ProductGrid оставить: через него идут листинги с вшитыми товарами и вставленные страницы.
- ⚪ **dead-export · delete** — `src/lib/server/parser/configs.ts:156`  
  Отдельную настройку загрузки для конкретного сайта (recipe.fetch) парсер читает, но задать её негде: в Site Recipes такого поля нет, а API при сохранении его выбрасывает.  
  → Удалить поле fetch и effectiveFetchSettings, подставлять глобальные настройки. Если нужен «Render JS только для этого сайта» — добавить переключатель в рецепт и пропускать поле в sanitize.
- ⚪ **not-wired · fix** — `src/app/goo-studio/parser/page.tsx:1361`  
  Во вкладке Fetch & Anti-bot поле Impersonate показано для всех провайдеров, но у ScrapingBee, ScraperAPI и ZenRows ни на что не влияет. Render JS ни на что не влияет в режиме Direct. Подсказка при отказе провайдера при этом советует «сменить профиль имперсонации».  
  → Показывать Impersonate только для Direct и Custom, Render JS — только для провайдеров. Поправить текст подсказки в crawl.ts:199.
- ⚪ **broken · fix** — `src/app/goo-studio/parser/page.tsx:576`  
  «Parse first 24» молча выкидывает ссылки, которые не распарсились. Если не распарсилась ни одна, панель ссылок пропадает, и админ видит пустой экран без ошибки.  
  → Считать неудачи и писать «Parsed N of 24, M failed». Если не вышло ни одной — показать ошибку и оставить список ссылок.
- ⚪ **broken · fix** — `src/app/goo-studio/parser/page.tsx:606`  
  Enter в поле URL запускает новый парс, даже когда предыдущий ещё идёт (кнопка в это время заблокирована). Новый Parse во время «Parse first 24» потом затирается старым списком.  
  → Проверять parsing и linkParsing перед запуском по Enter. Блокировать Parse на время parseAllLinks или отменять цикл через ref.
- ⚪ **ux · fix** — `src/app/goo-studio/parser/page.tsx:158`  
  Правки во вкладках Site Recipes и Fetch & Anti-bot живут только в локальном состоянии. Переключил вкладку — всё несохранённое пропадает без предупреждения. Рецепт удаляется крестиком без подтверждения.  
  → Не терять черновики при переключении вкладок: держать вкладки смонтированными через hidden или поднять черновик в ParserPage. Рядом с Save показывать «unsaved changes». confirm на крестик не нужен: удаление и так применяется только после Save.
- ⚪ **broken · fix** — `src/app/goo-studio/parser/page.tsx:1319`  
  Если при «Clear stored key» пропала сеть, админ ничего не увидит: у try нет catch, и исключение уходит только в консоль.  
  → Добавить catch с setError("Network error").
- ⚪ **design · fix** — `src/app/goo-studio/parser/collect/page.tsx:241`  
  Страница приёма расширения — единственная в админке с контейнером публичного сайта. Внутри main с p-8 это даёт двойные поля. В шапке админки вместо названия стоит «Admin»: маршрута нет в pageTitles.  
  → Заменить обёртку на max-w-5xl space-y-5, как в parser/page.tsx. Добавить "/goo-studio/parser/collect" в pageTitles.
- ⚪ **design · simplify** — `src/app/goo-studio/parser/page.tsx:1194`  
  Переключатель написан трижды: компонент Toggle и две ручные копии без role="switch" и aria-checked. Сам рецепт (emerald-500 и белая точка bg-white) отличается от переключателя в users (--foreground и точка --background).  
  → Во всех трёх местах использовать Toggle и привести его к рецепту users: bg-[var(--foreground)], точка bg-[var(--background)].
- ⚪ **design · fix** — `src/app/goo-studio/parser/page.tsx:68`  
  Поля, кнопки и плашки парсера собраны не по рецептам админки. Инпут на --surface и 12px, primary-кнопка 11px с disabled 30%, плашка ошибки red-500/5 вместо статусного рецепта, радиус rounded вне шкалы, бейдж 8px.  
  → Заменить локальные inputCls, btnPrimary и плашки на рецепты из §9. Делать отдельной задачей по решению CEO, как и остальные пункты DS-11.

### Админка: products (23)

- 🔴 **broken · delete** — `src/app/goo-studio/products/page.tsx:1919`  
  Кнопка «Seed catalog» в главном тулбаре одним кликом, без подтверждения, заливает в живой каталог 24 демо-товара с фото Unsplash, выдуманными ценами и ссылками «#» вместо магазина.  
  → Убрать кнопку и POST-обработчик seed. GET /api/products/seed пока оставить: им пользуются brands/page.tsx:51 и products/page.tsx:789.
- 🟠 **broken · fix** — `src/app/goo-studio/products/page.tsx:1825`  
  Массовое удаление шлёт N отдельных DELETE, ответы не смотрит и всегда пишет «Deleted N». Строки исчезают из таблицы, даже если на сервере удаление не прошло.  
  → Проверять каждый ответ и убирать из таблицы только реально удалённые, в тосте писать «удалено X из N». Ещё лучше — один bulk-DELETE роут, который возвращает failures, как у bulk-edit.
- 🟠 **broken · fix** — `src/app/goo-studio/products/page.tsx:1034`  
  Сохранение товара, группировка, импорт, seed, кадрирование и добавление бренда не обёрнуты в try/finally. При сетевой ошибке или ответе не-JSON (например, 504 от Vercel) кнопка навсегда остаётся в «Saving…», и админ не видит ошибки.  
  → Сделать все обработчики по образцу applyBulkEdit: try/catch с тостом ошибки и сброс флага в finally.
- 🟠 **broken · fix** — `src/app/goo-studio/products/page.tsx:1107`  
  Если отредактировать любой цветовой вариант и нажать Save, он молча становится главным в группе, и в каталоге меняется показываемый товар. Крестик «Remove» у связанного варианта ничего не отвязывает.  
  → При обычном редактировании не пересобирать группу, если состав не менялся. Для удалённых из формы товаров явно обнулять variant_group_id. Управление группой оставить модалке «Group variants».
- 🟠 **broken · fix** — `src/app/goo-studio/products/page.tsx:1054`  
  Товар, сохранённый без фото, молча получает чужое стоковое фото куртки с Unsplash и уходит на витрину с ним. Фильтр «No image» такие товары уже не находит.  
  → Не подставлять заглушку: сохранять пустое фото (фильтр «No image» его поймает) или запрещать сохранение без фото.
- 🟠 **broken · fix** — `src/components/admin/ImageCropEditor.tsx:193`  
  В редакторе кадрирования фото показано целиком (object-contain в квадрате), а карточка на сайте рисует тот же кроп через object-cover. Поэтому на портретных фото рамка на холсте не совпадает с тем, что увидит покупатель.  
  → Сделать холст редактора в той же геометрии, что карточка (object-cover), или считать координаты относительно самого изображения, а не контейнера.
- 🟠 **broken · fix** — `src/app/goo-studio/products/page.tsx:287`  
  Подсказка обещает «Paste URL → auto-uploaded to storage», но при неудаче загрузки админ ничего не узнаёт: фото остаётся на чужом CDN. Сам роут повторяет уже существующий mirrorImageUrl, только хуже: без браузерных заголовков и Referer (Farfetch и похожие CDN отвечают отказом), без таймаута и лимита размера.  
  → Внутри роута вызывать mirrorImageUrl(). На странице показывать тост/метку, если фото осталось внешним.
- 🟠 **dup-feature · delete** — `src/app/goo-studio/products/page.tsx:3262`  
  Модалка Import (CSV/JSON) повторяет отдельную страницу «Import» (/goo-studio/brightdata, CSV Import), но сделана слабее. Товарам без бренда молча ставится бренд «Zara», без стилей — стиль «minimal», валюта и подкатегория не читаются, дубли не проверяются.  
  → Не удалять вслепую. Или чинить модалку: убрать дефолты Zara и minimal, обрезать \r, читать currency и subcategory, в /api/products/bulk добавить дедуп и revalidatePath. Или сначала спросить у CEO, нужен ли вообще импорт простого CSV/JSON без партнёрской ссылки. Удалять модалку и /api/products/bulk только если не нужен.
- 🟠 **perf · fix** — `src/app/goo-studio/products/page.tsx:2432`  
  Миниатюры 40×52 в таблице грузят полноразмерное фото каждого товара во всём каталоге, без lazy-loading. Открыть страницу значит скачать сотни мегабайт.  
  → Минимум — добавить loading="lazy" и decoding="async". Лучше — брать уменьшенную копию из Storage render и сделать постраничный вывод или виртуализацию таблицы.
- 🟠 **perf · fix** — `src/app/api/products/route.ts:24`  
  Публичный GET /api/products?ids=… (ряд «Recently viewed») ради ≤24 товаров каждый раз читает весь каталог постранично (select *). У каждого посетителя свой набор ids, поэтому CDN-кеш почти не помогает.  
  → Для ids делать один запрос `.in("id", ids)`, в конце прогонять dbToProduct. То же в productJobs у export-images.
- 🟠 **design · fix** — `src/app/goo-studio/products/page.tsx:2623`  
  У модалки Add/Edit жёсткая сетка «220px + остальное». На телефоне на все поля формы остаётся ~120px, пользоваться ею нельзя. При этом у админки есть мобильное меню.  
  → Низкий приоритет. Добавить `grid-cols-1 md:grid-cols-[220px_1fr]` можно, это дёшево и безвредно. Но нужна ли админка на телефоне вообще, решает CEO: без адаптации сайдбара и отступов layout эта правка мало что даст.
- 🟠 **design · fix** — `src/app/goo-studio/products/page.tsx:3382`  
  Уже известное расхождение: тост, баннеры, кнопка массового удаления и модалка миграции используют `dark:`-варианты. Они смотрят на глобальную тему, а не на тему админки. В DS-11 записаны старые номера строк, вот актуальные.  
  → Чинить по рецепту из DS-11 (`bg-X-400/15 text-X-500 border border-X-400/30`) отдельной задачей.
- ⚪ **dead-route · delete** — `src/app/goo-studio/products/page.tsx:527`  
  Модалка «Database migration required», ссылка «View variant migration SQL» над страницей и режим auto-migrate в API — остатки разовой миграции. Колонки уже в базовой схеме, RPC run_sql в репозитории нигде не определена, текст пишет «три колонки», а SQL добавляет четыре.  
  → Сначала перенести `alter table public.products add column if not exists crop_data jsonb default null` в supabase/migrations (новый файл 023_…) или в supabase-schema.sql. Потом удалить MigrationModal, ссылку «View variant migration SQL», GET и ветку action:"migrate" в group/route.ts. На needsMigration показывать обычный тост.
- ⚪ **broken · fix** — `src/app/goo-studio/products/page.tsx:2898`  
  Галочка «New arrival» у товара старше 7 дней ничего не делает: бейдж не появится, а после сохранения галочка снова пустая. 7 дней считаются от создания товара, а не от момента, когда поставили галочку.  
  → Либо хранить дату отметки (new_since) и считать 7 дней от неё, либо дизейблить галочку и писать «товар старше 7 дней».
- ⚪ **broken · fix** — `src/app/goo-studio/products/page.tsx:2851`  
  Если у товара есть магазины, поля цены становятся read-only с надписью «Auto-calculated from N retailers», но при открытии не пересчитываются. Показывается и заново сохраняется старая цена из базы, пока не тронешь поле магазина.  
  → Считать priceMin/Max из retailerUsd один раз при открытии формы (или прямо в handleSave), если есть цены магазинов.
- ⚪ **broken · fix** — `src/app/goo-studio/products/page.tsx:1616`  
  «Photo backdrops» считает «измерено», а не «записано». Если запись в базу не прошла, тост всё равно рапортует успех, а цикл до 40 раз заново качает те же фото.  
  → Суммировать applied, останавливать цикл при applied===0 и показывать writeFailures в тосте.
- ⚪ **design · fix** — `src/app/goo-studio/products/page.tsx:2444`  
  Плашка «Primary/Variant» в таблице красит текст и рамку цветом свотча товара. У белого или бежевого варианта текст на светлом фоне не читается, у чёрного — на тёмном.  
  → Текст и рамку сделать токенами (`text-[var(--foreground-muted)] border-[var(--border)]`), цвет оставить только точке.
- ⚪ **design · fix** — `src/app/goo-studio/products/page.tsx:2971`  
  На одной странице чипы собраны по-разному: в фильтре над таблицей они rounded-full, а в форме и в bulk-модалке (категории, размеры, стили, цветовые фильтры, add/replace) квадратные, без радиуса. Кроме того, 13 надписей 9px и одна 8px, два `rounded-md`.  
  → Привести чипы формы и bulk-модалки к rounded-full, 8px поднять до 10px, rounded-md заменить на rounded-lg, кнопке на 2580 дать rounded-lg. Трогать ли 9px, пусть решит CEO: DESIGN_SYSTEM сам разрешает 9px для микро-подписей и чипов.
- ⚪ **ux · fix** — `src/lib/data/db.ts:279`  
  Если база ответила ошибкой, API отдаёт пустой список с кодом 200, и страница показывает «0 total · No products found». Сбой выглядит как пустой каталог.  
  → На ошибке отдавать 500 с текстом, а на странице показывать отдельное состояние ошибки с кнопкой «повторить».
- ⚪ **ux · fix** — `src/app/goo-studio/products/page.tsx:780`  
  Каждый тост ставит свой таймер на 3.5 с и не отменяет предыдущий. Старый таймер гасит новый тост раньше времени — например, итог длинного прогона backdrops или текст ошибки миграции.  
  → Хранить id таймера в ref и сбрасывать при новом тосте. Ошибки держать дольше или до закрытия.
- ⚪ **code-quality · simplify** — `src/app/goo-studio/products/page.tsx:1142`  
  Вся страница поддерживает режим «без базы»: сохранение, импорт, удаление и кроп только в памяти, плюс жёлтый баннер. В проде этот режим не работает, а только удваивает ветки, и ради него при каждом обновлении списка делается лишний запрос /api/products/seed.  
  → Убрать режим в памяти: без базы показывать одно сообщение об ошибке и дизейблить действия. Проверку конфигурации делать один раз, а не на каждый refetch.
- ⚪ **dead-export · delete** — `src/app/goo-studio/products/page.tsx:220`  
  Мелкий мусор: неиспользуемая константа sectionCls, поле sizeType в SIZE_PRESETS, которое никто не читает, осиротевший комментарий про recategorize над блоком bulk edit и лишний eslint-disable. У useMemo фильтрации не хватает зависимостей categoryGroups/subcatToValue.  
  → Удалить sectionCls, sizeType, лишнюю директиву и перенести комментарий. Добавить недостающие зависимости в useMemo.
- ⚪ **code-quality · simplify** — `src/app/goo-studio/products/page.tsx:661`  
  Файл на 3391 строку, всё состояние в одном компоненте. Каждое нажатие клавиши в форме товара перерисовывает всю таблицу каталога, а SecHead/Chevron/SortIcon объявлены внутри рендера и пересоздаются каждый раз. Резать есть смысл.  
  → Удалить Seed (POST) и MigrationModal (после переноса DDL crop_data в миграцию). Вынести ProductFormModal со своим состоянием формы, BulkEditModal и GroupVariantsModal в src/components/admin/, а SecHead/Chevron/SortIcon поднять на уровень модуля. Что делать с модалкой Import, решить отдельно по #7.

### Админка: settings+prompts (17)

- 🔴 **not-wired · ask-ceo** — `src/app/api/admin/prompts/route.ts:41`  
  Вкладка «AI Stylist» на странице Prompts ничего не делает. Промт prompt_stylist сохраняется в базу, но стилист его не читает: у него свой зашитый в код промт.  
  → Нужно решение: либо удалить вкладку stylist, ключ prompt_stylist и DEFAULT_STYLIST_PROMPT, либо подключить getPrompt('prompt_stylist') в buildSystemPrompt с подстановкой переменных. Подпись страницы в любом случае поправить.
- 🟠 **broken · fix** — `src/app/goo-studio/settings/page.tsx:269`  
  Если витрины главной не загрузились, страница молча показывает пустые слоты. Кнопка Save при этом активна, и одно нажатие стирает на главной всё, что было выбрано.  
  → Первое: GET homepage-showcase и homepage-stylist должны отдавать 500, если чтение settings упало (getHomepageShowcaseIds/getHomepageStylistIds сейчас глотают error). Второе: на странице хранить флаг «загружено», при ошибке показывать её и блокировать Save. Третье: Re-check показывать и в состоянии ошибки.
- 🟠 **broken · fix** — `src/app/goo-studio/settings/page.tsx:880`  
  Карточка ключа OpenAI пишет, что ключ нужен AI-стилисту и что удаление ключа его отключит. Это неправда: стилист работает через Replicate, а без ключа отключатся блог, AI-письма, AI в парсере и семантический поиск.  
  → Переписать подпись и текст подтверждения: перечислить, что реально перестанет работать (генерация постов, AI-письма, AI в парсере, семантический поиск стилиста).
- 🟠 **broken · fix** — `src/app/api/admin/schema-check/route.ts:44`  
  Проверка схемы в Settings смотрит только 1 из 17 необязательных колонок товаров. Если не прогнаны миграции 010/019/020/021, она всё равно покажет «All columns present», а импорт будет молча терять эти поля.  
  → Строить список проверок по OPTIONAL_COLUMNS (или добавить строки для 010, 019×2, 020, 021). В импорте логировать или возвращать `dropped`.
- 🟠 **perf · fix** — `src/lib/data/db.ts:275`  
  Загрузка всего каталога делает select('*') и вместе с товарами тянет из базы вектор эмбеддинга на 1536 чисел, который потом выбрасывается. Settings вызывает это на каждом открытии, главная — при каждой перегенерации ISR.  
  → Заменить select('*') на явный список колонок без embedding (или хотя бы исключить её).
- ⚪ **perf · fix** — `src/app/goo-studio/settings/page.tsx:126`  
  Settings сразу при открытии скачивает весь каталог и все образы, хотя это нужно только для превью и пикера. В пикере потом одновременно грузятся сотни картинок с сайтов магазинов.  
  → Добавить loading="lazy" (и decoding="async") картинкам в обоих пикерах. Загрузку каталога при открытии оставить. Серверную часть закрывает находка #4 (убрать embedding из select).
- ⚪ **broken · fix** — `src/app/api/admin/stats/route.ts:158`  
  Дашборд проверяет ключ OpenAI только в переменной окружения. Если ключ сохранён через Settings, дашборд всё равно показывает красное «OPENAI_API_KEY missing», хотя всё работает.  
  → В stats использовать `await getOpenAIKey()` и в detail писать источник (env/database).
- ⚪ **ux · simplify** — `src/app/goo-studio/settings/page.tsx:962`  
  Когда ключа нет, на экране одновременно видны кнопка «Add API Key» и само поле ввода, а кнопки Save нет. Внизу пустая полоса футера. Чтобы сохранить ключ, надо сначала нажать «Add API Key», который ничего не добавляет.  
  → Убрать промежуточный шаг: при configured=false сразу показывать поле с кнопкой Save, а «Add API Key» и пустой футер удалить.
- ⚪ **dead-route · delete** — `src/app/api/admin/hero-image/route.ts:1`  
  API для картинки героя главной никто не вызывает, и сохранённое им значение никто не читает. Это мёртвый роут из семейства настроек, который умеет заливать файлы в хранилище.  
  → Удалить src/app/api/admin/hero-image/route.ts. После удаления можно почистить строки hero_image_url* в таблице settings.
- ⚪ **broken · fix** — `src/app/api/admin/prompts/route.ts:103`  
  Промт можно сохранить без обязательных плейсхолдеров ({{items}}, {{content}}, {{brief}}) или вообще пустым. Тогда генерация картинок или постов молча пойдёт без товаров или текста, а пустой промт в админке помечен «кастом», хотя на деле работает дефолт.  
  → Хранить в PROMPT_META список обязательных плейсхолдеров и возвращать 400, если их нет. Пустое значение трактовать как сброс (DELETE).
- ⚪ **code-quality · fix** — `src/app/api/admin/prompts/route.ts:107`  
  Изменения и сбросы промтов не пишутся в журнал действий админов, хотя они влияют на все генерации. Смена ключа и витрин в журнал пишется.  
  → Добавить действия settings.prompt_updated и settings.prompt_reset и вызывать logAdminAction с ключом промта.
- ⚪ **stale-doc · simplify** — `src/app/goo-studio/settings/page.tsx:1097`  
  Внизу Settings всегда висит блок с SQL для создания таблицы settings. Миграции для этой таблицы в репозитории нет, и проверка схемы её не проверяет.  
  → Перенести SQL в миграцию (например 023_settings.sql), добавить settings.value в CHECKS, а статичный блок со страницы удалить.
- ⚪ **code-quality · simplify** — `src/app/goo-studio/settings/page.tsx:1115`  
  На странице две почти одинаковые модалки выбора по ~100 строк и три копии разметки чипа с крестиком. Из-за этого файл вырос до 1299 строк.  
  → Вынести один компонент PickerModal(items, selectedIds, onPick, max) и компонент чипа, а секции страницы разнести по отдельным компонентам.
- ⚪ **design · fix** — `src/app/goo-studio/prompts/page.tsx:175`  
  Страница Prompts нарушает рецепты админки: заголовок не по рецепту H1, кнопки и textarea без скругления, бейджи 8px и rounded-md, green вместо emerald. Весь интерфейс на русском, а остальная админка на английском.  
  → Привести к рецептам раздела 9: H1 font-display text-2xl font-light, rounded-lg у кнопок :99/:107 и textarea :89, rounded-full вместо rounded-md на :69, emerald вместо green на :92. Бейдж :199 не трогать. Перевод интерфейса на английский вынести отдельным вопросом к CEO, это не нарушение DS.
- ⚪ **design · fix** — `src/app/goo-studio/settings/page.tsx:864`  
  Карточка ключа OpenAI и блок SQL внизу прямоугольные, хотя три соседние карточки на той же странице скруглены. Панели обеих модалок rounded-xl, а в остальной админке модалки rounded-2xl.  
  → Добавить rounded-xl карточкам на :864 и :1098, панели модалок перевести на rounded-2xl.
- ⚪ **design · fix** — `src/app/goo-studio/settings/page.tsx:477`  
  Расхождения Settings из DS-11 всё ещё в коде, только номера строк сдвинулись: H1 не по рецепту, primary-кнопки без скругления, green вместо emerald, самописные поля ввода.  
  → Не дублировать работу: чинить отдельной задачей по DS-11 и заодно обновить там номера строк.
- ⚪ **dead-export · simplify** — `src/app/api/admin/prompts/route.ts:16`  
  PROMPT_META экспортируется из файла роута, но за его пределами нигде не используется.  
  → Убрать export или перенести PROMPT_META в src/lib/server/prompt-defaults.ts рядом с дефолтами.

### Админка: subscriptions+users (17)

- 🔴 **broken · fix** — `src/app/api/admin/users/[id]/route.ts:261`  
  Удаление пользователя в админке (кнопка в строке, в карточке и массовое) стирает только аккаунт в Clerk. Подписка в Supabase остаётся active, с включённым автопродлением и сохранённой картой, поэтому cron в следующем месяце снова спишет деньги с карты удалённого человека.  
  → В DELETE перед deleteUser выключать автопродление (в lib уже есть cancelAutoRenew) или отказывать в удалении при активной подписке. В confirm показывать, что у пользователя активная подписка.
- 🟠 **broken · fix** — `src/app/goo-studio/users/page.tsx:922`  
  Смена плана в карточке и массовая «Plan → Apply» меняют только plan в Clerk и никак не касаются подписки. Если платящего пользователя перевести на free, списания продолжатся, а при следующем продлении платный план вернётся сам. Предупреждения в UI нет, отменить подписку из админки нельзя.  
  → Если у пользователя есть активная подписка, показывать у кнопок плана и в confirm массовой смены предупреждение: «план в Clerk изменится, списания — нет». Нужна ли админу кнопка отмены подписки — решает CEO.
- 🟠 **broken · fix** — `src/app/api/admin/subscriptions/route.ts:58`  
  «Total earned» и «N payments total» считаются по последним 200 событиям billing_events всех типов, а не по всем платежам. Каждый день туда пишется cron_run, плюс card_token_missing и checkout_started, поэтому старые платежи выпадают из окна и сумма «за всё время» занижается. Тот же поток служебных событий забивает журнал транзакций.  
  → Сумму и количество payment_success считать отдельным запросом без лимита (так же, как уже сделан lastCronRun), а из журнала исключить cron_run.
- 🟠 **broken · fix** — `src/app/api/admin/subscriptions/route.ts:130`  
  Карточка здоровья «Failed charges» суммирует failed_charges по всем подпискам, включая отменённые. После первого же даунгрейда за неуплату она становится красной навсегда, и сигнал «биллинг болен» перестаёт что-либо значить.  
  → Считать только по подпискам со статусом active/past_due (отменённые не учитывать) и поправить подпись.
- 🟠 **broken · fix** — `src/app/goo-studio/users/page.tsx:143`  
  Страница грузит только 200 самых новых пользователей и никогда не передаёт offset. Старшие пользователи видны только через поиск. Фильтр по плану и карточки Premium/Pro/Basic/Free/Banned считаются по этим 200, а «Total» — по всем, поэтому цифры не сходятся.  
  → Сделать серверную пагинацию через offset, а счётчики по планам считать на сервере или хотя бы подписать «из последних 200».
- 🟠 **broken · fix** — `src/app/goo-studio/users/page.tsx:224`  
  Массовые Ban/Unban/Plan/Delete не проверяют ответы: если часть запросов вернула 403 или 500, админ об этом не узнает. Если fetch упадёт по сети, bulkLoading навсегда останется true и кнопки заблокируются до перезагрузки.  
  → Собрать ответы, показать «успешно N из M» со списком ошибок, а сброс bulkLoading обернуть в finally.
- 🟠 **design · fix** — `src/app/goo-studio/users/page.tsx:416`  
  Таблица пользователей (9 колонок) обёрнута в overflow-hidden без overflow-x-auto. На узком экране правые колонки, включая кнопки Edit и Delete, обрезаются, и прокрутить к ним нельзя.  
  → Внутри обёртки добавить `<div className="overflow-x-auto">`, как в subscriptions/page.tsx:257. Серьёзность low, это адаптив, а не нарушение DS.
- ⚪ **ux · simplify** — `src/app/goo-studio/users/page.tsx:897`  
  Кнопка «Reset all-time» без подтверждения удаляет всю историю сообщений стилиста у пользователя. Эти же строки использует график AI-usage в Analytics, так что один клик незаметно меняет аналитику.  
  → Добавить confirm. Лучше совсем убрать «all-time»: для снятия лимита достаточно «today».
- ⚪ **broken · fix** — `src/app/api/admin/users/[id]/route.ts:75`  
  В списке пользователь из ADMIN_USER_IDS помечен «Admin», а в карточке переключатель Admin у него выключен. Если супер-админ «снимет» с него права, это ни на что не повлияет, и никто не скажет об этом.  
  → В GET карточки учитывать ADMIN_USER_IDS так же, как в списке, и для таких пользователей показывать «admin via env», а не переключатель.
- ⚪ **code-quality · simplify** — `src/app/goo-studio/users/page.tsx:6`  
  Защита супер-админа в таблице (скрыть чекбокс и корзину) держится на NEXT_PUBLIC_SUPER_ADMIN_USER_ID, а сервер проверяет SUPER_ADMIN_USER_ID. API списка isSuperAdmin не отдаёт. Если переменные разойдутся, в строке супер-админа появятся кнопки, которые сервер всё равно отклонит.  
  → Отдавать isSuperAdmin из API списка, как это уже делает карточка, и убрать NEXT_PUBLIC-фолбэк со страницы.
- ⚪ **security · delete** — `src/app/api/admin/users/[id]/route.ts:73`  
  API карточки отдаёт в браузер privateMetadata, publicMetadata и emailAddresses, хотя страница их не использует. privateMetadata по смыслу серверные данные Clerk, и в клиент им попадать незачем.  
  → Классифицировать как мёртвые поля (dead payload), а не security. Убрать privateMetadata, publicMetadata и emailAddresses из ответа GET и из интерфейса UserDetail.
- ⚪ **ux · fix** — `src/app/goo-studio/users/page.tsx:647`  
  Если /stats отвечает ошибкой, блок Activity в карточке навсегда показывает мигающий скелетон, без сообщения об ошибке.  
  → Когда статистика не пришла, показывать текст «stats unavailable» вместо скелетона.
- ⚪ **design · fix** — `src/app/goo-studio/users/page.tsx:740`  
  У drawer пользователя нет role="dialog"/aria-modal, он не закрывается по Escape и не блокирует прокрутку фона. Скрим bg-black/40 вместо принятого в админке bg-black/60.  
  → Добавить role="dialog" aria-modal="true" и закрытие по Escape. Скрим менять только в рамках задачи по DS-11 (layout.tsx:638), по решению CEO. Scroll lock не нужен.
- ⚪ **design · fix** — `src/app/goo-studio/users/page.tsx:478`  
  Бейджи плана и статуса, плашка «Protected», баннеры ошибки и супер-админа, а также заглушка аватара в таблице нарисованы без радиуса. Рядом при этом стоят скруглённые карточки и круглые аватары. На странице subscriptions бейдж rounded-md, которого нет в шкале радиусов.  
  → audit_task: DS-11 (users/page.tsx:478, analytics/page.tsx:159). Чинить в рамках задачи по DS-11. Отдельно, как новое наблюдение: заглушке аватара :462 добавить rounded-full.
- ⚪ **not-wired · simplify** — `src/lib/plans.ts:95`  
  Настройка BILLING_USD_UAH_RATE ни на что не влияет. Курс читается только на клиентской странице subscriptions, а переменная без префикса NEXT_PUBLIC_ в браузер не попадает, поэтому там всегда 41.  
  → Либо убрать env-переменную и оставить константу, либо передавать курс в ответе /api/admin/subscriptions.
- ⚪ **dead-export · simplify** — `src/app/api/admin/subscriptions/route.ts:142`  
  API считает и отдаёт поля, которые страница не показывает: MRR по каждому плану, startedAt подписки, а из базы дополнительно выбирает invoice_id и ccy.  
  → Либо показать MRR по плану в карточке «By plan», либо убрать эти поля из запроса и ответа.
- ⚪ **dup-feature · merge** — `src/app/api/admin/analytics/route.ts:350`  
  Блок «Revenue & Subscriptions» в Analytics заново считает MRR, active, past due, canceled и renew off отдельным кодом — это то же, что сводка страницы Subscriptions. Две независимые реализации одних и тех же денежных цифр со временем разойдутся.  
  → Вынести расчёт в общий хелпер, а в Analytics оставить короткую сводку со ссылкой на /goo-studio/subscriptions.

### Админка: waitlist+email (19)

- 🔴 **broken · fix** — `src/app/api/admin/email/route.ts:178`  
  Рассылка считает письма отправленными, даже когда Resend их отклонил. Админ видит зелёное «Sent to N of N», хотя на самом деле ничего не ушло.  
  → Проверять `res.error` после каждого батча и засчитывать такой батч как неотправленный, с текстом ошибки. Адреса Custom перед отправкой проверять регуляркой и убирать дубли, либо передавать `batchValidation: 'permissive'`.
- 🟠 **broken · fix** — `src/app/goo-studio/email/page.tsx:120`  
  Если API отказал (нет получателей, не настроен Resend, упал Clerk), админ видит «Sent  of  —  batch failed.» с пустыми местами вместо причины. При сетевой ошибке не показывается вообще ничего.  
  → Если `!res.ok`, показывать `data.error` в блоке результата. Добавить catch с сообщением «Network error».
- 🟠 **broken · fix** — `src/app/api/admin/email/route.ts:104`  
  Рассылка и счётчики аудитории молча упираются в 500 человек: берутся только 500 самых новых пользователей Clerk, а список Custom обрезается до 500. Об этом нигде не пишется.  
  → Пройти getUserList постранично по offset до totalCount (в GET для счётчиков и в POST для отправки). Если в Custom больше 500 адресов, отправлять всех или показывать явное предупреждение.
- 🟠 **orphan-page · ask-ceo** — `src/proxy.ts:7`  
  Waitlist наполняется только со страницы /coming-soon, а она выключена: стоит жёсткий `COMING_SOON = false`, и ссылок на неё нигде нет. Новые адреса туда больше не приходят, страница админки показывает замороженный архив.  
  → Решение за CEO. Формулировка: «страница /coming-soon осиротела (ссылок нет, в sitemap нет, гейт выключен), но открывается по прямому URL». Варианты А/Б без изменений. При удалении убрать и сам роут /coming-soon (страницу вместе с FeatureCarousel), иначе форма на ней будет слать POST в удалённый /api/waitlist.
- 🟠 **broken · fix** — `src/app/goo-studio/waitlist/page.tsx:28`  
  Крестик удаляет адрес с первого клика, без подтверждения. Строка пропадает из списка, даже если сервер ничего не удалил, а при сетевой ошибке спиннер крутится вечно.  
  → Спрашивать confirm перед удалением, убирать строку только если ответ пришёл с `res.ok && data.ok`, обернуть в try/finally. В роуте проверять `error` от Supabase и отдавать 500.
- 🟠 **design · fix** — `src/app/goo-studio/email/page.tsx:211`  
  Статусы на странице Email (предупреждение «Resend not configured», успех отправки, ошибка) написаны цветами -400 на почти прозрачном фоне. В светлой теме админки их почти не видно.  
  → Заменить на рецепт админки: `bg-amber-400/15 text-amber-500 border border-amber-400/30`, так же для emerald и red.
- ⚪ **broken · fix** — `src/app/goo-studio/email/page.tsx:137`  
  AI Write, сохранение и удаление шаблонов при ошибке молчат. Кроме того, шаблон может выглядеть сохранённым, но пропасть после перезагрузки.  
  → Обернуть вызов OpenAI в try/catch с `{error}`, на странице выводить ошибку для AI Write, сохранения и удаления шаблона. В templates/route.ts проверять error от Supabase и возвращать 500.
- ⚪ **broken · fix** — `src/app/goo-studio/email/page.tsx:67`  
  Любой ответ GET /api/admin/email кладётся в state без проверки. На ответ `{error}` страница показывает ложное «Resend not configured» и падает с TypeError. Если упал Clerk, счётчики молча становятся 0 и кнопка Send блокируется без объяснения.  
  → В GET при сбое Clerk возвращать `countsError`, на странице показывать «не удалось получить аудиторию» вместо нулей. Писать `status?.counts?.[x]` и класть в state только ответ с res.ok: это дешёвая страховка, не баг с высоким приоритетом.
- ⚪ **code-quality · merge** — `src/app/api/admin/email/preview/route.ts:4`  
  Рендер письма (esc, inlineFormat, textToHtml, buildHtml, около 60 строк) скопирован в два роута, копии придётся править синхронно. Превью к тому же не обновляется, пока оно открыто и текст редактируется.  
  → Вынести рендер в чистый модуль (например src/lib/email-render.ts), импортировать его в email/route.ts и прямо на странице (useMemo от subject/body), а роут /api/admin/email/preview удалить. Этот модуль потом пригодится и для Б9-1.
- ⚪ **broken · ask-ceo** — `src/app/api/admin/email/route.ts:83`  
  В письме нет ссылки отписки. Подпись «you received this because you have an account» неверна для получателей Custom, например для людей из waitlist, у которых аккаунта нет.  
  → Для Custom менять текст подписи. Ссылку отписки решать вместе с записью BRIEF-7.
- ⚪ **not-wired · fix** — `src/lib/server/audit.ts:3`  
  Массовая рассылка и удаление из waitlist не пишутся в журнал Activity. Нельзя узнать, кто, когда и кому отправил письмо, и не ушло ли оно уже.  
  → Добавить действие `email.sent` (audience, subject, sent, total, testOnly) и вызывать logAdminAction после отправки, кроме testOnly.
- ⚪ **design · fix** — `src/app/goo-studio/email/page.tsx:31`  
  На одной странице три разных радиуса. Поля, карточки аудитории, кнопки Send и баннеры квадратные, кнопки в модалках rounded-lg, а две модалки отличаются между собой (rounded-xl и rounded-2xl). H1 на странице нет вообще.  
  → Привести к рецептам §9: поля и кнопки rounded-lg, модалки rounded-2xl, карточки аудитории rounded-xl. Добавить H1 `font-display text-2xl font-light` «Email».
- ⚪ **design · fix** — `src/app/goo-studio/waitlist/page.tsx:53`  
  H1 и таблица на Waitlist собраны не по рецепту админки. Заголовок жирный без font-display, у таблицы нет радиуса, шапка 9px в цвете subtle.  
  → Если страница остаётся: взять рецепт H1 и таблицы из §9 (как products/page.tsx:1692). Если waitlist удаляют, эта находка отпадает.
- ⚪ **ux · simplify** — `src/app/goo-studio/email/page.tsx:305`  
  Подсказка по формату дана дважды: строкой над полем и таблицей из 7 строк под ним, которая видна всегда. Таблица на русском, остальной UI админки на английском, и там упоминается «GPT».  
  → Оставить одну короткую подсказку на английском, а подробную таблицу убрать под переключатель «?».
- ⚪ **ux · fix** — `src/app/goo-studio/email/page.tsx:139`  
  AI Write и «Load template» молча затирают уже написанный текст письма, отменить это нельзя.  
  → Спрашивать confirm в handleLoadTemplate, если subject или body не пустые. Для AI Write confirm необязателен, это его заявленное действие.
- ⚪ **broken · fix** — `src/app/goo-studio/email/page.tsx:587`  
  Если держать Enter в поле имени шаблона, уходит несколько POST подряд. Шаблоны хранятся одним JSON в settings по схеме «прочитал-изменил-записал», поэтому такие запросы перетирают друг друга, и в UI остаются шаблоны, которых нет на сервере.  
  → В начале handleSaveTemplate добавить `if (savingTemplate) return`. Если нужна надёжность, хранить шаблоны отдельными строками вместо одного JSON.
- ⚪ **broken · fix** — `src/app/goo-studio/waitlist/page.tsx:21`  
  Если загрузка списка упала (401 или 500), страница показывает «No entries yet», как будто список пустой.  
  → Хранить ошибку в state и показывать её вместо пустого состояния.
- ⚪ **broken · fix** — `src/app/api/waitlist/route.ts:11`  
  Публичный POST /api/waitlist всегда отвечает ok. Ответ одинаковый, даже если база не настроена или запись не прошла, и человек видит «You're on the list ✓». Повторная подписка сдвигает дату регистрации.  
  → Если waitlist оставляют: проверять error от Supabase и отдавать 500, при конфликте не трогать created_at (ignoreDuplicates). Если удаляют, удалить роут целиком (см. waitlist-feature-dead-since-launch).
- ⚪ **dead-export · delete** — `src/app/goo-studio/email/page.tsx:23`  
  Поле desc у пяти из шести вариантов аудитории никогда не показывается: для них всегда выводится число получателей.  
  → Убрать desc у пяти вариантов и оставить только у custom.

### Пропущенное (критик) (15)

- 🔴 **perf · fix** — `src/app/product/[id]/page.tsx:54`  
  Каждый заход на карточку товара тянет из базы весь каталог (select * вместе с эмбеддингами), все образы и все их товары. Всё это ради 4 похожих вещей и списка образов с этой вещью, и страница при этом не кэшируется.  
  → Похожие товары брать запросом по категории с limit 4 и узким select, образы с товаром — запросом по items. getProductById и getOutfitById обернуть в cache(), странице задать revalidate.
- 🟠 **broken · ask-ceo** — `src/app/blog/page.tsx:64`  
  На /blog блок «Newsletter · Subscribe» — просто поле и кнопка: формы, обработчика и API нет. Человек вводит почту, жмёт Subscribe, и ничего не происходит.  
  → Либо подключить форму к /api/waitlist (оживёт раздел Waitlist и аудитория для рассылок), либо убрать блок. Выбор за CEO.
- 🟠 **broken · fix** — `src/app/api/products/[id]/route.ts:78`  
  Удаление товара в админке (одиночное и массовое) стирает только строку. Образы, лайки и луки, которые на товар ссылаются, остаются как были: образ на сайте молча теряет вещь, а его цена не меняется.  
  → Перед удалением показывать «товар в N образах» и либо запрещать удаление, либо чистить ссылки логикой repoint из duplicates и пересчитывать цену образа.
- 🟠 **not-wired · fix** — `src/lib/server/audit.ts:3`  
  Журнал Activity не видит самых опасных действий: создания, правки и удаления товаров, образов, постов и брендов, CSV-импорта, Seed, одобрения и отклонения луков, сброса лимита стилиста. Кто удалил товар, узнать нельзя.  
  → Добавить в AdminAction типы для товаров, образов, блога, брендов, импорта и модерации и писать их в этих роутах через logAdminAction.
- 🟠 **security · fix** — `src/lib/data/db.ts:714`  
  Страницу /look/<любой id>?d=… может собрать кто угодно: заголовок, описание, большая картинка и OG-превью берутся прямо из ссылки без подписи. На домене goo-fashion.com можно выпустить фейковую страницу GOO с чужим текстом и картинкой.  
  → Подписывать payload ?d= на сервере HMAC-ом или отказаться от ?d= и требовать запись в user_looks. Картинку разрешать только из нашего хранилища, ?d=-версии ставить noindex.
- 🟠 **broken · fix** — `src/app/api/admin/subscriptions/route.ts:61`  
  Если запрос к таблице subscriptions упал, страница Subscriptions пишет «No subscribers yet» и показывает зелёное здоровье биллинга. Любая ошибка billing_events выдаётся за «таблица не создана, запустите миграцию».  
  → При ошибке subscriptions отдавать 500 с текстом ошибки. «Таблицы нет» определять по кодам 42P01/PGRST205, остальные ошибки показывать как ошибку.
- ⚪ **perf · fix** — `src/lib/server/storage/product-images.ts:41`  
  Файлы из хранилища не удаляются никогда. Удаление товара, склейка дублей, удаление образа, лука или пользователя оставляют фото в бакетах навсегда, а каждое перезалитое фото получает новое случайное имя.  
  → Не удалять файлы вместе со строкой. Сделать периодическую чистку: удалять объект бакета только если на его URL не ссылается ни одна строка (products.image_url/images/color_images, outfits.image_url, user_looks, pending_looks, логотипы брендов, hero и настройки), и не раньше, чем через N дней после загрузки.
- ⚪ **broken · fix** — `src/app/api/report-bug/route.ts:120`  
  Внутренний баг-репорт пишет в задачу Plane «Скриншот: прикреплён к репорту», но скриншот в Plane не уходит. Его видит только Claude при разборе, дальше он теряется.  
  → Загружать скриншот в хранилище и вставлять ссылку в описание задачи (или отправлять через API вложений Plane), либо убрать ложную строку. Поля экранировать, /report закрыть от индексации.
- ⚪ **security · fix** — `src/app/api/generate-outfit/route.ts:174`  
  Генерация образа скачивает на сервер любые адреса картинок, которые прислал браузер: до 14 штук по 8 МБ, без проверки на внутренние адреса. Любой пользователь с тарифом может заставить сервер ходить во внутреннюю сеть; админский upload-image делает то же.  
  → Прогонять эти адреса через validateTargetUrl, а ещё лучше брать imageUrl из базы по productId, а не из запроса.
- ⚪ **dead-export · ask-ceo** — `src/lib/server/parser/import-product.ts:715`  
  Колонки price_min_usd и price_max_usd код пишет в трёх местах, но ничто их не читает. Единственный потребитель — параметр max_price_usd в RPC, а его никто не передаёт. «Бюджета стилиста», о котором говорят комментарии, в коде нет, и правка цены в админке эти колонки не обновляет.  
  → Решить, нужен ли стилисту фильтр по бюджету. Если нужен — передавать max_price_usd и обновлять колонку при правке. Если нет — перестать её писать и исправить комментарии.
- ⚪ **code-quality · simplify** — `src/lib/server/audit.ts:48`  
  В Activity у действий с каталогом вместо почты админа виден сырой Clerk-ID (user_2…). Журнал пишется двумя способами, и почту передаёт меньше половины мест.  
  → Переводить id в почту одним вызовом Clerk в /api/admin/audit (это закроет и старые записи) или передавать admin.email во всех местах. Прямые insert в recategorize и product-bg-color оставить (или сначала научить хелпер возвращать результат записи), иначе сломается Undo. Хелпер переключить на общий клиент из lib/supabase.
- ⚪ **design · fix** — `src/app/goo-studio/subscriptions/page.tsx:260`  
  Страница Subscriptions собрана мимо рецептов админки: шапки обеих таблиц без фона, цветом subtle и font-medium, цифры в карточках здоровья font-semibold, статусы в оттенках 500/600 на /5–/10. Из всего этого раньше нашли только rounded-md у бейджа.  
  → Привести шапки таблиц, цифры и статусные плашки к рецептам раздела 9 DESIGN_SYSTEM.md.
- ⚪ **dead-export · delete** — `src/lib/server/parser/import-product.ts:900`  
  Каждый импорт товара пишет строку в таблицу import_jobs, которую нигде не читают. Не используются и её тип DbImportJob, и типы FilterState и UserProfile в types.ts.  
  → Убрать запись в import_jobs и мёртвые типы. Саму таблицу можно оставить до общего решения о чистке схемы.
- ⚪ **stale-doc · fix** — `src/app/api/products/[id]/price-history/schema.sql:1`  
  SQL таблиц price_history и product_reviews лежит в папке API-роута, а не в supabase/migrations. Если поднимать базу по миграциям, этих таблиц не будет, и отзывы молча перестанут работать.  
  → Перенести файл в supabase/migrations под следующим номером, а из папки роута удалить.
- ⚪ **ux · fix** — `src/components/product/ProductClient.tsx:362`  
  На карточке товара размеры нарисованы кнопками с hover-эффектом, но нажатие ничего не делает: выбора размера и выбранного состояния нет.  
  → Сделать размеры неинтерактивными плашками (span без hover), раз выбор размера сайту не нужен.
