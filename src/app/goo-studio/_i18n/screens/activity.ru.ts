import type { Key, Message } from "../en";

/** Activity (GS4-12), in Russian: the same keys as activity.en.ts. */
export const activityRu: Partial<Record<Key, Message>> = {
  "activity.count": { one: "{count} действие", few: "{count} действия", many: "{count} действий", other: "{count} действия" },
  "activity.admins": { one: "{count} админ", few: "{count} админа", many: "{count} админов", other: "{count} админа" },
  "activity.refresh": "Обновить",
  "activity.denied": "Журнал действий виден только супер-админу.",
  "activity.loadFailed": "Не удалось загрузить журнал.",

  // Filters
  "activity.f.admin": "Админ",
  "activity.f.type": "Тип",
  "activity.allAdmins": "Все админы",
  "activity.allTypes": "Все типы",

  // The log, by day
  "activity.today": "Сегодня",
  "activity.yesterday": "Вчера",
  "activity.loadMore": "Показать ещё",
  "activity.empty.none": "Действий пока нет. Здесь появятся действия админов.",
  "activity.empty.filtered": "Под эти фильтры ничего не подходит.",
};
