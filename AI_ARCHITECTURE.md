# GOO AI Stylist — Architecture

## Обзор

AI Стилист на GOO работает на базе **Replicate** (модели OpenAI-семейства,
проксируемые через аккаунт goo-fashion — отдельный OpenAI-ключ для стилиста не
нужен) и **Supabase** для поиска по каталогу: full-text search всегда, плюс
опциональный семантический поиск на pgvector.

---

## Стек

| Компонент | Технология |
|---|---|
| LLM (чат) | `openai/gpt-4.1` на Replicate (переопределяется env `STYLIST_LLM_MODEL`) |
| Embedding (векторизация) | `nateraw/bge-large-en-v1.5` на Replicate (1024 dims) |
| Поиск по каталогу | PostgreSQL FTS (`search_products`) + опц. pgvector (`match_products`) |
| Аутентификация | Clerk |
| Rate limiting | Upstash Redis |
| История чатов | Supabase `stylist_chats` |

---

## Как работает поиск по каталогу

### Проблема
При 1 000 000+ товарах нельзя передать весь каталог в контекст модели — это дорого и медленно.

### Решение: гибридный поиск (`findRelevantProducts`)

Поиск собирает кандидатов из нескольких источников и мёрджит их (дедуп по id):

```
Пользователь пишет "что надеть на свидание"
           │
   augmentQuery(): RU→EN + маппинг поводов/интентов
   ("свидание" → "elegant romantic evening date")
           │
           ├─(1) Прямой fetch по категории, если она названа
           │     (словарь CATEGORY_HINTS + стемминг)
           │
           ├─(2) Семантика (опц.): embedText(query) → match_products
           │     (pgvector, cosine, порог 0.3). Вкл. STYLIST_SEMANTIC_SEARCH=1
           │
           ├─(3) FTS: search_products(query_text) — tsvector/tsquery, GIN, ts_rank
           │
           └─(4) Recency fallback, если ничего не нашлось
           │
           ▼
   ~30 релевантных товаров → system prompt → Replicate LLM (gpt-4.1)
           │
           ▼
   Модель отвечает, зная только релевантные товары из каталога
```

### Почему это масштабируется
- GIN индекс на tsvector и HNSW индекс на embedding ищут среди миллионов записей быстро
- Каждый запрос к LLM видит только ~30 товаров (не весь каталог)
- FTS-колонка `fts` пересчитывается триггером при insert/update (миграция 006)
- Семантика graceful: если эмбеддинги не сгенерированы или флаг выключен — работает один FTS

---

## Файлы

```
src/
├── app/api/
│   ├── stylist/
│   │   ├── chat/route.ts          ← Главный endpoint чата
│   │   ├── chat/history/route.ts  ← Сохранение/загрузка истории
│   │   ├── chat/sessions/route.ts ← Список сессий пользователя
│   │   └── usage/route.ts         ← Лимиты сообщений
│   └── admin/
│       └── embeddings/route.ts    ← Генерация эмбеддингов (admin only)
│
├── lib/server/
│   └── replicate-ai.ts            ← Клиент Replicate (chatCompletion + embedText)
│
└── components/stylist/
    ├── StylistDrawer.tsx           ← Основной UI чата
    └── StylistPersonalizationModal.tsx ← Настройки пользователя

Триггер открытия стилиста — кнопка в `components/layout/Navigation.tsx`
(десктоп + мобильная «AI»), drawer рендерится глобально в
`ConditionalSiteLayout.tsx` через контекст `useStylist()`.

supabase/migrations/
├── 005_product_embeddings.sql     ← pgvector + match_products функция
└── 006_product_fts.sql            ← tsvector + триггер + search_products функция
```

---

## Переменные окружения

```env
REPLICATE_API_TOKEN=r8_...          ← Токен аккаунта goo-fashion на Replicate
SUPABASE_URL=https://...            ← URL проекта Supabase
SUPABASE_SERVICE_ROLE_KEY=eyJ...    ← Service role ключ (только сервер)
STYLIST_LLM_MODEL=openai/gpt-4.1    ← (опц.) переопределить модель чата
STYLIST_SEMANTIC_SEARCH=1           ← (опц.) включить семантический поиск
ADMIN_USER_IDS=user_...,user_...    ← доступ к /api/admin/embeddings
```

---

## Флоу при добавлении нового товара

1. Товар добавляется через админку → сохраняется в Supabase `products`
2. Вызывается `POST /api/admin/embeddings` (вручную или автоматически)
3. Для каждого товара без эмбеддинга генерируется вектор через Replicate
4. Вектор сохраняется в колонку `products.embedding`
5. Стилист автоматически видит новый товар при следующем релевантном запросе

**⚠️ Семантика работает только после бэкфилла эмбеддингов и при включённом
флаге `STYLIST_SEMANTIC_SEARCH=1`.** Эндпоинт защищён Clerk-сессией админа
(`requireAdmin`), вызывать из авторизованной сессии (не bearer-токеном).
Обрабатывает батч за вызов — повторять, пока `done: true`:
```bash
# покрытие
GET  /api/admin/embeddings   → { total, withEmbedding, missing, coverage }
# бэкфилл батчами
POST /api/admin/embeddings   { "batchSize": 50 }  → { processed, remaining, done }
```

---

## Лимиты сообщений

| План | Сообщений в день |
|---|---|
| Free | 20 |
| Basic | 50 |
| Pro | 150 |
| Premium | Безлимит |

(значения — `STYLIST_DAILY_LIMITS` в `src/lib/plans.ts`)

Счётчик хранится в таблице `stylist_daily_usage`, сбрасывается каждый день.

---

## Персонализация

Настройки пользователя (ник, местоимения, цели стиля, ограничения) хранятся в Clerk `unsafeMetadata.stylistPersonalization`. Не в базе данных. Инжектируются в system prompt при каждом запросе.

---

## Как поменять модель

В файле `src/lib/server/replicate-ai.ts`:

```typescript
const DEFAULT_LLM_MODEL = "openai/gpt-4.1";        // ← модель чата по умолчанию
const EMBED_MODEL       = "nateraw/bge-large-en-v1.5"; // ← embedding (размерность → миграция)
```

Модель чата можно сменить без деплоя через env `STYLIST_LLM_MODEL`.

При смене embedding модели с другой размерностью нужно:
1. Обновить `EMBEDDING_DIMS` в `replicate-ai.ts`
2. Создать новую миграцию с `alter table products alter column embedding type vector(NEW_DIM)`
3. Заново сгенерировать все эмбеддинги через `/api/admin/embeddings`
