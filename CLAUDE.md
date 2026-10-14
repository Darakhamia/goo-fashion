# Claude Code Instructions

## Текущий трек — редизайн админки (решение CEO 2026-10-05)

Сейчас работа идёт по `docs/ADMIN_ROADMAP.md` (задачи, доска статусов) и `docs/ADMIN_DESIGN.md` (целевой дизайн админки). Протокол — как у плана аудита ниже: перепроверить по коду, одна задача — один коммит, DoD проверяется фактически, развилки за CEO. UI-задачи прикладывают снимки стенда `scripts/admin-screens` «до» и «после».

## Параллельный трек — мобильная версия сайта (решение CEO 2026-10-06)

Публичный сайт на телефоне «причёсывается» отдельным треком, админку ведёт другой сотрудник. План — `docs/MOBILE_PLAN.md`, дальше макеты `docs/mobile-mockups/` и роадмап `docs/MOBILE_ROADMAP.md`. Правки только ниже брейкпоинта `md`, десктоп не меняется. Общие с админкой файлы (`globals.css`, `DESIGN_SYSTEM.md`, `scripts/admin-screens`) трогать только добавлениями.

План аудита — на паузе до работы над продажами, тарифами и лендингом. Оплату CEO 2026-10-14 решил чинить сейчас: подписка банка monobank, счёт — запасной путь (`BILLING.md`; раздел «Отложено: оплата» в `docs/ADMIN_ROADMAP.md`).

## Работа по плану аудита — читать первым

В репозитории действует план разработки, составленный по итогам аудита сайта от 7 августа 2026.

- `AUDIT_PLAN_BRIEF.md` — протокол работы: как выбирать задачу, правила, доска статусов, когда обращаться к CEO. **Прочитать целиком до первой правки кода.**
- `AUDIT_DEV_PLAN.md` — сами задачи: 12 блоков (Б0–Б11), 4 волны, у каждой задачи DoD.

Правила, действующие всегда:
- Задачи берутся по порядку волн, с доски статусов в конце `AUDIT_PLAN_BRIEF.md`. Волна не начинается, пока предыдущая не закрыта.
- Перед правкой перепроверять по коду, что проблема ещё существует — план это снимок на 7 августа 2026.
- Задача закрывается только после фактической проверки по DoD, с записью доказательства на доску.
- Развилки из раздела «Решения, которые ты не принимаешь» — за CEO, не за агентом.
- Конец волны и исчерпание плана — обязательная остановка с отчётом CEO. Новый план агент не пишет.

## Дизайн — читать перед любой правкой UI

`DESIGN_SYSTEM.md` — описание фактического визуального языка сайта, снятое с кода (токены, типографика, сетка, радиусы, канонические рецепты карточек/кнопок/полей/модалок, движение, тёмная тема, отдельный диалект `goo-studio`).

- Добавляешь или меняешь элемент интерфейса — сверься с `DESIGN_SYSTEM.md` и пройди чеклист из раздела 10 до коммита.
- Цвет только через CSS-переменные (`bg-[var(--surface)]`), никаких `text-gray-*` и hex-литералов.
- Кнопки собираются по рецептам раздела 5.3; в админке — по разделу 9. Мёртвая shadcn-кнопка `src/components/ui/button.tsx` удалена 2026-09-27 (коммит `7898c3f`, `docs/CODE_REVIEW_2026-09.md`); новый общий примитив кнопки, конкурирующий с рецептами, не заводить.
- Раздел 11 — список найденных расхождений. Это наблюдения, а не наряд на работу: чинить их можно только отдельной задачей по решению CEO.

## Документация

- `README.md` — стек, запуск, структура репозитория, деплой (Coolify) и указатель на все документы.
- `docs/ADMIN.md` — руководство по админке `goo-studio`: разделы, доступы, журнал действий, типовые сценарии.
- `docs/CODE_REVIEW_2026-09.md` — код-ревью сентября 2026: находки, решения CEO, что сделано и что открыто.
- `AI_ARCHITECTURE.md`, `BILLING.md`, `PARSER.md`, `MIGRATION_RUNBOOK.md`, `extension/README.md` — по своим областям. Выполненные планы — в `docs/archive/`, как история, не как инструкция.
- Прод живёт на Coolify. Деплоя на Vercel больше нет (подтвердил CEO 2026-09-27), `vercel.json` удалён; cron продления подписок — только Scheduled Task в Coolify (`BILLING.md`).

## Миграции базы — применяются сами при деплое

Работает на проде с 2026-10-11 (GS0-5). Перед `next start` деплой запускает `scripts/migrate.mjs`: он сверяет файлы `supabase/migrations/NNN_*.sql` с таблицей `schema_migrations` и применяет недостающие по порядку через функцию `goo_apply_migration` (миграция `026`). Связь — HTTPS к PostgREST с ключом service role, как у всего сайта: сайт и Supabase стоят на разных серверах, прямого подключения к Postgres нет и не нужно. Подробности — README, раздел «Деплой».

**Как добавить изменение базы**
1. Новый файл `supabase/migrations/NNN_что_делает.sql`. Номер — следующий после последнего на актуальном `master`. Имя строго `[0-9]{3}_[a-z0-9_]+.sql`, иначе скрипт его не увидит.
2. В шапке комментарием: что делает, зачем, что сломается без него — как в соседних файлах.
3. Файл идемпотентный (`if not exists`, `create or replace`, `on conflict do nothing`) и целиком проходит в одной транзакции: без `create index concurrently`, `vacuum` и прочего, что транзакция не пускает. Свои `begin;`/`commit;` скрипт вырезает сам.
4. Функция с другим набором аргументов: `create or replace` не заменит старую, а создаст вторую, и PostgREST упадёт с «function … is not unique». Сначала `drop function if exists` со старой сигнатурой (пример — `014`).
5. Код переживает отсутствие новой колонки: если миграция упадёт, сайт стартует без неё. Новые колонки товара — в `OPTIONAL_COLUMNS` (`src/lib/data/db.ts`); если колонку важно видеть в Settings → Database schema — строка в `src/lib/server/schema-check.ts`.
6. До слияния файл проходит CI-задачу `migrations apply cleanly`: вся цепочка на Postgres 15 + pgvector + PostgREST 14.6 (версия прода) тем же путём, что деплой. Проверить локально — повторить её шаги из `.github/workflows/ci.yml`.
7. Миграцию, которая меняет или удаляет данные на проде (`update`, `delete`, `drop`), сначала показать CEO и получить «да»: после слияния она выполнится сама, отдельного шага уже не будет.

**Чего не делать**
- Не просить CEO выполнить SQL в SQL-редакторе Supabase или в консоли сервера — для этого и есть деплой. Ручной шаг допустим, только если сломан сам деплойный путь.
- Не править уже применённый файл: скрипт не перезапустит его, только предупредит в логе. Исправление — новым файлом.
- Не трогать `026_migration_runner.sql` и `scripts/migrate.mjs` без отдельной задачи. Корневые `supabase-schema.sql` и `supabase-migration-*.sql` — исходная схема, деплой их не применяет; новых таких не заводить.

**После слияния** Settings → Database schema показывает «Last deploy: applied NNN_….sql». Красная строка — файл откатился целиком, сайт работает: исправить новым файлом. «Apply now» (только супер-админ) повторяет шаг, если база была недоступна во время деплоя.

## Branch Policy
- Always work directly on the `master` branch
- Never create new feature branches
- Commit and push all changes to `master`

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

The CLI (`graphifyy` from PyPI) is installed automatically by the SessionStart hook in `.claude/settings.json` when it is missing.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
