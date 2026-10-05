import type { Message } from "../en";

/** Audit (GS4-12). Keys start with "audit." unless shared with the core dictionary. */
export const auditEn = {
  // The head.
  "audit.summary.findings": { one: "{count} thing worth a second look", other: "{count} things worth a second look" },
  "audit.summary.products": { one: "{count} product in the catalog", other: "{count} products in the catalog" },
  "audit.checking": "Checking the catalog's labeling…",
  "audit.checkingShort": "Checking…",
  "audit.recheck": "Re-check",
  "audit.dismissed.show": "Show dismissed",
  "audit.dismissed.showCount": "Show dismissed ({count})",
  "audit.dismissed.hide": "Hide dismissed",
  "audit.dismissed.hint": "Suggestions you rejected. Shown so a dismissal can be undone.",
  "audit.help.label": "How the audit works",
  "audit.help.text":
    "A suggestion is not a verdict: where a rule disagrees with a label, either one of them can be the wrong one — a piece genuinely called “Low Rise” will be argued at by a rule that learned “low” from sneakers. Fixing a subcategory sets the category with it, since the tree already says where the label belongs. Re-check after a run of edits to see what is left. “Fix categories” on Products applies the same keyword table in bulk, but only to products with no subcategory.",

  // Notices and states.
  "audit.loadFailed": "Could not run the audit.",
  "audit.unreachable": "Could not reach the server.",
  "audit.migrationMissing":
    "Dismiss cannot be remembered until supabase/migrations/012_label_audit_dismissals.sql is run. Applying works without it.",
  "audit.dismissalsError": "Could not read the dismissed suggestions, so ones you dismissed are listed again: {error}",
  "audit.running": "Running the checks…",
  "audit.empty.title": "Nothing to flag.",
  "audit.empty.text": "Every subcategory sits in the tree, no category contradicts one, and no name argues with its label.",

  // A section: its title row, what the check is, and the cut at the bottom.
  "audit.section.about": "About “{title}”",
  "audit.section.dismissedCount": "{count} dismissed",
  "audit.exact": "Exact",
  "audit.applyAll": "Apply all {count}",
  "audit.fixing": "Fixing…",
  "audit.cut.open": "showing {shown} of {total}",
  "audit.cut.dismissed": "showing {shown} of {total} dismissed",
  "audit.cut.tail": "{list} — work through these and re-check to see the rest.",
  "audit.check.colorNotColor.title": "Color that is not a color",
  "audit.check.colorNotColor.note":
    "The color label is a size or a file name — a size row built from swatches reads to the importer like the picked color. Applying replaces it with the colorway the name ends with (“Mia Jacket - Beige/White”), or the color the name mentions, or clears it.",
  "audit.check.subcategoryGone.title": "Subcategory that no longer exists",
  "audit.check.subcategoryGone.note":
    "The label is not in the category tree at all — usually left behind by an edit under Categories. Pick a new one in the product editor.",
  "audit.check.categoryContradicts.title": "Category contradicts the subcategory",
  "audit.check.categoryContradicts.note":
    "The tree files this subcategory under a different category. Wrong by definition, not by guesswork.",
  "audit.check.wrongGroup.title": "The name says a different kind of thing",
  "audit.check.wrongGroup.note":
    "A t-shirt among the watches, or filed as knitwear. Its category and subcategory agree with each other, so the checks below stay quiet about it — only its own name gives it away. The subcategory is what has to change, so fix it in the product editor and the category will follow.",
  "audit.check.nameNamesSubcategory.title": "The name names a different subcategory",
  "audit.check.nameNamesSubcategory.note":
    "The name says one thing and the label says another — a piece called “T-Shirt” filed as Hoodies. Both may sit in the same category, which is why nothing else notices. Where a name mentions two, the more specific one wins, so a “Long Sleeve T-Shirt” is read as Long Sleeves. Applying sets the category to match.",
  "audit.check.siblingsDisagree.title": "Filed differently from its near-identical siblings",
  "audit.check.siblingsDisagree.note":
    "The catalog disagreeing with itself: this piece's name matches a phrase that is filed the other way almost every time.",
  "audit.check.categoryDisputed.title": "Category disputed by the name",
  "audit.check.categoryDisputed.note":
    "The product's own name argues for a different category. Two mechanisms agreeing is marked ×2 and is worth looking at first.",
  "audit.check.subcategoryDisputed.title": "Subcategory disputed by the name",
  "audit.check.subcategoryDisputed.note": "Applying this sets the category to match, since the tree already says where the label belongs.",
  "audit.check.genderDisputed.title": "Gender disputed by the name",
  "audit.check.genderDisputed.note": "The name or description names a different gender.",
  "audit.check.colorGroupMissing.title": "Color filter possibly missing",
  "audit.check.colorGroupMissing.note":
    "A color this piece has is reliably filed under a group it does not carry, so it may be invisible to that color filter. Applying adds the group without removing any.",

  // A finding.
  "audit.noName": "(no name)",
  "audit.none": "(none)",
  "audit.field.category": "category",
  "audit.field.subcategory": "subcategory",
  "audit.field.gender": "gender",
  "audit.field.colorGroup": "color group",
  "audit.field.color": "color",
  "audit.apply": "Apply",
  "audit.editByHand": "Edit by hand",
  "audit.dismiss": "Dismiss",
  "audit.dismissHint": "This suggestion is wrong — stop raising it",
  "audit.restore": "Restore",
  "audit.restoreHint": "Raise this again on future checks",
  "audit.applied": "Applied",
  "audit.dismissed": "Dismissed",
  "audit.restored": "Restored",

  // Confirms, toasts and errors.
  "audit.confirm.title": { one: "Apply {count} fix in this section?", other: "Apply {count} fixes in this section?" },
  "audit.confirm.body": "Each product is written separately.",
  "audit.confirm.action": { one: "Apply {count} fix", other: "Apply {count} fixes" },
  "audit.fixed": "Fixed {count}",
  "audit.fixedPartly": "Fixed {fixed}; {refused} refused — re-check to see why",
  "audit.applyFailed": "Could not apply.",
  "audit.dismissFailed": "Could not dismiss.",
  "audit.restoreFailed": "Could not restore.",
  "audit.needsMigration": "Dismissals need migration 012 — run it in Supabase first.",
  "audit.dismissedToast": "Dismissed — “{stored} → {suggested}” won't be raised again",
  "audit.restoredToast": "Restored — it will be raised again on the next check.",
} as const satisfies Record<string, Message>;
