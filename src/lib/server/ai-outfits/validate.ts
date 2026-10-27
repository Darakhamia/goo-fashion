/**
 * Which of the model's outfits are kept.
 *
 * The model is asked to follow every rule below, and mostly does; this is
 * what makes "mostly" good enough. An outfit is kept only when it is
 * complete, its pieces are from the list, it is cut for one gender, its
 * colours hold together, it honours the brief, and it is not a copy of one the
 * site already has. A refused outfit is never repaired — the reason goes back
 * to the model, which proposes another.
 */
import type { Season, StyleKeyword } from "@/lib/types";
import { normalizeStyleKeywords } from "@/lib/style-keywords";
import { normalizeSeasons } from "@/lib/seasons";
import type { Candidate, CandidatePool, GenerationBrief } from "./candidates";
import { fitsGender, outfitGender, SLOT_LIMIT, type ColourFamily, type OutfitSlot } from "./pieces";
import type { ModelOutfit } from "./model";

/** Most real colours one outfit holds beside its neutrals. */
export const MAX_ACCENTS = 2;
/** Most pieces two outfits of a batch may share. */
export const MAX_SHARED = 2;
/** Most outfits of a batch one piece may appear in. */
export const MAX_REUSE = 2;

const SLOT_ORDER: OutfitSlot[] = ["outerwear", "top", "one_piece", "bottom", "shoes", "accessory"];

export interface CheckedOutfit {
  pieces: Candidate[];
  styles: StyleKeyword[];
  seasons: Season[];
  palette: string[];
  name: string;
  description: string;
  notes: string;
}

/** A piece set's fingerprint: its product ids, sorted. Two outfits of the same pieces have the same one. */
export function signature(productIds: string[]): string {
  return [...productIds].sort().join("|");
}

export interface CheckContext {
  pool: CandidatePool;
  brief: GenerationBrief;
  /** Piece sets the catalogue and the queue already have. */
  existing: Set<string>;
  /** Outfits kept so far in this run. */
  kept: CheckedOutfit[];
}

export type CheckResult = { ok: true; outfit: CheckedOutfit } | { ok: false; reason: string };

export function checkOutfit(proposal: ModelOutfit, ctx: CheckContext): CheckResult {
  const refuse = (reason: string): CheckResult => ({ ok: false, reason });

  // Pieces from the list, each once.
  const ids = (proposal.pieces ?? []).map((p) => String(p?.id ?? "").trim());
  const unknown = ids.filter((id) => !ctx.pool.byKey.has(id));
  if (unknown.length) return refuse(`used ids that are not in the list (${unknown.slice(0, 3).join(", ")})`);
  if (new Set(ids).size !== ids.length) return refuse("used one piece twice");
  const pieces = ids
    .map((id) => ctx.pool.byKey.get(id)!)
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));

  // Complete, and each slot used no more than it can be. The slot is the
  // piece's own, whatever the model labelled it.
  const count = (slot: OutfitSlot) => pieces.filter((p) => p.slot === slot).length;
  for (const slot of SLOT_ORDER) {
    if (count(slot) > SLOT_LIMIT[slot]) return refuse(`more than ${SLOT_LIMIT[slot]} ${slot.replace("_", "-")} piece${SLOT_LIMIT[slot] === 1 ? "" : "s"}`);
  }
  if (count("shoes") !== 1) return refuse("no shoes");
  if (count("one_piece")) {
    if (count("top") || count("bottom")) return refuse("a one-piece worn with a separate top or bottom");
  } else if (!count("top") || !count("bottom")) {
    return refuse("missing a top or a bottom");
  }
  if (pieces.length < 3 || pieces.length > 6) return refuse("needs 3 to 6 pieces");

  // One gender.
  const gender = outfitGender(pieces.map((p) => p.product));
  if (gender === "mixed") return refuse("mixed men's and women's pieces");
  if (ctx.brief.gender && !pieces.every((p) => fitsGender(p.product, ctx.brief.gender))) {
    return refuse(`a piece is not for ${ctx.brief.gender}`);
  }

  // Colours that hold together: neutrals, plus at most two real colours.
  const accents = new Set<ColourFamily>(pieces.flatMap((p) => p.accents));
  if (accents.size > MAX_ACCENTS) return refuse(`too many colours at once (${[...accents].join(", ")})`);

  // The brief, as a preference (CEO, 2026-10-27).
  if (ctx.brief.colours.length) {
    const chosen = new Set(ctx.brief.colours);
    if (!pieces.some((p) => p.families.some((f) => chosen.has(f)))) {
      return refuse(`no piece in ${ctx.brief.colours.join(" or ")}`);
    }
    const off = [...accents].filter((f) => !chosen.has(f));
    if (off.length) return refuse(`colours outside the brief (${off.join(", ")})`);
  }
  if (ctx.brief.brands.length && !pieces.some((p) => p.preferredBrand)) {
    return refuse(`no piece by ${ctx.brief.brands.join(" or ")}`);
  }

  let styles = normalizeStyleKeywords(proposal.styles ?? []);
  if (ctx.brief.styles.length) {
    styles = styles.filter((s) => ctx.brief.styles.includes(s));
    if (!styles.length) return refuse(`not in ${ctx.brief.styles.join(" or ")}`);
  }
  if (!styles.length) {
    // The pieces' own tags, most common first, when the model named none.
    const tally = new Map<StyleKeyword, number>();
    for (const p of pieces) for (const s of p.product.styleKeywords ?? []) tally.set(s, (tally.get(s) ?? 0) + 1);
    styles = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 1).map(([s]) => s);
  }

  // Not a copy: of the site's outfits and the queue, and of this batch.
  const productIds = pieces.map((p) => p.product.id);
  if (ctx.existing.has(signature(productIds))) return refuse("the same pieces as an outfit the site already has");
  for (const other of ctx.kept) {
    const shared = other.pieces.filter((p) => productIds.includes(p.product.id)).length;
    if (shared > MAX_SHARED) return refuse(`shares ${shared} pieces with another outfit of this batch`);
  }
  for (const p of pieces) {
    const uses = ctx.kept.filter((o) => o.pieces.some((q) => q.product.id === p.product.id)).length;
    if (uses >= MAX_REUSE) return refuse(`${p.key} is already in ${MAX_REUSE} outfits of this batch`);
  }

  return {
    ok: true,
    outfit: {
      pieces,
      styles: styles.slice(0, 2),
      seasons: normalizeSeasons(proposal.seasons ?? []),
      palette: (proposal.palette ?? []).map((c) => String(c).trim()).filter(Boolean).slice(0, 4),
      name: String(proposal.name ?? ""),
      description: String(proposal.description ?? ""),
      notes: String(proposal.notes ?? "").trim().slice(0, 400),
    },
  };
}
