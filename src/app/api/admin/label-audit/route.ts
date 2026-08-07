/**
 * Finds products whose hand-filled labels look wrong, so they can be checked.
 *
 * Read-only — GET only, nothing is written or corrected. It produces a list of
 * suspects and the evidence against each; deciding is the editor's job, since
 * a rule disagreeing with a label means one of the two is wrong and the rule
 * is not automatically the one to believe.
 *
 * Two independent checks, in order of how much they can be trusted.
 *
 * The tree check is exact. A product stores a category and a subcategory
 * label, and the category tree already says which category a label belongs to,
 * so a pair that contradicts it is wrong by definition — no statistics
 * involved. This is what catches a subcategory left behind by an edit, or a
 * label the tree no longer has.
 *
 * The rule check is statistical, and is what catches a product filed under a
 * bucket its own name argues against. Rules are mined per fold and applied
 * only to the fold they were not mined from: auditing against rules built from
 * the whole catalogue would be circular, because a mislabelled product helps
 * build the rule that ought to catch it. Suspects are ranked by how many
 * independent mechanisms agree against the stored label, since one mechanism
 * can be fooled by a naming quirk and three agreeing rarely are.
 *
 *   GET /api/admin/label-audit
 *   GET /api/admin/label-audit?format=text
 *   &minSupport=4 &minPrecision=0.9 &folds=5 &limit=60
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { loadCategoryTree } from "@/lib/server/category-tree";
import { subcategoryToValue } from "@/lib/categories";
import { matchCategory, inferGenderFromText } from "@/lib/server/product-fields";
import { loadLabelledProducts, makeKeyBuilders } from "@/lib/server/catalogue-labels";
import {
  applyRules,
  colorGroupPairs,
  kFold,
  mineRules,
  type MinedRule,
} from "@/lib/server/mining";

export const dynamic = "force-dynamic";

interface Suspect {
  id: string;
  name: string;
  field: string;
  stored: string;
  suggested: string;
  /** What argued for the suggestion, most convincing first. */
  evidence: string[];
  /** Independent mechanisms agreeing against the stored value. */
  agreement: number;
}

function ruleEvidence(label: string, rule: MinedRule): string {
  return `${label}: "${rule.key}" → ${rule.value} (${rule.hits}/${rule.support}, ${Math.round(rule.precision * 100)}%)`;
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const params = new URL(req.url).searchParams;
  const minSupport = Math.max(1, Number(params.get("minSupport")) || 4);
  const minPrecision = Math.min(1, Math.max(0, Number(params.get("minPrecision")) || 0.9));
  const folds = Math.max(2, Math.min(20, Number(params.get("folds")) || 5));
  const limit = Math.max(1, Math.min(500, Number(params.get("limit")) || 60));

  const loaded = await loadLabelledProducts();
  if ("error" in loaded) {
    return NextResponse.json({ error: `Could not read products: ${loaded.error}` }, { status: 503 });
  }
  if (!loaded.length) {
    return NextResponse.json({ error: "No products to audit." }, { status: 400 });
  }

  const tree = await loadCategoryTree();
  const labelToValue = subcategoryToValue(tree.groups);
  const { garmentKeys } = makeKeyBuilders(loaded);

  /* ── 1. Tree consistency: exact, no statistics ────────────────────────── */

  const orphaned: Suspect[] = [];
  const contradicting: Suspect[] = [];

  for (const p of loaded) {
    if (!p.subcategory) continue;
    const expected = labelToValue[p.subcategory];
    if (expected === undefined) {
      orphaned.push({
        id: p.id,
        name: p.name,
        field: "subcategory",
        stored: p.subcategory,
        suggested: "—",
        evidence: ["no subcategory by this name exists in the category tree"],
        agreement: 1,
      });
    } else if (expected !== p.category) {
      contradicting.push({
        id: p.id,
        name: p.name,
        field: "category",
        stored: p.category,
        suggested: expected,
        evidence: [`the tree files "${p.subcategory}" under ${expected}`],
        agreement: 1,
      });
    }
  }

  /* ── 2. Rule disagreement, judged out of fold ─────────────────────────── */

  const opts = { minSupport, minPrecision };
  const buckets = kFold(loaded, (r) => r.id, folds);
  const categorySuspects = new Map<string, Suspect>();
  const subcategorySuspects: Suspect[] = [];
  const colourSuspects: Suspect[] = [];

  for (let f = 0; f < folds; f++) {
    const judged = buckets[f];
    if (!judged.length) continue;
    const rest = buckets.filter((_, i) => i !== f).flat();

    const categoryRules = mineRules(rest, garmentKeys, (r) => [r.category], { ...opts, topOnly: true });
    const subcategoryRules = mineRules(rest, garmentKeys, (r) => (r.subcategory ? [r.subcategory] : []), { ...opts, topOnly: true });
    const colourRules = mineRules(colorGroupPairs(rest), (p) => [p.color], (p) => [p.group], { ...opts, topOnly: true });

    for (const p of judged) {
      // Category gets two opinions: the rules mined from the rest of the
      // catalogue, and the hand-written keyword table, which scored highest of
      // anything measured and never saw this product either.
      const mined = applyRules(categoryRules, garmentKeys(p));
      const keyworded = matchCategory(`${p.name} ${p.description}`);

      const disagreeing: { value: string; evidence: string }[] = [];
      if (mined && mined.value !== p.category) {
        disagreeing.push({ value: mined.value, evidence: ruleEvidence("mined rule", mined) });
      }
      if (keyworded && keyworded !== p.category) {
        disagreeing.push({ value: keyworded, evidence: `keyword table reads the name as ${keyworded}` });
      }
      if (disagreeing.length) {
        // Only count agreement when both point the SAME way — two mechanisms
        // disagreeing with the label and with each other is not corroboration.
        const byValue = new Map<string, string[]>();
        for (const d of disagreeing) {
          byValue.set(d.value, [...(byValue.get(d.value) ?? []), d.evidence]);
        }
        const [value, evidence] = [...byValue.entries()].sort((a, b) => b[1].length - a[1].length)[0];
        categorySuspects.set(p.id, {
          id: p.id,
          name: p.name,
          field: "category",
          stored: p.category,
          suggested: value,
          evidence,
          agreement: evidence.length,
        });
      }

      const subMined = applyRules(subcategoryRules, garmentKeys(p));
      if (p.subcategory && subMined && subMined.value !== p.subcategory) {
        subcategorySuspects.push({
          id: p.id,
          name: p.name,
          field: "subcategory",
          stored: p.subcategory,
          suggested: subMined.value,
          evidence: [ruleEvidence("mined rule", subMined)],
          agreement: 1,
        });
      }

      // A colour the catalogue reliably files under one group, on a product
      // that does not carry that group — usually a filter group left unticked.
      for (const colour of p.colors) {
        const rule = applyRules(colourRules, [colour.trim().toLowerCase()]);
        if (!rule) continue;
        if (!p.colorGroups.includes(rule.value)) {
          colourSuspects.push({
            id: p.id,
            name: p.name,
            field: "colour group",
            stored: p.colorGroups.join(", ") || "(none)",
            suggested: rule.value,
            evidence: [ruleEvidence(`colour "${colour}"`, rule)],
            agreement: 1,
          });
        }
      }
    }
  }

  // Gender needs no folding: the keyword rule is hand-written, so it never saw
  // any of this. Only where it fires — it is precise but quiet.
  const genderSuspects: Suspect[] = [];
  for (const p of loaded) {
    if (!p.gender) continue;
    const said = inferGenderFromText(`${p.name} ${p.description}`);
    if (said && said !== p.gender) {
      genderSuspects.push({
        id: p.id,
        name: p.name,
        field: "gender",
        stored: p.gender,
        suggested: said,
        evidence: [`the name or description says ${said}`],
        agreement: 1,
      });
    }
  }

  const byConfidence = (a: Suspect, b: Suspect) =>
    b.agreement - a.agreement || a.name.localeCompare(b.name);
  const categoryList = [...categorySuspects.values()].sort(byConfidence);

  const sections = {
    subcategory_not_in_tree: orphaned,
    category_contradicts_subcategory: contradicting,
    category_disputed_by_name: categoryList,
    subcategory_disputed_by_name: subcategorySuspects.sort(byConfidence),
    gender_disputed_by_name: genderSuspects.sort(byConfidence),
    colour_group_possibly_missing: colourSuspects.sort(byConfidence),
  };

  const report = {
    catalogue: { products: loaded.length, category_tree: tree.source },
    settings: { minSupport, minPrecision, folds, limit },
    totals: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.length])),
    suspects: Object.fromEntries(
      Object.entries(sections).map(([k, v]) => [k, v.slice(0, limit)]),
    ),
  };

  if (params.get("format") !== "text") return NextResponse.json(report);

  const lines: string[] = [];
  lines.push("LABEL AUDIT");
  lines.push("===========");
  lines.push(`${loaded.length} products · category tree from ${tree.source}`);
  lines.push(`minSupport=${minSupport} minPrecision=${minPrecision} folds=${folds}`);
  lines.push("");
  lines.push("Nothing here has been changed. Each line is a product worth a second look;");
  lines.push("where a rule disagrees with a label, either one of them can be the wrong one.");
  lines.push("");
  lines.push("SUMMARY");
  for (const [name, list] of Object.entries(sections)) {
    lines.push(`  ${name.padEnd(36)} ${String(list.length).padStart(4)}`);
  }

  const titles: Record<string, string> = {
    subcategory_not_in_tree: "SUBCATEGORY NOT IN THE TREE  (exact — the label does not exist)",
    category_contradicts_subcategory: "CATEGORY CONTRADICTS SUBCATEGORY  (exact — the tree disagrees)",
    category_disputed_by_name: "CATEGORY DISPUTED BY THE NAME  (2 = both mechanisms agree)",
    subcategory_disputed_by_name: "SUBCATEGORY DISPUTED BY THE NAME",
    gender_disputed_by_name: "GENDER DISPUTED BY THE NAME",
    colour_group_possibly_missing: "COLOUR GROUP POSSIBLY MISSING",
  };

  for (const [name, list] of Object.entries(sections)) {
    if (!list.length) continue;
    lines.push("");
    lines.push(`── ${titles[name] ?? name} ── ${list.length}`);
    for (const s of list.slice(0, limit)) {
      const mark = s.agreement > 1 ? `[${s.agreement}] ` : "    ";
      lines.push(`  ${mark}${s.name.slice(0, 44).padEnd(46)} ${s.stored.slice(0, 18).padEnd(20)} → ${s.suggested}`);
      for (const e of s.evidence) lines.push(`        ${e}`);
    }
    if (list.length > limit) lines.push(`  …and ${list.length - limit} more (raise &limit=)`);
  }

  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
