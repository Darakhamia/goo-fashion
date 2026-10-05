import type { Key, Message } from "../en";

/** Blog (GS4-12), in Russian: the same keys as blog.en.ts. */
export const blogRu: Partial<Record<Key, Message>> = {
  // Loading the list
  "blog.loadFailedHttp": "Не удалось загрузить посты (HTTP {status}).",
  "blog.loadFailedShape": "Не удалось загрузить посты: неожиданный ответ сервера. Перезагрузите страницу.",

  // AI draft
  "blog.ai.subtitle.url": "Переписать статью, страницу бренда или коллекции",
  "blog.ai.subtitle.brief": "Анонс релиза от имени GOO",
  "blog.ai.source": "Источник черновика",
  "blog.ai.fromUrl": "По ссылке",
  "blog.ai.fromBrief": "По брифу",
  "blog.ai.url": "Ссылка",
  "blog.ai.urlPlaceholder": "https://vogue.com/article/...",
  "blog.ai.brief": "Бриф",
  "blog.ai.briefPlaceholder":
    "Вышел новый конструктор образов: перетаскивание, до 6 вещей в образе, сохранение в профиль.\n\nТеперь работает и на телефоне.",
  "blog.ai.briefHint": "Хватит нескольких строк. В посте будет только то, что написано здесь: ничего не выдумывается.",
  "blog.ai.working.url": "Статья читается и превращается в пост. Это около 10 секунд…",
  "blog.ai.working.brief": "Пост пишется. Это около 10 секунд…",
  "blog.ai.generate": "Написать пост",
  "blog.ai.generating": "Пишется…",
  "blog.ai.failed": "Не удалось написать пост.",

  // Post editor
  "blog.editor.edit": "Изменить пост",
  // A URL is Latin only (slugify drops everything else), so the sample stays Latin.
  "blog.editor.slugFallback": "your-post-slug",
  "blog.editor.title": "Заголовок",
  "blog.editor.titlePlaceholder": "Заголовок поста",
  "blog.editor.titleRequired": "Нужен заголовок.",
  "blog.editor.slugFailed": "Не удалось составить адрес из заголовка. Задайте его вручную.",
  "blog.editor.cover": "Ссылка на обложку",
  "blog.editor.urlPlaceholder": "https://...",
  "blog.editor.coverAlt": "Превью обложки",
  "blog.editor.excerpt": "Анонс",
  "blog.editor.excerptHint": "(коротко о посте)",
  "blog.editor.excerptPlaceholder": "Одно-два предложения о том, что в посте.",
  "blog.editor.body": "Текст статьи",
  "blog.editor.bodyHint": "Подойдёт обычный текст. HTML тоже работает.",
  "blog.editor.bodyPlaceholder":
    "Текст статьи пишется здесь.\n\nМежду абзацами — пустая строка.\n\nДля заголовков и ссылок — HTML: <h2>Заголовок</h2> или <a href=\"...\">ссылка</a>.",
  "blog.editor.readTimeEstimate": "Время чтения ≈ {time}",
  "blog.editor.publishedHint": "Виден всем на /blog.",
  "blog.editor.draftHint": "Скрыт с сайта.",
  "blog.editor.advanced": "Дополнительно",
  "blog.editor.slug": "Адрес (slug)",
  "blog.editor.slugPlaceholder": "post-slug",
  "blog.editor.autoFromTitle": "(из заголовка)",
  "blog.editor.auto": "(автоматически)",
  "blog.editor.manual": "(вручную)",
  "blog.editor.category": "Рубрика",
  "blog.editor.categoryPlaceholder": "например, Style Guide",
  "blog.editor.readTime": "Время чтения",
  // Stored as written and shown on the English site, so the sample keeps its format.
  "blog.editor.readTimePlaceholder": "5 min",
  "blog.editor.author": "Автор",
  "blog.editor.publishDate": "Дата публикации вручную",
  "blog.editor.seo": "Настройки SEO",
  "blog.editor.optional": "(необязательно)",
  "blog.editor.metaTitle": "Meta title",
  "blog.editor.metaTitlePlaceholder": "{title} — GOO Journal",
  "blog.editor.metaDescription": "Meta description",
  "blog.editor.metaDescriptionPlaceholder": "По умолчанию — анонс. Не длиннее 160 знаков.",
  "blog.editor.ogImage": "Картинка Open Graph (ссылка)",
  "blog.editor.ogImagePlaceholder": "По умолчанию — обложка.",
  "blog.editor.saveChanges": "Сохранить изменения",
  "blog.editor.publish": "Опубликовать",
  "blog.editor.saveDraft": "Сохранить черновик",
  "blog.editor.saveFailed": "Не удалось сохранить пост.",
};
