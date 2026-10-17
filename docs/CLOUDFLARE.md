# Cloudflare перед goo-fashion.com и защита от ботов

**Решение CEO 2026-10-17.** Защищаем сервер от нагрузки ботов. Пускаем поисковики, превью ссылок, AI-поиск и свои сервисы. Перед сайтом ставим бесплатный Cloudflare.

Защита в двух слоях:
- **сайт сам** отваживает известных тяжёлых ботов (раздел «Что делает код»);
- **Cloudflare** отсекает остальное ещё до сервера, ограничивает частоту запросов и кеширует картинки.

## Что делает код

- **`src/lib/bots.ts` — список ботов, которых не пускаем.** Это AI-краулеры для обучения моделей (GPTBot, ClaudeBot, Bytespider, CCBot, meta-externalagent, Amazonbot и др.) и краулеры SEO-сервисов (AhrefsBot, SemrushBot, MJ12bot, DotBot и др.). Они много качают и не приводят посетителей.
  - **Пускаем:** поисковики (Googlebot, bingbot, Applebot, DuckDuckBot, YandexBot), превью ссылок (Telegram, Facebook/Instagram, WhatsApp, Viber, X, LinkedIn, Slack, Discord), AI-поиск (OAI-SearchBot и ChatGPT-User, PerplexityBot, Claude-SearchBot и Claude-User, meta-externalfetcher).
  - **Свои:** вебхуки monobank и задачи Coolify (curl на localhost). Общие клиенты вроде curl и python-requests в список не попадают никогда.
- **`src/app/robots.ts`** просит ботов из списка не заходить на сайт вообще (`Disallow: /`). Вежливые боты, например GPTBot и AhrefsBot, после этого перестают ходить.
- **`src/proxy.ts`** отвечает 403 ботам из списка, которые пришли всё равно (Bytespider robots.txt не читает). Ответ уходит до рендера страницы и до Clerk. `/robots.txt` им по-прежнему отдаётся.
- **`src/lib/server/client-ip.ts`** определяет IP посетителя за Cloudflare. Без этого все посетители выглядели бы для сайта как несколько адресов Cloudflare, и лимиты AI-стилиста (Upstash, по IP) срабатывали бы на всех сразу.
  - Адрес берётся из `CF-Connecting-IP`, но только если запрос действительно пришёл с адреса Cloudflare.
  - Кто обратится к серверу напрямую, подделав заголовок, лимиты не обойдёт.
- **Политики конфиденциальности и cookie** называют Cloudflare обработчиком данных. Его cookie `cf_clearance` появляется, только если посетителя попросили пройти проверку.

Если для SEO начнёте пользоваться Ahrefs или Semrush, уберите их бота из `src/lib/bots.ts`, иначе сервис не увидит сайт.

## Подключение Cloudflare — шаги для владельца домена

Займёт полчаса плюс ожидание DNS. Откатить можно в любой момент, см. «Если что-то сломалось».

### 0. Перед началом
Откройте DNS-записи домена у регистратора и **сделайте скриншот всех записей**. По нему будем сверять: потерянная MX-запись — это потерянная почта, потерянная запись Clerk — сломанный вход.

### 1. Добавить домен
https://dash.cloudflare.com → **Add a domain** → `goo-fashion.com` → тариф **Free**. Cloudflare сам просканирует и импортирует DNS-записи.

### 2. Сверить записи со скриншотом
Каждая запись со скриншота должна быть в списке. Недостающие добавьте руками.

Облако у записи — это проксирование: оранжевое значит «через Cloudflare», серое — «DNS only».

| Запись | Облако | Почему |
|---|---|---|
| `goo-fashion.com` (A → IP сервера Coolify) | **оранжевое** | сайт, ради него всё |
| `www` | **оранжевое** | редирект на основной домен |
| `supabase` | серое | другой сервер со своим сертификатом |
| записи Clerk: `clerk`, `accounts`, `clkmail`, `clk._domainkey`, `clk2._domainkey` | серое | Clerk требует DNS only |
| MX, TXT (SPF, DKIM, DMARC, Resend, верификация Google) | — | не проксируются, просто должны быть |
| всё остальное, что не знаете | серое | серое ведёт себя как сейчас |

### 3. SSL/TLS
- **SSL/TLS → Overview → режим `Full`.**
  - Не `Flexible`: будет бесконечный редирект.
  - Не `Full (strict)`: если продление сертификата на сервере когда-нибудь не пройдёт, strict уронит сайт с ошибкой 526. `Full` при этом продолжит работать.
- **SSL/TLS → Edge Certificates → `Always Use HTTPS` — выключено.** Редирект на https уже делает Coolify. Включённый в Cloudflare ломает продление сертификата Let's Encrypt на сервере: Cloudflare ходит к серверу тем же протоколом, что и посетитель, и проверка Let's Encrypt по http должна доходить до сервера как есть.
- HSTS не включать.

### 4. Сменить NS у регистратора
Cloudflare покажет два своих NS-сервера. Впишите их у регистратора вместо текущих. Статус в Cloudflare сменится на **Active**: обычно за минуты, иногда за сутки.

После этого проверьте:
- сайт открывается;
- вход работает;
- почта на `anything@goo-fashion.com` приходит.

### 5. Боты: Security → Bots
- **Bot Fight Mode — выключен.** Его нельзя отключить для отдельных адресов, а значит, он может резать вебхуки monobank.
- **Block AI bots / AI Scrapers and Crawlers — выключено.** Свой список у нас в коде, а AI-поиск мы пускаем.
- **Managed robots.txt — выключено**, если предложат: robots.txt у нас свой.

### 6. Правила: Security → WAF → Custom rules
Бесплатно доступно пять правил. Нужны два:
1. **«monobank»** — пропускать проверки для оплаты.
   - Условие (Edit expression): `starts_with(http.request.uri.path, "/api/billing/")`.
   - Действие **Skip**: отметить всё, что предложит (All remaining custom rules, Rate limiting rules, Security Level, Browser Integrity Check).
   - Правило должно стоять **первым**.
2. **«Поддельные поисковики»** — блокировать ботов, которые называют себя Google или Bing, но ими не являются.
   - Условие: `(http.user_agent contains "Googlebot" or http.user_agent contains "bingbot") and not cf.client.bot`.
   - Действие **Block**.

### 7. Лимит частоты: Security → WAF → Rate limiting rules
На бесплатном тарифе одно правило: счёт по IP, окно 10 секунд, блок на 10 секунд.
- **Условие:** путь не содержит `/_next/` (статика и картинки, их много на каждой странице), не начинается с `/api/billing/` и запрос не от проверенного бота (Verified Bot = off, чтобы не резать Google).
  - Выражение: `not http.request.uri.path contains "/_next/" and not starts_with(http.request.uri.path, "/api/billing/") and not cf.client.bot`.
  - Если редактор не примет какую-то часть, напишите разработчику: на бесплатном тарифе набор полей урезан.
- **Порог:** 60 запросов за 10 секунд с одного IP → **Block** на 10 секунд. Человек столько не делает, скрипт — делает.

### 8. Кеш картинок: Caching → Cache Rules
Правило **«Картинки Next»**:
- условие: путь начинается с `/_next/image`;
- **Eligible for cache**;
- Edge TTL — по заголовкам сервера (Use cache-control header).

Сжатие картинок — самая тяжёлая работа сервера, а так каждая картинка жмётся один раз на весь мир. Статика `/_next/static` (js, css) кешируется и без правила.

### 9. Проверка
- `curl -sI https://goo-fashion.com | grep -i server` → `server: cloudflare`.
- Тестовая подписка в goo-studio проходит, оплата появляется в журнале транзакций. Это проверяет, что вебхук monobank доходит.
- `curl -sI -A "GPTBot" https://goo-fashion.com/` → `403`; `curl -s https://goo-fashion.com/robots.txt` — в конце группа ботов с `Disallow: /`.
- Задачи Coolify (`billing-sync`, `billing-renew`) ходят на localhost, Cloudflare их не касается.

## Когда атакуют
**Overview → Under Attack Mode** — все посетители проходят проверку браузера. Вебхуки monobank правило «monobank» пропускает. А если какой-то и потеряется, ежечасная `billing-sync` догонит оплату сама. После атаки выключить.

## Если что-то сломалось
В DNS Cloudflare переключите облако у `goo-fashion.com` и `www` на **серое**. Через пару минут сайт работает как без Cloudflare, напрямую с сервера. Код к этому готов: без Cloudflare он ведёт себя как раньше.
