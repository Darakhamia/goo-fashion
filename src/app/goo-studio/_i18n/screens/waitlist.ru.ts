import type { Key, Message } from "../en";

/** Waitlist (GS4-12), in Russian: the same keys as waitlist.en.ts. */
export const waitlistRu: Partial<Record<Key, Message>> = {
  "waitlist.title": "Лист ожидания",
  "waitlist.count": { one: "{count} адрес", few: "{count} адреса", many: "{count} адресов", other: "{count} адреса" },
  "waitlist.archive": "архив: форму записи убрали с сайта в сентябре 2026",
  "waitlist.loadFailedShort": "Не удалось загрузить список",
  "waitlist.loadFailed": "Не удалось загрузить лист ожидания: {error}",
  "waitlist.httpError": "Запрос не прошёл (HTTP {status}).",
  "waitlist.refresh": "Обновить",
  "waitlist.copyAll": "Скопировать все",
  "waitlist.copyHint": "Все адреса, по одному в строке, чтобы вставить в сервис рассылок",
  "waitlist.copied": {
    one: "Скопирован {count} адрес.",
    few: "Скопировано {count} адреса.",
    many: "Скопировано {count} адресов.",
    other: "Скопировано {count} адреса.",
  },
  "waitlist.copyFailed": "Не удалось скопировать: браузер не дал доступ к буферу обмена.",
  "waitlist.col.email": "Адрес",
  "waitlist.col.signedUp": "Дата записи",
  "waitlist.remove": "Убрать {email}",
  "waitlist.confirm.title": "Убрать {email} из листа ожидания?",
  "waitlist.confirm.body": "Это не отменить.",
  "waitlist.confirm.action": "Убрать адрес",
  "waitlist.removeFailed": "Не удалось убрать {email}: {error}",
  "waitlist.empty": "Лист ожидания пуст.",
};
