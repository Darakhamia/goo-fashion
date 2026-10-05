import type { Message } from "../en";

/** AI check (GS4-12). Keys start with "aicheck." unless shared with the core dictionary. */
export const catalogueCheckEn = {
  // Header and the "?" beside the title.
  "aicheck.help.label": "How AI check works",
  "aicheck.help.p1":
    "The model sees each product record as it is stored (name, brand, category, gender, colors, material, sizes, description, price and store links) next to the catalog's brand spellings and category tree. It cannot write to the database: it answers, and the server writes only what the record itself backs.",
  "aicheck.help.p2":
    "A brand must be named in the record or already be one of ours; a color or a material must be named in its text; a name, description or size list can only lose words. Prices are never changed, only flagged.",
  "aicheck.summary.checked": { one: "{checked} of {count} product checked", other: "{checked} of {count} products checked" },
  "aicheck.summary.waiting": "{count} waiting for you",
  "aicheck.summary.spent": "{amount} spent this month",
  "aicheck.refresh": "Refresh",

  // Failures. The server's own message wins when it sends one.
  "aicheck.loadFailed": "Could not load the AI check.",
  "aicheck.unreachable": "Could not reach the server.",
  "aicheck.requestFailed": "Request failed ({status}).",
  "aicheck.saveFailed": "Could not save.",
  "aicheck.undoFailed": "Could not undo.",
  "aicheck.runFailed": "The run stopped.",

  // What keeps the check from running, in the page's attention list.
  "aicheck.attn.migration.title": "AI check is off: its database tables are missing",
  "aicheck.attn.migration.text": "Until the migration runs, the check has nowhere to record what it changes, so it does not run at all.",
  "aicheck.attn.noKey.title": "No OpenAI key",
  "aicheck.attn.noKey.text": "The check uses the same key as the parser. Add one in Settings or set OPENAI_API_KEY.",
  "aicheck.attn.paused.title": "The background check is paused until {when}",
  "aicheck.attn.paused.cap": "It has spent its monthly cap ({spent} of {cap}). Raise the cap below or run it from this page.",
  "aicheck.attn.paused.error": "It could not reach the model. Runs from this page still work.",

  // Checking the catalog.
  "aicheck.run.title": "Check the catalog",
  "aicheck.run.text": "New products are checked after every import. Here you run it over the whole catalog.",
  "aicheck.run.pct": "{pct}%",
  "aicheck.run.progress": { one: "{checked} of {count} product checked", other: "{checked} of {count} products checked" },
  "aicheck.run.never": "{count} never checked",
  "aicheck.run.progressLabel": "Products checked",
  "aicheck.run.unchecked": "Check {count} unchecked · ~{cost}",
  "aicheck.run.brands": "Unify brand spellings",
  "aicheck.run.brandsHint": "Find one brand spelled several ways and unify it",
  "aicheck.run.changed": "Re-check changed",
  "aicheck.run.changedHint": "Products edited or re-collected since their last check",
  "aicheck.run.all": "Re-check everything · ~{cost}",
  "aicheck.run.note": "A product goes back to the model only when it has changed since its last check.",
  "aicheck.run.last": { one: "Last run {when} · {kind} · {count} product.", other: "Last run {when} · {kind} · {count} products." },
  "aicheck.confirm.all": { one: "Re-check all {count} product?", other: "Re-check all {count} products?" },
  "aicheck.confirm.allBody": "Estimated cost about {cost}. Fixes you undid or dismissed are not made again.",
  "aicheck.confirm.allAction": { one: "Re-check {count} product", other: "Re-check {count} products" },

  // A run in progress, and what it did.
  "aicheck.job.unchecked": "Checking unchecked products…",
  "aicheck.job.changed": "Re-checking changed products…",
  "aicheck.job.all": "Re-checking every product…",
  "aicheck.job.brands": "Reviewing brand spellings…",
  "aicheck.job.last": "Last run:",
  "aicheck.progress.brands": {
    one: "{brands} brand values · {count} product fixed · {suggested} waiting · {cost}",
    other: "{brands} brand values · {count} products fixed · {suggested} waiting · {cost}",
  },
  "aicheck.progress.records": "{checked} checked · {applied} fixed · {suggested} waiting · {failed} not answered · {cost}",
  "aicheck.note.merge": { one: "{from} → {to} · {count} product · {state}", other: "{from} → {to} · {count} products · {state}" },
  "aicheck.note.fixed": "fixed",
  "aicheck.note.waiting": "waiting for you",
  "aicheck.note.notBrand": {
    one: "“{value}” is not a brand · {count} product sent back to the record check",
    other: "“{value}” is not a brand · {count} products sent back to the record check",
  },
  "aicheck.line.failed": "not answered, stays unchecked",
  "aicheck.line.fixed": "fixed {fields}",
  "aicheck.line.forYou": "for you: {fields}",
  "aicheck.stop": "Stop",
  "aicheck.stopped": "Stopped.",
  "aicheck.done": "Done.",
  "aicheck.noName": "(no name)",

  // The fields a fix can touch.
  "aicheck.field.brand": "Brand",
  "aicheck.field.name": "Name",
  "aicheck.field.category": "Category",
  "aicheck.field.subcategory": "Subcategory",
  "aicheck.field.gender": "Gender",
  "aicheck.field.colors": "Colors",
  "aicheck.field.color_filters": "Color filters",
  "aicheck.field.material": "Material",
  "aicheck.field.sizes": "Sizes",
  "aicheck.field.description": "Description",
  "aicheck.field.price": "Price",

  // Settings.
  "aicheck.settings.title": "Settings",
  "aicheck.settings.mode": "After each import",
  "aicheck.mode.off": "Off",
  "aicheck.mode.offNote": "Nothing runs by itself. Runs from this page still fix what the record proves.",
  "aicheck.mode.suggest": "Suggest only",
  "aicheck.mode.suggestNote": "Nothing is written until you press Apply.",
  "aicheck.mode.auto": "Auto-fix",
  "aicheck.mode.autoNote": "Fixes the record proves are written at once; the rest wait here.",
  "aicheck.settings.model": "Model",
  "aicheck.settings.cap": "Monthly cap, background checks ($)",
  "aicheck.settings.spend": "Background checks spent {spent} of {cap} this month. Runs from this page are not capped; the estimate is on each button.",
  "aicheck.settings.rules": "House rules for the model",
  "aicheck.settings.rulesPlaceholder": "e.g. Carhartt WIP and Carhartt are one brand: use “Carhartt WIP”.\nNames are in English title case.",
  "aicheck.settings.save": "Save settings",
  "aicheck.settings.saved": "Settings saved.",

  // Waiting for a person.
  "aicheck.waiting.title": "Waiting for you",
  "aicheck.waiting.applyAll": "Apply all {count}…",
  "aicheck.waiting.empty": "Nothing waiting. Fixes the check was unsure about land here.",
  "aicheck.confirm.applyAll": { one: "Apply the {count} suggestion shown?", other: "Apply all {count} suggestions shown?" },
  "aicheck.confirm.applyAllBody": "Each is checked against the product first.",
  "aicheck.confirm.applyAllAction": { one: "Apply {count} fix", other: "Apply {count} fixes" },

  // One fix, or one brand merge across many products.
  "aicheck.fix.group": { one: "{count} product by “{brand}”", other: "{count} products by “{brand}”" },
  "aicheck.fix.sure": "Sure",
  "aicheck.fix.none": "(none)",
  "aicheck.fix.apply": "Apply",
  "aicheck.fix.applyN": "Apply {count}",
  "aicheck.fix.edit": "Edit by hand",
  "aicheck.fix.dismiss": "Dismiss",
  "aicheck.fix.dismissHint": "This is wrong: never propose it again",
  "aicheck.fix.undo": "Undo",
  "aicheck.fix.undoN": "Undo {count}",
  "aicheck.fix.undoHint": "Put the old value back",
  "aicheck.decided.apply": { one: "Applied {count} fix.", other: "Applied {count} fixes." },
  "aicheck.decided.dismiss": { one: "Dismissed {count} fix.", other: "Dismissed {count} fixes." },
  "aicheck.decided.undo": { one: "Undid {count} fix.", other: "Undid {count} fixes." },
  "aicheck.decided.stale": {
    one: "{count} product changed since the check: edit it by hand.",
    other: "{count} products changed since the check: edit them by hand.",
  },

  // Fixed by the check. The stand waits for this title.
  "aicheck.fixed.title": "Fixed by the check",
  "aicheck.fixed.text": {
    one: "The latest fix. Undo puts the old value back if nobody edited the product since; an undone fix is never made again.",
    other: "The latest {count} fixes. Undo puts the old value back if nobody edited the product since; an undone fix is never made again.",
  },
  "aicheck.fixed.empty": "No fixes yet.",

  // Runs.
  "aicheck.runs.title": "Runs",
  "aicheck.runs.col.started": "Started",
  "aicheck.runs.col.kind": "Kind",
  "aicheck.runs.col.model": "Model",
  "aicheck.runs.col.products": "Products",
  "aicheck.runs.col.fixed": "Fixed",
  "aicheck.runs.col.forYou": "For you",
  "aicheck.runs.col.cost": "Cost",
  "aicheck.runs.card": {
    one: "{count} product · {fixed} fixed · {forYou} for you · {cost}",
    other: "{count} products · {fixed} fixed · {forYou} for you · {cost}",
  },
  "aicheck.kind.auto": "After import",
  "aicheck.kind.brands": "Brand spellings",
  "aicheck.kind.manual": "Manual",
  "aicheck.runs.undo": { one: "Undo its {count} fix…", other: "Undo its {count} fixes…" },
  "aicheck.confirm.undoRun": { one: "Undo the {count} fix this run made?", other: "Undo the {count} fixes this run made?" },
  "aicheck.confirm.undoRunBody": "Products edited since are left as they are.",
  "aicheck.confirm.undoRunAction": { one: "Undo {count} fix", other: "Undo {count} fixes" },
  "aicheck.undoRun.stale": {
    one: "{count} changed since and is left as it is.",
    other: "{count} changed since and are left as they are.",
  },
} as const satisfies Record<string, Message>;
