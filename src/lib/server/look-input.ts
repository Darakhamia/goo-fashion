/**
 * Validation for look payloads sent by a browser.
 *
 * Three routes write a look the shopper built: /api/looks/share (a public
 * snapshot), /api/user/looks (the account's saved looks) and /api/looks/submit
 * (the moderation queue). Every field arrives from the client, and each lands
 * in a `jsonb` or `text` column with no size limit of its own, so without these
 * caps one request can put megabytes into a row. They started in the share
 * route and live here so all three hold looks to the same rules.
 *
 * Kept free of database and auth imports: the rules are pure and are tested
 * on their own.
 */

/** A builder look has six slots; twice that leaves room without letting a list grow. */
export const MAX_LOOK_PIECES = 12;
export const MAX_LOOK_URL_LENGTH = 2000;
export const MAX_LOOK_NAME_LENGTH = 200;
export const MAX_LOOK_DESCRIPTION_LENGTH = 2000;
const MAX_STYLE_KEYWORDS = 20;
const MAX_STYLE_KEYWORD_LENGTH = 60;

export type LookPiece = Record<string, unknown>;

type RawPiece = {
  slot?: unknown;
  productId?: unknown;
  variantId?: unknown;
  imageUrl?: unknown;
  name?: unknown;
};

/** A trimmed, non-empty string no longer than `maxLen`, or null. */
export function asTrimmedString(v: unknown, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > maxLen) return null;
  return s;
}

/** A hosted http(s) image link, or null — never a data: or other URI. */
export function asHttpUrl(v: unknown): string | null {
  const s = asTrimmedString(v, MAX_LOOK_URL_LENGTH);
  return s && /^https?:\/\//i.test(s) ? s : null;
}

/**
 * The pieces of a look, each reduced to the fields the look page reads, or
 * null when the list is not one a builder could have made.
 *
 * `allowEmpty` is for the account's own saved looks, whose endpoint has always
 * taken an empty list; a shared or submitted look needs at least one piece.
 */
export function sanitizeLookPieces(
  raw: unknown,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): LookPiece[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_LOOK_PIECES) return null;
  if (raw.length === 0 && !allowEmpty) return null;
  const pieces: LookPiece[] = [];
  for (const item of raw as RawPiece[]) {
    const slot = asTrimmedString(item?.slot, 40);
    const productId = asTrimmedString(item?.productId, 100);
    if (!slot || !productId) return null;
    const piece: LookPiece = { slot, productId };
    const variantId = asTrimmedString(item?.variantId, 100);
    if (variantId) piece.variantId = variantId;
    const imageUrl = asHttpUrl(item?.imageUrl);
    if (imageUrl) piece.imageUrl = imageUrl;
    const name = asTrimmedString(item?.name, 300);
    if (name) piece.name = name;
    pieces.push(piece);
  }
  return pieces;
}

/** Style tags: strings only, each short, and not too many of them. */
export function sanitizeStyleKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (k): k is string =>
        typeof k === "string" && k.length > 0 && k.length <= MAX_STYLE_KEYWORD_LENGTH,
    )
    .slice(0, MAX_STYLE_KEYWORDS);
}

/** A finite number, or null — `total_price` is shown, never trusted for money. */
export function asFiniteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** The client's `savedAt` as an ISO timestamp, or now when it is not a date. */
export function asSavedAt(v: unknown): string {
  const ms = Date.parse(typeof v === "string" ? v : "");
  return Number.isNaN(ms) ? new Date().toISOString() : new Date(ms).toISOString();
}
