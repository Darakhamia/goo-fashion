import type { Key, Message } from "../en";

/** Import (GS4-12), in Russian: the same keys as importer.en.ts. */
export const importerRu: Partial<Record<Key, Message>> = {
  // Header and help
  "import.subtitle": "Товары пачкой из партнёрского фида (Awin и другие)",
  "import.help.label": "Как работает импорт",
  "import.help.intro":
    "Загрузите партнёрский фид товаров (Awin и другие), чтобы импортировать товары пачкой. Файл читается в браузере, товары уходят в каталог пакетами.",
  "import.help.existing":
    "У товара, который уже есть в каталоге, обновляются только цена, наличие, размеры и магазины: название, категория, описание, теги стиля и фото остаются такими, как их отредактировали. Цены переводятся в доллары США.",
  "import.startOver": "Начать заново",

  // Steps
  "import.steps": "Шаги импорта",
  "import.step.merchants": "1. Магазины",
  "import.step.preview": "2. Предпросмотр",
  "import.step.import": "3. Импорт",

  // Step 1: the file
  "import.upload.choose": "Выбрать CSV-файл",
  "import.upload.drop": "Перетащите CSV-файл сюда или нажмите, чтобы выбрать",
  "import.upload.formats": "Файлы .csv или .csv.gz",
  "import.upload.reading": "Чтение файла…",
  "import.error.empty": "Файл пустой",
  "import.error.headers": "Не удалось прочитать строку заголовков",
  "import.error.noRows": "В файле есть заголовки, но нет товаров",
  "import.error.read": "Не удалось прочитать файл: {error}",
  "import.error.readPlain": "Не удалось прочитать файл",

  // The feed columns the import reads
  "import.columns.title": "Поддерживаемые колонки фида Awin",
  "import.columns.required": "обязательно",
  "import.col.link": "партнёрская ссылка",
  "import.col.name": "название",
  "import.col.price": "цена",
  "import.col.currencySymbol": "символ валюты (£€$…)",
  "import.col.currency": "код валюты ISO (переводится в USD)",
  "import.col.rrp": "исходная цена (для скидки)",
  "import.col.image": "главное фото (прокси Awin)",
  "import.col.images": "дополнительные фото",
  "import.col.category": "категория и пол",
  "import.col.gender": "пол (заменяет пол из категории)",
  "import.col.sizes": "доступные размеры",
  "import.col.color": "цвет (иначе из названия: «- Blue»)",
  "import.col.description": "описание товара",
  "import.col.material": "материал / ткань",
  "import.col.brand": "бренд",
  "import.col.store": "магазин",
  "import.col.stock": "строки без наличия только обновляют наличие",

  // Step 2: merchants
  "import.rows": { one: "{count} строка", few: "{count} строки", many: "{count} строк", other: "{count} строки" },
  "import.merchants.detected": {
    one: "найден {count} магазин",
    few: "найдено {count} магазина",
    many: "найдено {count} магазинов",
    other: "найдено {count} магазина",
  },
  "import.merchants.hint": "Выберите магазины, из которых импортировать товары.",
  "import.merchants.unknown": "Не указан",
  "import.merchants.items": { one: "{count} позиция", few: "{count} позиции", many: "{count} позиций", other: "{count} позиции" },
  "import.merchants.validProducts": {
    one: "{count} годный товар",
    few: "{count} годных товара",
    many: "{count} годных товаров",
    other: "{count} годного товара",
  },
  "import.merchants.unusable": "нет в наличии или с ошибкой: {count}",
  "import.merchants.none": "Выберите хотя бы один магазин",
  "import.merchants.preview": {
    one: "Предпросмотр: {count} товар →",
    few: "Предпросмотр: {count} товара →",
    many: "Предпросмотр: {count} товаров →",
    other: "Предпросмотр: {count} товара →",
  },
  "import.merchants.previewNone": "Предпросмотр →",
  "import.selectAll": "Выбрать все",
  "import.clear": "Снять выбор",

  // Counts on the merchants and the preview
  "import.count.valid": "годных: {count}",
  "import.count.soldOut": "нет в наличии: {count}",
  "import.count.skipped": "не подходят: {count}",
  "import.count.selected": "выбрано: {count}",

  // Step 3: preview
  "import.preview.label": "Предпросмотр",
  "import.preview.back": "← Магазины",
  "import.preview.import": {
    one: "Импортировать {count} товар",
    few: "Импортировать {count} товара",
    many: "Импортировать {count} товаров",
    other: "Импортировать {count} товара",
  },
  "import.preview.importing": "Импорт…",
  "import.preview.unnamed": "строка без названия",
  "import.preview.showAll": "Показаны первые {limit} строк — показать все {count} →",
  "import.th.product": "Товар",
  "import.th.category": "Категория",
  "import.th.gender": "Пол",
  "import.th.price": "Цена",
  "import.th.sizes": "Размеры",
  "import.th.link": "Ссылка",
  "import.th.status": "Статус",
  "import.link.ok": "✓ ссылка",
  "import.link.none": "нет ссылки",
  "import.gender.women": "Женское",
  "import.gender.men": "Мужское",
  "import.gender.unisex": "Унисекс",
  "import.status.ok": "OK",
  "import.status.soldOut": "Нет в наличии",
  "import.status.soldOutHint": "Нет в наличии: только обновит наличие товара, который уже есть в каталоге, новый не создаст",
  "import.status.skip": "Пропуск",
  // Why a row cannot be imported (src/lib/csv-import.ts, mapCSVRow)
  "import.issue.missingName": "нет названия",
  "import.issue.missingPrice": "нет цены",
  "import.issue.badLink": "неверная партнёрская ссылка",
  "import.issue.noLink": "нет партнёрской ссылки",
  "import.issue.outOfStock": "нет в наличии",

  // What the import will do
  "import.plan.checking": "Сверка с каталогом… ссылки: {done}/{total}",
  "import.plan.create": "будет создано: {count}",
  "import.plan.update": "будет обновлено: {count}",
  "import.plan.skip": "будет пропущено: {count} — нет в наличии и нет в каталоге",
  "import.plan.multiColor": "в наборах из нескольких цветов: {count}",
  "import.plan.products": { one: "{count} товар", few: "{count} товара", many: "{count} товаров", other: "{count} товара" },
  "import.plan.checkFailed":
    "Не удалось проверить, какие товары уже есть в каталоге: {error}. Импорт всё равно обновит то, что найдёт, но сколько товаров будет новых, а сколько обновлённых, неизвестно.",
  "import.plan.unknownError": "неизвестная ошибка",
  "import.plan.checkAgain": "Проверить снова",

  // The run and its result
  "import.run.importing": "Импорт {done}/{total}",
  "import.run.done": "Готово",
  "import.run.stopped": "Остановлено",
  "import.run.created": "новых: {count}",
  "import.run.updated": "обновлено: {count}",
  "import.run.merged": "присоединено к имеющимся: {count}",
  "import.run.mergedHint": "Добавлены к товару, который уже есть в каталоге, как ещё один магазин",
  "import.run.skipped": "пропущено: {count}",
  "import.run.failed": "с ошибкой: {count}",
  "import.run.stop": "Остановить",
  "import.run.stoppedAfter": {
    one: "Остановлено после {count} неудачного пакета подряд.",
    few: "Остановлено после {count} неудачных пакетов подряд.",
    many: "Остановлено после {count} неудачных пакетов подряд.",
    other: "Остановлено после {count} неудачного пакета подряд.",
  },
  "import.run.stoppedEarly": "Остановлено до последнего пакета.",
  "import.run.batchFailed": {
    one: "Пакет {n} из {total} ({count} товар, начиная с «{name}»): {error}",
    few: "Пакет {n} из {total} ({count} товара, начиная с «{name}»): {error}",
    many: "Пакет {n} из {total} ({count} товаров, начиная с «{name}»): {error}",
    other: "Пакет {n} из {total} ({count} товара, начиная с «{name}»): {error}",
  },
  "import.run.timeout": "сервер не ответил вовремя",
  "import.run.http": "сервер ответил HTTP {status}",
  "import.run.network": "ошибка сети ({error})",
  "import.run.networkPlain": "ошибка сети",
  "import.run.partialHint":
    "Импорт мог пройти частично: пакет с ошибкой мог успеть записать часть своих товаров. Запустить тот же файл ещё раз безопасно: уже импортированные товары обновятся, а не задвоятся.",
  "import.run.viewProducts": "Открыть товары",
  "import.run.again": "Запустить снова",
  "import.run.another": "Импортировать другой файл",
};
