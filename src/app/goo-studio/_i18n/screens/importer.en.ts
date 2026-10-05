import type { Message } from "../en";

/** Import (GS4-12). Keys start with "import." unless shared with the core dictionary. */
export const importerEn = {
  // Header and help
  "import.subtitle": "Add products in bulk from an affiliate feed (Awin and others)",
  "import.help.label": "How the import works",
  "import.help.intro":
    "Upload an affiliate product feed (Awin and others) to import products in bulk. The file is read in your browser; products are sent to the catalog in batches.",
  "import.help.existing":
    "A product already in the catalog only gets its price, stock, sizes and stores refreshed: its name, category, description, style tags and photos stay as edited. Prices are converted to USD.",
  "import.startOver": "Start over",

  // Steps
  "import.steps": "Import steps",
  "import.step.merchants": "1. Merchants",
  "import.step.preview": "2. Preview",
  "import.step.import": "3. Import",

  // Step 1: the file
  "import.upload.choose": "Choose a CSV file",
  "import.upload.drop": "Drop a CSV file here or click to browse",
  "import.upload.formats": ".csv or .csv.gz files",
  "import.upload.reading": "Reading the file…",
  "import.error.empty": "The file is empty",
  "import.error.headers": "Could not read the header row",
  "import.error.noRows": "The file has a header row but no products",
  "import.error.read": "Could not read the file: {error}",
  "import.error.readPlain": "Could not read the file",

  // The feed columns the import reads
  "import.columns.title": "Supported Awin feed columns",
  "import.columns.required": "required",
  "import.col.link": "affiliate link",
  "import.col.name": "name",
  "import.col.price": "price",
  "import.col.currencySymbol": "currency symbol (£€$…)",
  "import.col.currency": "ISO currency code (converted to USD)",
  "import.col.rrp": "original price (for the discount)",
  "import.col.image": "main image (Awin proxy)",
  "import.col.images": "more images",
  "import.col.category": "category and gender",
  "import.col.gender": "gender override",
  "import.col.sizes": "available sizes",
  "import.col.color": "color (otherwise the name’s “- Blue”)",
  "import.col.description": "product description",
  "import.col.material": "material / fabric",
  "import.col.brand": "brand",
  "import.col.store": "store",
  "import.col.stock": "sold-out rows only update stock",

  // Step 2: merchants
  "import.rows": { one: "{count} row", other: "{count} rows" },
  "import.merchants.detected": { one: "{count} merchant detected", other: "{count} merchants detected" },
  "import.merchants.hint": "Select the merchants to import from.",
  "import.merchants.unknown": "Unknown",
  "import.merchants.items": { one: "{count} item", other: "{count} items" },
  "import.merchants.validProducts": { one: "{count} valid product", other: "{count} valid products" },
  "import.merchants.unusable": "{count} out of stock or invalid",
  "import.merchants.none": "Select at least one merchant",
  "import.merchants.preview": { one: "Preview {count} product →", other: "Preview {count} products →" },
  "import.merchants.previewNone": "Preview →",
  "import.selectAll": "Select all",
  "import.clear": "Clear",

  // Counts on the merchants and the preview
  "import.count.valid": "{count} valid",
  "import.count.soldOut": "{count} sold out",
  "import.count.skipped": "{count} skipped",
  "import.count.selected": "{count} selected",

  // Step 3: preview
  "import.preview.label": "Preview",
  "import.preview.back": "← Merchants",
  "import.preview.import": { one: "Import {count} product", other: "Import {count} products" },
  "import.preview.importing": "Importing…",
  "import.preview.unnamed": "unnamed row",
  "import.preview.showAll": "Showing the first {limit} rows — show all {count} →",
  "import.th.product": "Product",
  "import.th.category": "Category",
  "import.th.gender": "Gender",
  "import.th.price": "Price",
  "import.th.sizes": "Sizes",
  "import.th.link": "Link",
  "import.th.status": "Status",
  "import.link.ok": "✓ link",
  "import.link.none": "no link",
  "import.gender.women": "Women",
  "import.gender.men": "Men",
  "import.gender.unisex": "Unisex",
  "import.status.ok": "OK",
  "import.status.soldOut": "Sold out",
  "import.status.soldOutHint": "Sold out: only updates the stock of a product already in the catalog, never creates one",
  "import.status.skip": "Skip",
  // Why a row cannot be imported (src/lib/csv-import.ts, mapCSVRow)
  "import.issue.missingName": "missing name",
  "import.issue.missingPrice": "missing price",
  "import.issue.badLink": "bad affiliate link",
  "import.issue.noLink": "no affiliate link",
  "import.issue.outOfStock": "out of stock",

  // What the import will do
  "import.plan.checking": "Checking the catalog… {done}/{total} links",
  "import.plan.create": "{count} will be created",
  "import.plan.update": "{count} will be updated",
  "import.plan.skip": "{count} sold out and not in the catalog — skipped",
  "import.plan.multiColor": "{count} in multi-color sets",
  "import.plan.products": { one: "{count} product", other: "{count} products" },
  "import.plan.checkFailed":
    "Could not check which products are already in the catalog: {error}. The import still updates what it finds, but the new / updated split is unknown.",
  "import.plan.unknownError": "unknown error",
  "import.plan.checkAgain": "Check again",

  // The run and its result
  "import.run.importing": "Importing {done}/{total}",
  "import.run.done": "Finished",
  "import.run.stopped": "Stopped",
  "import.run.created": "{count} new",
  "import.run.updated": "{count} updated",
  "import.run.merged": "{count} joined existing",
  "import.run.mergedHint": "Joined a product the catalog already has from another store",
  "import.run.skipped": "{count} skipped",
  "import.run.failed": "{count} failed",
  "import.run.stop": "Stop",
  "import.run.stoppedAfter": {
    one: "Stopped after {count} failed batch in a row.",
    other: "Stopped after {count} failed batches in a row.",
  },
  "import.run.stoppedEarly": "Stopped before the last batch.",
  "import.run.batchFailed": {
    one: "Batch {n} of {total} ({count} product, from “{name}”): {error}",
    other: "Batch {n} of {total} ({count} products, from “{name}”): {error}",
  },
  "import.run.timeout": "the server timed out",
  "import.run.http": "the server answered HTTP {status}",
  "import.run.network": "network error ({error})",
  "import.run.networkPlain": "network error",
  "import.run.partialHint":
    "The import may have gone through partially: a failed batch can have written some of its products first. Running the same file again is safe: products already imported are updated, not duplicated.",
  "import.run.viewProducts": "View products",
  "import.run.again": "Run again",
  "import.run.another": "Import another file",
} as const satisfies Record<string, Message>;
