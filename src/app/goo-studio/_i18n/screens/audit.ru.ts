import type { Key, Message } from "../en";

/** Audit (GS4-12), in Russian: the same keys as audit.en.ts. */
export const auditRu: Partial<Record<Key, Message>> = {
  "audit.summary.findings": {
    one: "{count} замечание",
    few: "{count} замечания",
    many: "{count} замечаний",
    other: "{count} замечания",
  },
  "audit.summary.products": {
    one: "{count} товар в каталоге",
    few: "{count} товара в каталоге",
    many: "{count} товаров в каталоге",
    other: "{count} товара в каталоге",
  },
  "audit.checking": "Идёт проверка разметки каталога…",
  "audit.checkingShort": "Проверка…",
  "audit.recheck": "Перепроверить",
  "audit.dismissed.show": "Показать отклонённые",
  "audit.dismissed.showCount": "Показать отклонённые ({count})",
  "audit.dismissed.hide": "Скрыть отклонённые",
  "audit.dismissed.hint": "Отклонённые предложения. Показываются, чтобы отклонение можно было отменить.",
  "audit.help.label": "Как работает аудит",
  "audit.help.text":
    "Предложение — не приговор: если правило спорит с меткой, ошибаться может любая из сторон. С вещью, которая честно называется «Low Rise», будет спорить правило, выучившее «low» на кроссовках. Исправление подкатегории ставит и категорию: дерево и так знает, где место метки. После серии правок нажмите «Перепроверить», чтобы увидеть, что осталось. «Разобрать категории» в разделе «Товары» применяет ту же таблицу ключевых слов массово, но только к товарам без подкатегории.",

  "audit.loadFailed": "Не удалось провести аудит.",
  "audit.unreachable": "Не удалось связаться с сервером.",
  "audit.migrationMissing":
    "Отклонения не запоминаются, пока не выполнена миграция supabase/migrations/012_label_audit_dismissals.sql. Применять исправления можно и без неё.",
  "audit.dismissalsError": "Не удалось прочитать отклонённые предложения, поэтому они снова в списке: {error}",
  "audit.running": "Идут проверки…",
  "audit.empty.title": "Замечаний нет.",
  "audit.empty.text": "Все подкатегории есть в дереве, ни одна категория им не противоречит, и ни одно название не спорит со своей меткой.",

  "audit.section.about": "О проверке «{title}»",
  "audit.section.dismissedCount": "отклонено: {count}",
  "audit.exact": "Точная проверка",
  "audit.applyAll": "Применить все ({count})",
  "audit.fixing": "Исправление…",
  "audit.cut.open": "показано {shown} из {total}",
  "audit.cut.dismissed": "показано {shown} из {total} отклонённых",
  "audit.cut.tail": "{list} — разберите эти и перепроверьте, чтобы увидеть остальные.",
  "audit.check.colorNotColor.title": "Цвет, который не цвет",
  "audit.check.colorNotColor.note":
    "В поле цвета — размер или имя файла: строку размеров из образцов импорт принимает за выбранный цвет. «Применить» ставит вместо него расцветку из конца названия («Mia Jacket - Beige/White») или цвет, названный в имени, либо очищает поле.",
  "audit.check.subcategoryGone.title": "Подкатегории больше нет",
  "audit.check.subcategoryGone.note":
    "Такой метки нет в дереве категорий — обычно она остаётся после правки в разделе «Категории». Выберите новую в редакторе товара.",
  "audit.check.categoryContradicts.title": "Категория противоречит подкатегории",
  "audit.check.categoryContradicts.note": "По дереву эта подкатегория относится к другой категории. Это ошибка по определению, а не догадка.",
  "audit.check.wrongGroup.title": "Название говорит о другой вещи",
  "audit.check.wrongGroup.note":
    "Футболка среди часов или в трикотаже. Категория и подкатегория между собой согласны, поэтому проверки ниже молчат — выдаёт товар только его название. Менять нужно подкатегорию: исправьте её в редакторе товара, и категория изменится следом.",
  "audit.check.nameNamesSubcategory.title": "В названии — другая подкатегория",
  "audit.check.nameNamesSubcategory.note":
    "Название говорит одно, метка — другое: вещь «T-Shirt» записана в Hoodies. Обе могут быть в одной категории, поэтому другие проверки этого не замечают. Если в названии упомянуты две, побеждает более точная: «Long Sleeve T-Shirt» читается как Long Sleeves. «Применить» заодно ставит подходящую категорию.",
  "audit.check.siblingsDisagree.title": "Записан не так, как почти такие же товары",
  "audit.check.siblingsDisagree.note":
    "Каталог спорит сам с собой: название этой вещи совпадает с фразой, которую почти всегда записывают иначе.",
  "audit.check.categoryDisputed.title": "Название оспаривает категорию",
  "audit.check.categoryDisputed.note":
    "Название товара указывает на другую категорию. Если сходятся два механизма, стоит пометка ×2 — такие лучше смотреть первыми.",
  "audit.check.subcategoryDisputed.title": "Название оспаривает подкатегорию",
  "audit.check.subcategoryDisputed.note": "«Применить» заодно ставит подходящую категорию: дерево и так знает, где место этой метки.",
  "audit.check.genderDisputed.title": "Название оспаривает пол",
  "audit.check.genderDisputed.note": "В названии или описании указан другой пол.",
  "audit.check.colorGroupMissing.title": "Возможно, нет цветового фильтра",
  "audit.check.colorGroupMissing.note":
    "Цвет этой вещи надёжно относится к группе, которой у неё нет, поэтому фильтр по этому цвету может её не находить. «Применить» добавляет группу, ничего не убирая.",

  "audit.noName": "(без названия)",
  "audit.none": "(пусто)",
  "audit.field.category": "категория",
  "audit.field.subcategory": "подкатегория",
  "audit.field.gender": "пол",
  "audit.field.colorGroup": "цветовая группа",
  "audit.field.color": "цвет",
  "audit.apply": "Применить",
  "audit.editByHand": "Исправить вручную",
  "audit.dismiss": "Отклонить",
  "audit.dismissHint": "Предложение неверное — больше его не предлагать",
  "audit.restore": "Вернуть",
  "audit.restoreHint": "Снова предлагать это при следующих проверках",
  "audit.applied": "Применено",
  "audit.dismissed": "Отклонено",
  "audit.restored": "Возвращено",

  "audit.confirm.title": {
    one: "Применить {count} исправление в этом разделе?",
    few: "Применить {count} исправления в этом разделе?",
    many: "Применить {count} исправлений в этом разделе?",
    other: "Применить {count} исправления в этом разделе?",
  },
  "audit.confirm.body": "Каждый товар записывается отдельно.",
  "audit.confirm.action": {
    one: "Применить {count} исправление",
    few: "Применить {count} исправления",
    many: "Применить {count} исправлений",
    other: "Применить {count} исправления",
  },
  "audit.fixed": "Исправлено: {count}",
  "audit.fixedPartly": "Исправлено: {fixed}, не принято: {refused} — перепроверьте, чтобы узнать почему",
  "audit.applyFailed": "Не удалось применить.",
  "audit.dismissFailed": "Не удалось отклонить.",
  "audit.restoreFailed": "Не удалось вернуть.",
  "audit.needsMigration": "Для отклонений нужна миграция 012 — сначала выполните её в Supabase.",
  "audit.dismissedToast": "Отклонено — «{stored} → {suggested}» больше не будет предлагаться",
  "audit.restoredToast": "Возвращено — предложение снова появится при следующей проверке.",
};
