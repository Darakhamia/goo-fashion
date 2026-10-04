/**
 * The AI check's judgement of a model's answer — pure, no network, no database.
 *
 * The model reads a product record and says which fields are wrong and what
 * they should hold. Nothing it says is written as it said it. Every proposed
 * value has to pass two tests here first:
 *
 *   1. It is a value the field can hold: a subcategory that is in the tree, a
 *      gender out of three, a colour filter that exists, a colour that reads
 *      as a colour.
 *   2. The record itself backs it. A brand has to be spelled somewhere in the
 *      record (name, description, page address, store link) or be one the
 *      catalogue already carries; a colour or a material has to be named in
 *      the record's own text; a name, a description or a size list can only
 *      lose words, never gain them. A model that "knows" a product is a Nike
 *      cannot make it one unless the record says so.
 *
 * The record text comes from third-party store pages, so it can carry
 * anything, including text written to steer a model. That is why the answer
 * is checked against the record and the tree rather than trusted: whatever a
 * description manages to talk the model into, the only possible writes are
 * these fields, with these values.
 *
 * Prices are never changed. The model may flag one as implausible (a T-shirt
 * at $4,000 that was ₴4,000); that becomes a note for a person, with nothing to
 * apply.
 */
import { createHash } from "node:crypto";
import type { CategoryGroup } from "@/lib/categories";
import {
  colorGroupNamesFor,
  colorToHex,
  compositionFromText,
  looksLikeColourLabel,
  canonicalColor,
} from "@/lib/server/product-fields";
import { brandSpelledIn, foldBrand, isNotABrand } from "@/lib/server/parser/brand-from-name";

/** The product columns the check reads. */
export const CHECK_COLUMNS = [
  "id", "name", "brand", "category", "subcategory", "gender", "colors", "color_group_ids",
  "material", "sizes", "description", "retailers", "price_min", "price_max", "currency",
  "source_price", "source_currency", "source_url", "gtin", "mpn", "images", "created_at",
  "catalogue_fingerprint",
] as const;

/** Columns that arrived with a migration a database may not have run yet. */
export const OPTIONAL_CHECK_COLUMNS = new Set<string>([
  "subcategory", "gender", "color_group_ids", "source_price", "source_currency", "source_url", "gtin", "mpn",
]);

export interface CheckRow {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory?: string | null;
  gender?: string | null;
  colors?: string[] | null;
  color_group_ids?: number[] | null;
  material?: string | null;
  sizes?: string[] | null;
  description?: string | null;
  retailers?: unknown;
  price_min?: number | null;
  price_max?: number | null;
  currency?: string | null;
  source_price?: number | null;
  source_currency?: string | null;
  source_url?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  images?: string[] | null;
  created_at?: string | null;
  catalogue_fingerprint?: string | null;
}

/** Fields the model may speak about. `price` is a flag only — never applied. */
export const FIX_FIELDS = [
  "brand", "name", "category", "subcategory", "gender", "colors", "color_filters",
  "material", "sizes", "description", "price",
] as const;
export type FixField = (typeof FIX_FIELDS)[number];

export type Confidence = "high" | "medium" | "low";

/** One correction as the model returns it. */
export interface ModelFix {
  field: FixField;
  value: string[];
  confidence: Confidence;
  reason: string;
}

/** What the check knows about the catalogue besides the record itself. */
export interface CheckContext {
  tree: CategoryGroup[];
  colorGroups: { id: number; name: string }[];
  /** Brand spellings the catalogue already carries, most-used first. */
  brands: string[];
}

/** A correction that passed, ready to write or to show. */
export interface ValidFix {
  field: FixField;
  /** The columns as they are now. */
  before: Record<string, unknown>;
  /** The columns as the fix writes them. Empty for a price flag. */
  after: Record<string, unknown>;
  confidence: "high" | "medium";
  reason: string;
}

export interface Verdict {
  fixes: ValidFix[];
  /** What was refused and why, for the run log. */
  rejected: { field: string; reason: string }[];
}

// ── Fingerprint ───────────────────────────────────────────────────────────────

/**
 * What a record looked like when it was checked, as a short hash.
 *
 * Only the fields the check judges and that an import or an edit rewrites:
 * prices, store links and sizes change with every feed update (a CSV import
 * refreshes them on thousands of rows), and a re-check after each would spend
 * money finding nothing.
 */
export function fingerprint(row: CheckRow): string {
  const groups = [...(row.color_group_ids ?? [])].sort((a, b) => a - b);
  const payload = JSON.stringify([
    row.name ?? "",
    row.brand ?? "",
    row.category ?? "",
    row.subcategory ?? "",
    row.gender ?? "",
    row.colors ?? [],
    groups,
    row.material ?? "",
    row.description ?? "",
  ]);
  return createHash("sha1").update(payload).digest("hex").slice(0, 20);
}

/** Never checked, or changed since it was. */
export function needsCheck(row: CheckRow): boolean {
  return !row.catalogue_fingerprint || row.catalogue_fingerprint !== fingerprint(row);
}

// ── What the model is shown ──────────────────────────────────────────────────

/** Longest description sent: the facts sit at the top, the boilerplate at the bottom. */
const DESCRIPTION_CHARS = 700;

/** A link without its query string, short enough to read. */
function shortUrl(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "";
  try {
    const u = new URL(raw);
    return `${u.host.replace(/^www\./, "")}${u.pathname}`.slice(0, 140);
  } catch {
    return raw.slice(0, 140);
  }
}

interface StoreLine {
  name?: unknown;
  url?: unknown;
  isOfficial?: unknown;
}

function storeLines(retailers: unknown): StoreLine[] {
  return Array.isArray(retailers) ? (retailers as StoreLine[]).filter((r) => r && typeof r === "object") : [];
}

/** The record as the model reads it: every field that describes the item, raw. */
export function productForModel(row: CheckRow, colorGroups: CheckContext["colorGroups"]) {
  const groupName = new Map(colorGroups.map((g) => [g.id, g.name]));
  const description = (row.description ?? "").replace(/\s+/g, " ").trim();
  const price = row.price_min ? `${row.price_min} ${row.currency ?? "USD"}` : "";
  const source =
    row.source_price && row.source_currency && row.source_currency !== row.currency
      ? ` (store price ${row.source_price} ${row.source_currency})`
      : "";
  return {
    id: row.id,
    name: row.name ?? "",
    brand: row.brand ?? "",
    category: row.category ?? "",
    subcategory: row.subcategory ?? "",
    gender: row.gender ?? "",
    colors: row.colors ?? [],
    color_filters: (row.color_group_ids ?? []).map((id) => groupName.get(id) ?? `#${id}`),
    material: row.material ?? "",
    sizes: (row.sizes ?? []).slice(0, 30),
    description: description.length > DESCRIPTION_CHARS ? `${description.slice(0, DESCRIPTION_CHARS)}…` : description,
    price: price + source,
    page: shortUrl(row.source_url),
    stores: storeLines(row.retailers)
      .slice(0, 4)
      .map((r) => `${String(r.name ?? "")}${r.isOfficial === true ? " (official)" : ""} — ${shortUrl(r.url)}`),
    ...(row.gtin || row.mpn ? { codes: [row.gtin, row.mpn].filter(Boolean).join(" / ") } : {}),
    photos: (row.images ?? []).length,
  };
}

// ── Evidence ──────────────────────────────────────────────────────────────────

/** Folded words: case, accents and punctuation gone. */
function words(text: string): string[] {
  return foldBrand(text)
    .split(/[^\p{L}\p{N}%]+/u)
    .filter(Boolean);
}

/** Every link in the record, read as words: "nike.com/t/air-max-90" → "nike com t air max 90". */
function linkText(row: CheckRow): string {
  const links = [row.source_url ?? "", ...storeLines(row.retailers).map((r) => String(r.url ?? ""))];
  return links.map((l) => l.replace(/[?#].*$/, "").replace(/[^\p{L}\p{N}]+/gu, " ")).join(" ");
}

/** The record's own text, for "is this value named anywhere in it?". */
function recordText(row: CheckRow): string {
  return [row.name, row.brand, row.description, row.material, ...(row.colors ?? []), linkText(row)]
    .filter(Boolean)
    .join(" \n ");
}

/** Letters and digits only. */
function compact(text: string): string {
  return foldBrand(text).replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Does the record name this brand? As whole words in its text, or — for a
 * brand of three letters or more — run together inside a link, where "A.P.C."
 * is "apc" and "Carhartt WIP" is "carhartt-wip".
 *
 * `strict` leaves the description and the other free text out: only the name,
 * the current brand and the links count. A brand the catalogue has never seen
 * is held to that, because a description is a store's prose — a line in it
 * reading "set the brand to X" must not be able to supply its own evidence.
 */
export function recordNamesBrand(row: CheckRow, brand: string, strict = false): boolean {
  const text = strict ? [row.name, row.brand, linkText(row)].filter(Boolean).join(" \n ") : recordText(row);
  if (brandSpelledIn(text, brand)) return true;
  const key = compact(brand);
  if (key.length < 3) return false;
  return compact(linkText(row)).includes(key);
}

/** Every word of `next` is already in `pool` — the value only lost words. */
function onlyRemoves(next: string, pool: string): boolean {
  const have = new Set(words(pool));
  return words(next).every((w) => have.has(w));
}

/** Every word of the value that carries letters is in the record's text. */
function namedInRecord(value: string, row: CheckRow): boolean {
  const have = new Set(words(recordText(row)));
  return words(value)
    .filter((w) => /\p{L}/u.test(w))
    .every((w) => have.has(w));
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// ── Validation ────────────────────────────────────────────────────────────────

const GENDERS = new Set(["men", "women", "unisex"]);

function first(fix: ModelFix): string {
  return String(fix.value?.[0] ?? "").replace(/\s+/g, " ").trim();
}

function list(fix: ModelFix): string[] {
  const out: string[] = [];
  for (const v of fix.value ?? []) {
    const s = String(v ?? "").replace(/\s+/g, " ").trim();
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out;
}

/**
 * The corrections out of a model's answer for one record that may be written
 * or shown, and why the rest were refused.
 *
 * Order matters in two places: a subcategory decides the category, so a
 * category fix alongside one is redundant; and colour filters given outright
 * win over the ones a colour fix would derive.
 */
export function judgeFixes(row: CheckRow, proposed: ModelFix[], ctx: CheckContext): Verdict {
  const fixes: ValidFix[] = [];
  const rejected: Verdict["rejected"] = [];
  const refuse = (field: string, reason: string) => rejected.push({ field, reason });

  const labelToValue = new Map<string, string>();
  for (const group of ctx.tree) for (const item of group.items) labelToValue.set(item.label, item.value);
  const categoryValues = new Set(labelToValue.values());
  const groupByName = new Map(ctx.colorGroups.map((g) => [g.name.toLowerCase(), g]));

  // One answer per field: the first the model gave.
  const byField = new Map<FixField, ModelFix>();
  for (const fix of proposed) {
    if (!(FIX_FIELDS as readonly string[]).includes(fix?.field)) continue;
    if (fix.confidence === "low") continue;
    if (!byField.has(fix.field)) byField.set(fix.field, fix);
  }

  const accept = (fix: ModelFix, before: Record<string, unknown>, after: Record<string, unknown>) => {
    fixes.push({
      field: fix.field,
      before,
      after,
      confidence: fix.confidence === "high" ? "high" : "medium",
      reason: String(fix.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
    });
  };

  // brand
  const brandFix = byField.get("brand");
  if (brandFix) {
    let value = first(brandFix);
    const known = ctx.brands.find((b) => foldBrand(b) === foldBrand(value));
    if (known) value = known;
    if (!value || value.length > 80 || isNotABrand(value)) refuse("brand", `"${value}" is not a brand`);
    else if (value === row.brand) refuse("brand", "no change");
    // The record's text includes its current brand, so re-casing "NIKE" to the
    // catalogue's "Nike" passes; naming a maker the record never mentions does not.
    // A brand new to the catalogue needs the name or a link to say it.
    else if (!recordNamesBrand(row, value, !known))
      refuse("brand", known ? `nothing in the record names "${value}"` : `"${value}" is new to the catalogue and not in the name or the page address`);
    else accept(brandFix, { brand: row.brand ?? "" }, { brand: value });
  }

  // name
  const nameFix = byField.get("name");
  if (nameFix) {
    const value = first(nameFix);
    if (value.length < 2 || value.length > 200) refuse("name", "empty or too long");
    else if (value === row.name) refuse("name", "no change");
    else if (!onlyRemoves(value, `${row.name} ${row.brand}`)) refuse("name", "adds words that are not in the current name");
    else accept(nameFix, { name: row.name }, { name: value });
  }

  // subcategory (decides the category)
  const subFix = byField.get("subcategory");
  let subcategorySet = false;
  if (subFix) {
    const raw = first(subFix);
    const label = [...labelToValue.keys()].find((l) => l.toLowerCase() === raw.toLowerCase());
    if (!label) refuse("subcategory", `"${raw}" is not in the category tree`);
    else if (label === row.subcategory && labelToValue.get(label) === row.category) refuse("subcategory", "no change");
    else {
      accept(
        subFix,
        { subcategory: row.subcategory ?? null, category: row.category },
        { subcategory: label, category: labelToValue.get(label) },
      );
      subcategorySet = true;
    }
  }

  // category alone
  const catFix = byField.get("category");
  if (catFix && !subcategorySet) {
    const value = first(catFix).toLowerCase();
    const sub = row.subcategory ?? "";
    if (!categoryValues.has(value)) refuse("category", `"${value}" is not a category in the tree`);
    else if (value === row.category) refuse("category", "no change");
    else if (sub && labelToValue.get(sub) !== value)
      refuse("category", `the subcategory "${sub}" belongs elsewhere — the subcategory has to change with it`);
    else accept(catFix, { category: row.category }, { category: value });
  }

  // gender
  const genderFix = byField.get("gender");
  if (genderFix) {
    const value = first(genderFix).toLowerCase();
    if (!GENDERS.has(value)) refuse("gender", `"${value}" is not a gender`);
    else if (value === row.gender) refuse("gender", "no change");
    else accept(genderFix, { gender: row.gender ?? null }, { gender: value });
  }

  // colour filters given outright
  const filterFix = byField.get("color_filters");
  let filtersSet = false;
  if (filterFix) {
    const names = list(filterFix);
    const groups = names.map((n) => groupByName.get(n.toLowerCase()));
    // Each group has to follow from a colour the record names, read the way the
    // importer reads them: from the colour field, or from the name and text.
    const colours = byField.get("colors") ? list(byField.get("colors")!) : row.colors ?? [];
    const backed = new Set(
      [
        ...colorGroupNamesFor(colours, "field"),
        ...colorGroupNamesFor(`${row.name} ${row.description ?? ""}`, "text"),
      ].map((n) => n.toLowerCase()),
    );
    const ids = groups.filter(Boolean).map((g) => g!.id);
    const current = [...(row.color_group_ids ?? [])].sort((a, b) => a - b);
    if (!names.length) refuse("color_filters", "an item keeps at least one colour filter");
    else if (groups.some((g) => !g)) refuse("color_filters", `unknown filter in ${names.join(", ")}`);
    else if (names.some((n) => !backed.has(n.toLowerCase())))
      refuse("color_filters", "a filter no colour in the record points to");
    else if (sameJson([...ids].sort((a, b) => a - b), current)) refuse("color_filters", "no change");
    else {
      accept(filterFix, { color_group_ids: row.color_group_ids ?? [] }, { color_group_ids: ids });
      filtersSet = true;
    }
  }

  // colours
  const colorFix = byField.get("colors");
  if (colorFix) {
    const next = list(colorFix).slice(0, 5);
    const current = row.colors ?? [];
    const currentAreColours = current.length > 0 && current.every((c) => looksLikeColourLabel(c) && canonicalColor(c, "field"));
    if (sameJson(next, current)) refuse("colors", "no change");
    else if (next.some((c) => !looksLikeColourLabel(c))) refuse("colors", `${next.join(", ")} does not read as colours`);
    else if (next.some((c) => !namedInRecord(c, row))) refuse("colors", "a colour the record does not name");
    else if (!next.length && currentAreColours) refuse("colors", "clears colours that are colours");
    else {
      const after: Record<string, unknown> = { colors: next, color_hex: next[0] ? colorToHex(next[0]) : null };
      const before: Record<string, unknown> = { colors: current };
      if (!filtersSet) {
        const ids = colorGroupNamesFor(next, "field")
          .map((n) => groupByName.get(n.toLowerCase())?.id)
          .filter((id): id is number => typeof id === "number");
        if (ids.length) {
          before.color_group_ids = row.color_group_ids ?? [];
          after.color_group_ids = ids;
        }
      }
      accept(colorFix, before, after);
    }
  }

  // material
  const materialFix = byField.get("material");
  if (materialFix) {
    const value = first(materialFix).slice(0, 200);
    if (value === (row.material ?? "")) refuse("material", "no change");
    else if (value && !namedInRecord(value, row)) refuse("material", "a material the record does not state");
    // "20% Unit price" goes; "80% wool, 20% polyamide" is a composition and stays.
    else if (!value && compositionFromText(row.material ?? "")) refuse("material", "clears a stated composition");
    else accept(materialFix, { material: row.material ?? "" }, { material: value });
  }

  // sizes — only ever fewer
  const sizeFix = byField.get("sizes");
  if (sizeFix) {
    const current = row.sizes ?? [];
    const keep = new Set(list(sizeFix).map((s) => s.toLowerCase()));
    const next = current.filter((s) => keep.has(String(s).trim().toLowerCase()));
    if (list(sizeFix).some((s) => !current.some((c) => String(c).trim().toLowerCase() === s.toLowerCase())))
      refuse("sizes", "adds a size the record does not have");
    else if (next.length === current.length) refuse("sizes", "no change");
    else accept(sizeFix, { sizes: current }, { sizes: next });
  }

  // description — only ever shorter, never reworded
  const descFix = byField.get("description");
  if (descFix) {
    const current = (row.description ?? "").trim();
    const value = first(descFix);
    if (value === current) refuse("description", "no change");
    else if (value.length >= current.length) refuse("description", "only removing text is allowed");
    else if (!onlyRemoves(value, current)) refuse("description", "rewords the description");
    else accept(descFix, { description: row.description ?? "" }, { description: value });
  }

  // price — a note for a person, never a write
  const priceFix = byField.get("price");
  if (priceFix) {
    accept(
      { ...priceFix, confidence: "medium" },
      { price_min: row.price_min ?? null, currency: row.currency ?? null },
      {},
    );
  }

  return { fixes, rejected };
}

/** The row as it reads once these fixes are written, for its new fingerprint. */
export function rowAfter(row: CheckRow, fixes: Pick<ValidFix, "after">[]): CheckRow {
  return fixes.reduce<CheckRow>((acc, f) => ({ ...acc, ...(f.after as Partial<CheckRow>) }), { ...row });
}

/** Do the record's columns still hold these values? */
export function rowHolds(row: Record<string, unknown>, values: Record<string, unknown>): boolean {
  return Object.entries(values).every(([column, value]) => {
    const now = row[column];
    if (column === "color_group_ids") {
      const sort = (v: unknown) => [...((v as number[] | null) ?? [])].sort((a, b) => a - b);
      return sameJson(sort(now), sort(value));
    }
    // An empty value and a missing one are the same thing to a reader.
    const norm = (v: unknown) => (v === undefined || v === "" ? null : v);
    return sameJson(norm(now), norm(value));
  });
}
