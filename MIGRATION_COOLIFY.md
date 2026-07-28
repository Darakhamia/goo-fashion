# Перенос базы с Supabase Cloud на Coolify

Runbook для миграции БД и Storage проекта GOO Fashion с managed Supabase на
self-hosted Supabase в Coolify. Скрипты лежат в `scripts/migrate/`.

---

## 1. Что именно надо перенести

Прежде чем выбирать способ — важно, что «база на Supabase» здесь это не только
Postgres:

| Компонент | Где используется | Переносится |
|---|---|---|
| Postgres (схема `public`) | 21 таблица (см. ниже) | `pg_dump` / `psql` |
| PostgREST (REST API) | ~50 route-файлов через `@supabase/supabase-js` (`src/lib/supabase.ts`) | нужен на новой стороне |
| Storage | 4 бакета: `product-images`, `site-assets`, `outfit-images`, `generated-outfits` | отдельным скриптом |
| pgvector | `products.embedding vector(1536)` + HNSW-индекс, RPC `match_products` | вместе с дампом |
| FTS | `products.fts tsvector` + триггер + RPC `search_products` | вместе с дампом |
| RPC `run_sql` | `src/app/api/products/group/route.ts` | **только с `pg_dump`** — см. ниже |
| Auth | **Clerk, не Supabase Auth** | переносить нечего |

Таблицы, к которым обращается код:

```
admin_audit_log   analytics_events  billing_events    blog_posts
brands            color_groups      import_jobs       outfits
page_views        pending_looks     price_history     product_reviews
products          settings          stylist_chats     stylist_daily_usage
subscriptions     user_likes        user_looks        waitlist
web_vitals
```

Два следствия из этой таблицы:

**Auth на Clerk — это большая удача.** Мигрируются только данные, пользователей
перевыпускать не надо.

**Схема в репозитории не равна схеме в проде.** Из списка выше `price_history`,
`product_reviews`, `settings`, `stylist_chats`, `waitlist` и `pending_looks` не
создаются ни `supabase-schema.sql`, ни `supabase/migrations/*.sql` — их завели
руками через Supabase SQL Editor. Там же живёт RPC `run_sql`, который вызывает
`src/app/api/products/group/route.ts`.

Поэтому базу надо переносить **дампом реальной БД**, а не повторным прогоном
`supabase/migrations/*.sql` на чистом Postgres. Во втором случае потеряется
примерно четверть таблиц и один RPC, причём молча — упадут только те роуты,
которые их трогают.

---

## 2. Развилка: что поднимать в Coolify

### Вариант A — self-hosted Supabase (рекомендую)

В Coolify есть готовый шаблон сервиса Supabase (весь стек: Postgres + Kong +
PostgREST + Storage + Studio).

- Кода менять не надо вообще. `src/lib/supabase.ts` создаёт клиент из
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — меняются только значения этих
  двух переменных.
- Storage API остаётся тем же, `getPublicUrl()` продолжает работать.
- `.rpc()`, RLS-политики, pgvector — всё как было.
- Цена: только сервер. Стек требует **минимум 4 ГБ RAM, комфортно 8 ГБ**.

### Вариант B — голый Postgres + переписать код на `pg`/Drizzle

- Надо переписать ~50 route-файлов, три `.rpc()` вызова и заменить Storage на
  S3/MinIO.
- Экономит ~2 ГБ RAM и убирает пять контейнеров.

**Идти вариантом A.** При лежащем проде переписывание слоя доступа к данным —
это не миграция, а рефакторинг с непредсказуемым сроком. Вариант B имеет смысл
позже, отдельной задачей, когда прод уже живой.

Дальше runbook написан под вариант A.

---

## 3. Предусловие: достать данные из заблокированного проекта

Дамп невозможен, пока проект на паузе. По ситуации:

- **Проект спаузен** (free tier) — в дашборде Supabase кнопка *Restore project*.
  Восстановление бесплатно, занимает несколько минут.
- **Превышен лимит размера БД / egress** — проект переводится в read-only.
  Для `pg_dump` этого достаточно: чтения хватает.
- **Не поднимается вообще** — Database → Backups, скачать последний бэкап; тогда
  шаг 5 запускается из него вместо `dump-supabase.sh`.

Если не поднимается ничем — оплата Pro на один месяц (~$25) дешевле, чем потеря
каталога. Считать это последним средством, а не первым шагом.

Пока проект доступен, снять размеры — от них зависит время шагов 5 и 7:

```sql
-- размер БД
select pg_size_pretty(pg_database_size(current_database()));

-- размер Storage по бакетам
select bucket_id,
       count(*) as objects,
       pg_size_pretty(sum((metadata->>'size')::bigint)) as size
from storage.objects
group by bucket_id
order by 3 desc;
```

---

## 4. Поднять Supabase в Coolify

1. Coolify → проект → **+ New** → **Service** → **Supabase**.
2. Дать домен для Kong (например `supabase.goo-fashion.com`) — это и будет
   новый `SUPABASE_URL`.
3. Сохранить сгенерированные переменные: `POSTGRES_PASSWORD`, `JWT_SECRET`,
   `ANON_KEY`, `SERVICE_ROLE_KEY`, `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD`.

   `ANON_KEY` и `SERVICE_ROLE_KEY` — это JWT, подписанные `JWT_SECRET`. Меняя
   `JWT_SECRET`, надо перевыпустить оба ключа, иначе Kong будет отдавать 401 на
   всё.
4. Выключить `analytics` (Logflare), если он не нужен — на маленьком сервере он
   чаще всего и валит весь стек по памяти.
5. Дождаться, пока контейнеры станут healthy, и проверить:
   `curl https://supabase.goo-fashion.com/rest/v1/ -H "apikey: $SERVICE_ROLE_KEY"`.

Postgres наружу Coolify по умолчанию не публикует. Для шагов 5–6 либо временно
открыть порт 5432 в настройках сервиса, либо гонять `psql` внутри сети Docker
через `docker exec` на сервере. Открытый порт **закрыть сразу после миграции**.

---

## 5. Дамп из Supabase Cloud

Строку подключения взять в Supabase: Project Settings → Database → Connection
string. Нужен **Session pooler (порт 5432)** или Direct connection — через
transaction pooler на 6543 `pg_dump` не работает.

```bash
export SOURCE_DB_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
./scripts/migrate/dump-supabase.sh
```

Скрипт кладёт в `migration-dump/`: `schema.sql`, `data.sql` и
`rowcounts-source.csv` (точные `count(*)` по таблицам — для сверки после
восстановления). `pg_dump` запускается в контейнере `postgres:17`, чтобы версия
клиента гарантированно была не ниже серверной.

---

## 6. Восстановление в Coolify

```bash
export TARGET_DB_URL='postgresql://postgres:<POSTGRES_PASSWORD>@<coolify-host>:5432/postgres'
./scripts/migrate/restore-coolify.sh
```

Что делает скрипт:

1. создаёт расширения `vector` и `pg_trgm`;
2. накатывает `schema.sql` с `ON_ERROR_STOP=0` — ошибки вида «роль/расширение уже
   существует» здесь ожидаемы, в self-hosted Supabase роли `anon`,
   `authenticated`, `service_role` уже есть;
3. накатывает `data.sql` с `ON_ERROR_STOP=1` — тут любая ошибка фатальна;
4. применяет `grants.sql`. **Этот шаг не пропускать:** дамп снят с `--no-owner`,
   и без грантов PostgREST отвечает `permission denied for table` на всё. RLS-
   политики из дампа приезжают, но политика только сужает уже выданное право;
5. сверяет точные `count(*)` с источником и падает при расхождении.

`data.sql` восстанавливается с `--disable-triggers` (снимает проблему порядка
вставки при FK и не даёт триггеру пересчитать `products.fts` поверх дампа) —
для этого подключение к целевой БД должно быть суперюзерским; роль `postgres`
в self-hosted Supabase им является.

---

## 7. Перенос Storage

`pg_dump` файлы не переносит — байты лежат в S3 за Storage API, а строки
`storage.objects` без байтов хуже, чем ничего. Скрипт ходит по обеим сторонам
через публичный API:

```bash
SOURCE_SUPABASE_URL='https://<ref>.supabase.co' \
SOURCE_SERVICE_ROLE_KEY='<старый service_role>' \
TARGET_SUPABASE_URL='https://supabase.goo-fashion.com' \
TARGET_SERVICE_ROLE_KEY='<новый service_role>' \
  node scripts/migrate/migrate-storage.mjs --dry-run   # сначала посмотреть объём

# затем без --dry-run
```

Скрипт создаёт бакеты с теми же флагами публичности, рекурсивно обходит все
папки и перезаливает объекты. Повторный запуск безопасен: объекты, уже лежащие
в целевом бакете с тем же размером, пропускаются — прерванный прогон
продолжается с места остановки.

---

## 8. Переписать URL картинок в базе

Приложение хранит **абсолютные** URL (результат `getPublicUrl()`), поэтому
старый project ref вшит в `products.image_url`, `products.images`,
`products.color_images`, `outfits.image_url`, `blog_posts.cover_image_url`,
`brands.logo_url` и настройки админки. Скопировать байты недостаточно — без
этого шага каталог продолжит грузить картинки из мёртвого проекта.

```bash
psql "$TARGET_DB_URL" \
  -v old_host='https://<ref>.supabase.co' \
  -v new_host='https://supabase.goo-fashion.com' \
  -f scripts/migrate/rewrite-storage-urls.sql
```

Скрипт проходит по всем `text` / `text[]` / `json(b)` колонкам схемы `public`
(а не по захардкоженному списку, который разъедется при добавлении таблиц) и
меняет только хост; путь `/storage/v1/object/public/<bucket>/<key>` в
self-hosted Supabase такой же. Каждый `UPDATE` ограничен `LIKE` по старому
хосту, так что строки без Supabase-URL не трогаются. Всё в одной транзакции с
отчётом по колонкам.

---

## 9. Проверка

```bash
psql "$TARGET_DB_URL" -f scripts/migrate/verify.sql
```

Проверяет то, что не ловится сверкой количества строк: расширения, наличие RPC
(`match_products`, `search_products`, `run_sql`), индексы `products_fts_idx` и
`products_embedding_hnsw_idx`, гранты для `service_role`, отсутствие
недопереписанных `supabase.co`-ссылок и покрытие эмбеддингами.

Если `with_embedding` заметно меньше `products` — прогнать
`POST /api/admin/embeddings`, иначе векторный поиск стилиста деградирует до
FTS.

---

## 10. Переключение приложения

Поменять две переменные окружения (Vercel / Coolify — где крутится Next.js):

```
SUPABASE_URL=https://supabase.goo-fashion.com
SUPABASE_SERVICE_ROLE_KEY=<новый service_role JWT>
```

Остальное не трогается: Clerk, Anthropic, OpenAI, Replicate, Resend, Upstash,
monobank — вне периметра миграции. `next.config.ts` уже разрешает картинки с
любого HTTPS-хоста, правки не нужны.

Дальше — редеплой и прогон по живому:

- главная и каталог — грузятся ли картинки;
- `/api/products` — отдаёт список;
- чат стилиста — отрабатывает `match_products` (векторный) и `search_products` (FTS);
- админка: загрузка картинки товара, `/api/products/group` (это `run_sql`),
  публикация блог-поста;
- сохранение лука в избранное — запись в `user_looks`.

---

## 11. Откат

Пока старый проект Supabase не удалён, откат — это возврат двух переменных
окружения и редеплой. Поэтому:

- **не удалять проект в Supabase минимум неделю** после переключения;
- держать `migration-dump/` до конца этого срока;
- учитывать, что записи, сделанные после переключения, живут только в новой БД —
  откат их потеряет.

`migration-dump/` содержит полный слепок прод-базы. Он уже покрыт `.gitignore`
(`/migration-dump`), но хранить его стоит там же, где остальные секреты, и
удалить после успешной миграции.

---

## 12. Грабли

- **Transaction pooler (6543)** — `pg_dump` через него не работает. Только 5432.
- **Пропущенные гранты** — самый частый симптом «всё сломалось после миграции»:
  PostgREST отвечает `permission denied for table products`. Лечится
  `grants.sql`.
- **`JWT_SECRET` и ключи** — `ANON_KEY`/`SERVICE_ROLE_KEY` подписаны секретом.
  Меняя одно, менять и второе.
- **`run_sql`** — существует только в дампе, не в миграциях репозитория.
- **Analytics/Logflare** — главный пожиратель памяти в стеке. На сервере с 4 ГБ
  отключить.
- **Открытый наружу 5432** — закрыть сразу после миграции.
- **Эмбеддинги** — переезжают дампом, но если каталог пополнялся при лежащем
  Supabase, часть товаров будет без вектора. Проверяется `verify.sql`.
