import type { Message } from "../en";

/** Duplicates (GS4-12). Keys start with "dupes." unless shared with the core dictionary. */
export const duplicatesEn = {
  // Header, the numbers under it, and the one "?" of the page.
  "dupes.summary.items": { one: "{count} item held as {cards} cards", other: "{count} items held as {cards} cards" },
  "dupes.summary.scanned": { one: "{count} product scanned", other: "{count} products scanned" },
  "dupes.summary.mixed": { one: "{count} group mixes different models", other: "{count} groups mix different models" },
  "dupes.summary.colourways": { one: "{count} model shown as separate cards", other: "{count} models shown as separate cards" },
  "dupes.rescan": "Re-scan",
  "dupes.scanning": "Scanning…",
  "dupes.scanningCatalog": "Scanning the catalog…",
  "dupes.help.label": "How duplicates are found",
  "dupes.help.found":
    "Two cards are proposed when they share a barcode or maker's code, or when they are the same model of one brand in the same colors, sold by different stores at any price: the test a collect run uses before it adds a second store to a card. A model made in two similar colorways at one store is left out, since there is no telling which one the other store sells.",
  "dupes.help.merge":
    "Merging moves every store and price onto the kept card, fills its empty fields, moves likes, outfits and looks over to it, and deletes the others.",
  "dupes.help.mixed":
    "A color group mixing different models holds cards shown as colors of one product that are not one model, usually a store's “you may also like” rail read as its color row. Choose the model that belongs, then split the rest out: the kept model stays in the group, each other model gets a group of its own, and a lone card leaves grouping. Nothing is deleted.",
  "dupes.help.colourways":
    "One model's colors shown as separate cards: the same piece of one brand in different colors, held as separate cards or separate color groups, usually collected from different stores, under another spelling of the brand or at another price. Grouping shows them as one product with a swatch per color, each color keeping its own price and stores. A card already in a color group brings the rest of its group. Nothing is deleted.",

  // Failures. The server's own message wins when it sends one.
  "dupes.loadFailed": "Could not load duplicates ({status}).",
  "dupes.failed": "Request failed ({status}).",
  "dupes.unreachable": "Could not reach the server.",
  "dupes.attn.dismissals.title": "“Not the same” is not remembered yet",
  "dupes.attn.dismissals.text": "Until the migration runs, a dismissed proposal comes back on the next scan. Merging and grouping work without it.",

  // The two tabs.
  "dupes.tabs": "Duplicates views",
  "dupes.tab.duplicates": "Duplicates",
  "dupes.tab.colors": "Color groups",
  "dupes.openTab": "Open tab",
  "dupes.empty": "No duplicates found. No two cards share a barcode, or the same model in the same colors from different stores.",
  "dupes.colors.empty": "No color groups to fix.",

  // One item held as several cards.
  "dupes.group.cards": { one: "the same item held as {count} card", other: "the same item held as {count} cards" },
  "dupes.reason.gtin": "Same barcode",
  "dupes.reason.mpn": "Same maker's code",
  "dupes.reason.name": "Same model and colors",
  "dupes.group.whichStays": "Which card stays?",
  "dupes.kept": "Kept",
  "dupes.official": "Official",
  "dupes.noColor": "no color",
  "dupes.noStore": "no store",
  "dupes.added": "added {date}",
  "dupes.keepThis": "Keep this one",
  "dupes.keepAria": "Keep {name} ({store})",
  "dupes.mergeThis": "Merge into the kept card",
  "dupes.mergeAria": "Merge {name} ({store}) into the kept card",
  "dupes.notSame": "Not the same item",
  "dupes.notSameHint": "Remember every card in this group as a different item",
  "dupes.notSameSome": "Unticked aren't the same ({count})",
  "dupes.notSameSomeHint": "Remember the unticked cards as different from the ones kept together",
  "dupes.merge": { one: "Merge {count} into kept", other: "Merge {count} into kept" },
  "dupes.working": "Working…",
  "dupes.confirm.merge": { one: "Merge {count} card into “{name}”?", other: "Merge {count} cards into “{name}”?" },
  "dupes.confirm.mergeBody": "The merged cards are deleted. Their stores, prices, likes and looks move to the kept card.",
  "dupes.confirm.mergeAction": { one: "Merge {count} card", other: "Merge {count} cards" },
  "dupes.moved.likes": { one: "{count} like", other: "{count} likes" },
  "dupes.moved.outfits": { one: "{count} outfit", other: "{count} outfits" },
  "dupes.moved.looks": { one: "{count} look", other: "{count} looks" },
  "dupes.merged": { one: "Merged {count} card.", other: "Merged {count} cards." },
  "dupes.mergedMoved": { one: "Merged {count} card and moved {moved}.", other: "Merged {count} cards and moved {moved}." },
  "dupes.confirm.dismissSome": {
    one: "Remember this {count} card as a different item from the cards kept together?",
    other: "Remember these {count} cards as different items from the cards kept together?",
  },
  "dupes.confirm.dismissSomeBody": "They won't be proposed with those cards again. The rest of the group stays.",
  "dupes.confirm.dismissAll": "Remember every card here as a different item?",
  "dupes.confirm.dismissAllBody": "They won't be proposed together again, and this can't be undone from here.",
  "dupes.confirm.dismissAction": { one: "Mark {count} card as different", other: "Mark {count} cards as different" },
  "dupes.dismissed": "Marked as different items. They won't be suggested again.",
  "dupes.dismissedSome": {
    one: "Marked {count} card as different. It won't be suggested with the rest again.",
    other: "Marked {count} cards as different. They won't be suggested with the rest again.",
  },

  // A color group holding several models.
  "dupes.mixed.title": "Color groups mixing different models",
  "dupes.mixed.cardTitle": { one: "{brand} · one color group, {count} model", other: "{brand} · one color group, {count} different models" },
  "dupes.mixed.cards": { one: "{count} card shown as colors of one product", other: "{count} cards shown as colors of one product" },
  "dupes.keep": "Keep",
  "dupes.mixed.keepAria": "Keep {name} in this group",
  "dupes.split": "Split",
  "dupes.confirm.split": {
    one: "Take the other {count} model out of this color group?",
    other: "Take the other {count} models out of this color group?",
  },
  "dupes.confirm.splitBody": "“{name}” stays in this color group.",
  "dupes.confirm.splitAction": { one: "Split out {count} model", other: "Split out {count} models" },
  "dupes.splitDone": { one: "Split: {count} card moved out of the group.", other: "Split: {count} cards moved out of the group." },

  // One model's colors held as separate cards.
  "dupes.cw.title": "One model's colors shown as separate cards",
  "dupes.cw.cards": { one: "{count} card", other: "{count} cards" },
  "dupes.cw.shownFirst": "Shown first",
  "dupes.cw.alreadyGrouped": "already grouped with {count}",
  "dupes.cw.notOne": "Not one model",
  "dupes.cw.notOneHint": "Remember these cards as different models",
  "dupes.cw.group": "Group as colors",
  "dupes.cw.groupAll": "Group all ({count})",
  "dupes.cw.grouping": "Grouping {done}/{total}…",
  "dupes.cw.grouped": { one: "Grouped {count} card as colors of one product.", other: "Grouped {count} cards as colors of one product." },
  "dupes.confirm.groupAll": { one: "Group {count} as colors of one product?", other: "Group all {count} as colors of one product each?" },
  "dupes.confirm.groupAllBody": "Each becomes one card with a swatch per color. Nothing is deleted, and any group can be split again later.",
  "dupes.confirm.groupAllAction": { one: "Group {count}", other: "Group all {count}" },
  "dupes.cw.groupAllDone": { one: "Grouped the colors of {count} product.", other: "Grouped the colors of {count} products." },
  "dupes.cw.groupAllPartial": {
    one: "Grouped {grouped}; {count} could not be grouped. Re-scan and try again.",
    other: "Grouped {grouped}; {count} could not be grouped. Re-scan and try again.",
  },
  "dupes.confirm.cwDismiss": { one: "Remember this {count} card as a different model?", other: "Remember these {count} cards as different models?" },
  "dupes.confirm.cwDismissBody": "They won't be proposed as colors of one product again.",
  "dupes.confirm.cwDismissAction": { one: "Mark {count} card as a different model", other: "Mark {count} cards as different models" },
  "dupes.cw.dismissed": "Marked as different models. They won't be suggested again.",
} as const satisfies Record<string, Message>;
