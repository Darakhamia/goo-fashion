/**
 * Proposes field values for a product from what the catalogue already knows.
 *
 * Only the mechanisms that earned it. Measured on held-out products, against a
 * baseline of always answering with the catalogue's most common value:
 *
 *   colour → group    100% correct, 91% coverage   (baseline 30%)
 *   subcategory        98% correct, 80% coverage   (baseline 14%)
 *   category           92% overall via the keyword table on the name alone
 *   gender             93% overall                 (baseline 77%)
 *   style keywords     47% exact — not proposed
 *
 * Style is left out on purpose. It reads well on paper because `streetwear` is
 * on 90% of the catalogue, so guessing it is usually right and almost never
 * useful; the rules behind the rest are description boilerplate ("rubber
 * outsole", "ribbed cuffs"). A field nobody can trust is worse than an empty
 * one, because an empty field is obviously unfinished.
 *
 * Nothing here writes. It returns proposals, each carrying what argued for it
 * and how far to trust it, and the editor decides.
 */
import {
  applyRules,
  colorGroupPairs,
  mineRules,
  type MinedRule,
} from "@/lib/server/mining";
import { makeKeyBuilders, type LabelledProduct } from "@/lib/server/catalogue-labels";
import { subcategoryToValue, type CategoryGroup } from "@/lib/categories";
import { matchCategory, inferGenderFromText } from "@/lib/server/product-fields";

/** What the editor has typed so far. */
export interface DraftProduct {
  name: string;
  description?: string;
  brand?: string;
  colors?: string[];
  category?: string;
  subcategory?: string;
  gender?: string;
  colorGroups?: string[];
}

export type SuggestionField = "category" | "subcategory" | "gender" | "colorGroups";

export interface FieldSuggestion {
  field: SuggestionField;
  /** A label for `subcategory`, a group name per entry for `colorGroups`. */
  value: string | string[];
  /**
   * `high` is worth pre-selecting: a rule that has been right on almost every
   * product backing it. `low` is worth showing and no more.
   */
  confidence: "high" | "low";
  why: string;
  /** The value this would overwrite, when the field is not empty. */
  replaces?: string;
  /**
   * Set on a subcategory proposal: the category the tree files that label
   * under, so accepting one cannot leave the pair contradicting itself.
   */
  alsoSetsCategory?: string;
}

/** A rule is worth pre-selecting only if it has been right almost every time. */
const HIGH_PRECISION = 0.9;
const HIGH_SUPPORT = 4;

function isHigh(rule: MinedRule): boolean {
  return rule.precision >= HIGH_PRECISION && rule.support >= HIGH_SUPPORT;
}

function ruleWhy(rule: MinedRule): string {
  return `"${rule.key}" means ${rule.value} on ${rule.hits} of ${rule.support} products`;
}

export interface SuggestionRules {
  subcategory: MinedRule[];
  colour: MinedRule[];
  gender: MinedRule[];
}

/**
 * Mines the rules a suggestion draws on.
 *
 * Separated from applying them so a caller can mine once and reuse it: the
 * catalogue changes far more slowly than the editor asks questions of it.
 */
export function mineSuggestionRules(catalogue: LabelledProduct[]): SuggestionRules {
  const { garmentKeys, genderKeys } = makeKeyBuilders(catalogue);
  const opts = { minSupport: 3, minPrecision: 0.8, topOnly: true };
  return {
    subcategory: mineRules(catalogue, garmentKeys, (r) => (r.subcategory ? [r.subcategory] : []), opts),
    colour: mineRules(colorGroupPairs(catalogue), (p) => [p.color], (p) => [p.group], {
      ...opts,
      minSupport: 2,
    }),
    gender: mineRules(catalogue, genderKeys, (r) => (r.gender ? [r.gender] : []), opts),
  };
}

export function suggestFields(
  draft: DraftProduct,
  catalogue: LabelledProduct[],
  tree: CategoryGroup[],
  rules: SuggestionRules,
): FieldSuggestion[] {
  const { garmentKeys, genderKeys } = makeKeyBuilders(catalogue);
  // The builders expect a stored product; a draft is the same shape with less
  // filled in, which is exactly what is being asked about.
  const asProduct = {
    name: draft.name ?? "",
    description: draft.description ?? "",
    brand: draft.brand ?? "",
    colors: draft.colors ?? [],
    colorGroups: draft.colorGroups ?? [],
  } as LabelledProduct;

  const labelToValue = subcategoryToValue(tree);
  const out: FieldSuggestion[] = [];

  /* ── Subcategory, and the category that follows from it ─────────────────── */

  const subRule = applyRules(rules.subcategory, garmentKeys(asProduct));
  const subValue = subRule?.value;
  const subCategory = subValue ? labelToValue[subValue] : undefined;

  if (subRule && subValue && subValue !== draft.subcategory) {
    out.push({
      field: "subcategory",
      value: subValue,
      confidence: isHigh(subRule) ? "high" : "low",
      why: ruleWhy(subRule),
      ...(draft.subcategory ? { replaces: draft.subcategory } : {}),
      ...(subCategory ? { alsoSetsCategory: subCategory } : {}),
    });
  }

  /* ── Category ───────────────────────────────────────────────────────────── */

  // Proposed on its own only when no subcategory is being proposed, because
  // accepting a subcategory sets the category from the tree and two proposals
  // for one field could disagree. The keyword table reads the NAME only: with
  // the description it scored 88% against 92%, since marketing copy name-drops
  // other garments.
  if (!subCategory) {
    const keyworded = draft.name ? matchCategory(draft.name) : null;
    if (keyworded && keyworded !== draft.category) {
      out.push({
        field: "category",
        value: keyworded,
        confidence: "high",
        why: "the keyword table reads the name as this",
        ...(draft.category ? { replaces: draft.category } : {}),
      });
    }
  }

  /* ── Gender ─────────────────────────────────────────────────────────────── */

  // The hand-written text rule first: it is quiet but 94% right where it fires,
  // because it only answers when a gender is actually named. The mined rules
  // are the fallback, and mostly reflect that most of the catalogue is
  // menswear — hence never `high`.
  const said = inferGenderFromText(`${draft.name ?? ""} ${draft.description ?? ""}`);
  const genderRule = said ? null : applyRules(rules.gender, genderKeys(asProduct));
  const gender = said ?? genderRule?.value;
  if (gender && gender !== draft.gender) {
    out.push({
      field: "gender",
      value: gender,
      confidence: said ? "high" : "low",
      why: said ? "the name or description says so" : ruleWhy(genderRule!),
      ...(draft.gender ? { replaces: draft.gender } : {}),
    });
  }

  /* ── Colour filter groups ───────────────────────────────────────────────── */

  // The most reliable of the lot, and the easiest to forget: a piece with no
  // group is invisible to the colour filter. Only groups it does not already
  // carry are proposed, and never as a replacement — a piece can be two
  // colours, so this only ever adds.
  const have = new Set(draft.colorGroups ?? []);
  const add: string[] = [];
  const reasons: string[] = [];
  for (const colour of draft.colors ?? []) {
    const rule = applyRules(rules.colour, [colour.trim().toLowerCase()]);
    if (!rule || have.has(rule.value) || add.includes(rule.value)) continue;
    add.push(rule.value);
    reasons.push(`${colour} → ${rule.value}`);
  }
  if (add.length) {
    out.push({
      field: "colorGroups",
      value: add,
      confidence: "high",
      why: reasons.join(", "),
    });
  }

  return out;
}
