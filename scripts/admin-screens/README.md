# Стенд скриншотов админки

Снимает все страницы `/goo-studio` в светлой и тёмной теме, на десктопе (1440×900) и телефоне (390×844), без доступа к Clerk, Supabase и прочим сервисам. Нужен, чтобы проверять UI-задачи по DoD снимками «до» и «после». Раньше это было невозможно: в контейнере нет боевых ключей (см. доказательства Б0-2 и Б1-5 в `AUDIT_PLAN_BRIEF.md`).

## Как устроено

- **`setup.sh` собирает временную копию рабочего дерева** в `$ADMIN_SCREENS_DIR` (по умолчанию `/tmp/goo-admin-screens`), включая незакоммиченные правки. В копии:
  - `@clerk/nextjs` подменён заглушкой `clerk-stub.tsx` — вход под супер-админом;
  - `src/proxy.ts` пропускает всё.

  Затем запускает `next dev` на `:3100`. **Репозиторий не меняется; заглушку и открытый proxy в `src/` не переносить никогда.**
- **`shoot.js` отвечает на каждый запрос `/api/**` из фикстур** `fixtures/*.js` и снимает страницы целиком. Внешние запросы глушатся. Картинки товаров — заглушки `https://img.harness/…`.
- **Фикстуры повторяют реальное состояние прода** из `docs/ADMIN_UX_REVIEW_2026-10.md`: 1224 товара, «Air Jordan» на чужих товарах, 12 недостающих миграций, просроченная подписка, 104 замечания аудита и т. д.
  - Все адреса — `example.com`.
  - Общий каталог — `fixtures/catalog.js`.
  - Каждая группа разделов — свой файл.

## Запуск

```bash
bash scripts/admin-screens/setup.sh
NODE_PATH=/tmp/goo-admin-screens/pw/node_modules \
  node scripts/admin-screens/shoot.js --only=products,products-editor --theme=both --vp=both
```

**Параметры:**
- `--only` — имена страниц через запятую; без него снимаются все.
- `--theme` — `light` | `dark` | `both`.
- `--vp` — `desktop` | `mobile` | `both`.
- `--out` — папка для снимков; по умолчанию `$TMPDIR/goo-admin-screens/shots`.
- `--lang` — `en` (по умолчанию) | `ru`: язык админки (GS4-8). У снимков на русском в имени суффикс `-ru`.
- `--axe` — вместо снимков проверка контраста axe-core (`color-contrast`) на каждой странице. Печатает число нарушений и первые десять элементов. Так проверяется DoD GS4-1 из `docs/ADMIN_ROADMAP.md`.

Имена файлов: `<страница>--<тема>-<экран>.png`.

**Что печатает `shoot.js` по каждой странице:**
- `unmatched` — запросы API, на которые нет фикстуры (им отвечает `{}`);
- `errors` — ошибки страницы.

Если после правки появилась ошибка, проверьте сначала, не поменялась ли форма ответа API: тогда обновите фикстуру.

**Окружение.** Chromium берётся из `CHROMIUM_PATH` (по умолчанию `/opt/pw-browsers/chromium`, как в облачной среде Claude Code). Адрес приложения — `ADMIN_SCREENS_URL`.

## Имена страниц

- **Основные:** `dashboard`, `products`, `outfits`, `brands`, `retailers`, `audit`, `duplicates`, `catalogue-check`, `categories`, `blog`, `import`, `parser`, `parser-collect`, `users`, `waitlist`, `email`, `analytics`, `subscriptions`, `activity`, `settings`, `prompts`.
- **Состояния** (открытая модалка, вкладка, шаг) — их объявляют фикстуры через `pages`:
  - `products-editor` … `products-editor-4`, `products-bulk`, `products-filter`, `products-row-menu`, `products-maintenance`;
  - `outfits-bulk`, `outfits-pending`, `outfits-pending-review`;
  - `brands-confirm`, `brands-toast`, `retailers-help`;
  - `users-drawer`, `users-bulk`, `email-confirm`, `account-menu`;
  - `catalogue-check-ready`;
  - `import-merchants`, `import-preview`;
  - `parser-parse`, `parser-recipes`, `parser-fetch`, `parser-crawl`, `parser-collect-run`;
  - `blog-editor`, `prompts-image`, `analytics-30d`.

## Добавить страницу или состояние

В нужном файле `fixtures/` добавить в `routes` ответы API. Ключи бывают трёх видов:
- `"GET /api/x"` — по пути;
- `"GET /api/x?a=1"` — с точным запросом;
- `"GET /api/x/*"` — по префиксу.

Значение — данные, функция `({ url, method, body }) => данные` или `{ __status, __body }`.

Состояние страницы добавляется в `pages`: `{ name, url, after: async (page) => { … }, wait, fullPage }`.
