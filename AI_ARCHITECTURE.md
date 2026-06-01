# GOO AI Stylist — Architecture

## Обзор

AI Стилист на GOO работает на базе **Replicate** (открытые модели) и **Supabase pgvector** (семантический поиск по каталогу). Никакой OpenAI — все запросы идут через аккаунт goo-fashion на Replicate.

---

## Стек

| Компонент | Технология |
|---|---|
| LLM (чат) | `meta/meta-llama-3.1-70b-instruct` на Replicate |
| Embedding (векторизация) | `nateraw/bge-large-en-v1.5` на Replicate (1024 dims) |
| Векторное хранилище | Supabase PostgreSQL + pgvector extension |
| Аутентификация | Clerk |
| Rate limiting | Upstash Redis |
| История чатов | Supabase `stylist_chats` |

---

## Как работает поиск по каталогу

### Проблема
При 1 000 000+ товарах нельзя передать весь каталог в контекст модели — это дорого и медленно.

### Решение: PostgreSQL Full-Text Search

```
Пользователь пишет "хочу пальто для офиса"
           │
           ▼
   search_products(query_text) в Supabase
   → PostgreSQL tsvector/tsquery ищет
     по name, brand, description, category,
     style_keywords с GIN индексом
           │
           ▼
   30 наиболее релевантных товаров
   (ranked по ts_rank)
           │
           ▼
   30 товаров → system prompt → Replicate LLM
           │
           ▼
   Llama отвечает, зная только
   релевантные товары из каталога
```

### Почему это масштабируется
- GIN индекс на tsvector ищет среди миллионов записей за миллисекунды
- Каждый запрос к LLM видит только 30 товаров (не весь каталог)
- Новые товары автоматически индексируются (generated column — PostgreSQL сам обновляет)
- Никакой внешней API для индексации не нужно

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
│   └── replicate-ai.ts            ← Клиент Replicate (LLM + embedding)
│
└── components/stylist/
    ├── StylistDrawer.tsx           ← Основной UI чата
    ├── FloatingStylist.tsx         ← Кнопка-триггер
    └── StylistPersonalizationModal.tsx ← Настройки пользователя

supabase/migrations/
└── 005_product_embeddings.sql     ← pgvector + match_products функция
```

---

## Переменные окружения

```env
REPLICATE_API_TOKEN=r8_...          ← Токен аккаунта goo-fashion на Replicate
SUPABASE_URL=https://...            ← URL проекта Supabase
SUPABASE_SERVICE_ROLE_KEY=eyJ...    ← Service role ключ (только сервер)
```

---

## Флоу при добавлении нового товара

1. Товар добавляется через админку → сохраняется в Supabase `products`
2. Вызывается `POST /api/admin/embeddings` (вручную или автоматически)
3. Для каждого товара без эмбеддинга генерируется вектор через Replicate
4. Вектор сохраняется в колонку `products.embedding`
5. Стилист автоматически видит новый товар при следующем релевантном запросе

**⚠️ После добавления новых товаров нужно запустить генерацию эмбеддингов!**
Либо из admin панели (если добавить кнопку), либо через:
```bash
curl -X POST https://goo-fashion.com/api/admin/embeddings \
  -H "Authorization: Bearer <admin_token>"
```

---

## Лимиты сообщений

| План | Сообщений в день |
|---|---|
| Free | 20 |
| Plus | 150 |
| Ultra | Безлимит |

Счётчик хранится в таблице `stylist_daily_usage`, сбрасывается каждый день.

---

## Персонализация

Настройки пользователя (ник, местоимения, цели стиля, ограничения) хранятся в Clerk `unsafeMetadata.stylistPersonalization`. Не в базе данных. Инжектируются в system prompt при каждом запросе.

---

## Как поменять модель

В файле `src/lib/server/replicate-ai.ts`:

```typescript
const LLM_MODEL   = "meta/meta-llama-3.1-70b-instruct"; // ← сменить здесь
const EMBED_MODEL = "nateraw/bge-large-en-v1.5";         // ← и здесь (если меняем размерность — обновить миграцию)
```

При смене embedding модели с другой размерностью нужно:
1. Обновить `EMBEDDING_DIMS` в `replicate-ai.ts`
2. Создать новую миграцию с `alter table products alter column embedding type vector(NEW_DIM)`
3. Заново сгенерировать все эмбеддинги через `/api/admin/embeddings`
