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
 *   GET /api/admin/label-audit?format=text   (&includeDismissed=1 lists dismissed claims too)
 *   &minSupport=4 &minPrecision=0.9 &folds=5 &limit=60
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { isMissingTableLoose } from "@/lib/server/db-errors";
import { loadCategoryTree } from "@/lib/server/category-tree";
import { subcategoryToValue } from "@/lib/categories";
import { matchCategory, inferGenderFromText } from "@/lib/server/product-fields";
import { loadLabelledProducts, makeKeyBuilders } from "@/lib/server/catalogue-labels";
import {
  applyRules,
  colorGroupPairs,
  findSplitLabels,
  kFold,
  mineRules,
  subcategoryNamedIn,
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
  /** Set only when dismissed claims are asked for, so they can be restored. */
  dismissed?: boolean;
}

/** The claim a dismissal covers — the product, the field, and both values. */
function claimKey(s: Pick<Suspect, "id" | "field" | "stored" | "suggested">): string {
  return [s.id, s.field, s.stored, s.suggested].join("\u0000");
}

/**
 * Claims already judged wrong by an editor.
 *
 * A missing table means migration 012 has not run: nothing is dismissed yet,
 * so the audit works either way — but the page is told, so the admin does not
 * find out on the first Dismiss. Any other read error is reported too: it
 * brings every dismissed claim back, which otherwise looks like the audit
 * forgetting them.
 */
async function loadDismissed(): Promise<{ claims: Set<string>; available: boolean; error: string | null }> {
  const { data, error } = await supabase!
    .from("label_audit_dismissals")
    .select("product_id, field, stored, suggested");
  if (error) {
    const missing = isMissingTableLoose(error);
    return { claims: new Set(), available: !missing, error: missing ? null : error.message };
  }
  const claims = new Set(
    ((data ?? []) as { product_id: string; field: string; stored: string; suggested: string }[]).map((d) =>
      claimKey({ id: d.product_id, field: d.field, stored: d.stored, suggested: d.suggested }),
    ),
  );
  return { claims, available: true, error: null };
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
  // Which group a bucket sits in. `shirts` and `tops` are both inside Tops, so
  // a move between them changes nothing a shopper sees — worth saying rather
  // than leaving it to be puzzled out.
  const groupOfValue = new Map<string, string>();
  for (const group of tree.groups) {
    for (const item of group.items) {
      if (!groupOfValue.has(item.value)) groupOfValue.set(item.value, group.label);
    }
  }
  const sameGroupNote = (from: string, to: string): string[] => {
    const a = groupOfValue.get(from);
    const b = groupOfValue.get(to);
    return a && a === b ? [`both sit in the ${a} group — this changes the bucket, not what a shopper sees`] : [];
  };
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
      // A subcategory that resolves and agrees with the stored category settles
      // the category: the tree says which bucket the label belongs to, so no
      // keyword gets an opinion about it. Without this, every real shirt was
      // argued at by a rule that learned "shirt" from the t-shirts and polos
      // that outnumber them, and the move suggested was `shirts` → `tops` —
      // two buckets inside the same Tops group, which reads as nonsense
      // because it is. Anything genuinely wrong on such a product surfaces as
      // a subcategory dispute below instead, and applying that sets both.
      const categorySettled = !!p.subcategory && labelToValue[p.subcategory] === p.category;

      // Category gets two opinions: the rules mined from the rest of the
      // catalogue, and the hand-written keyword table, which scored highest of
      // anything measured and never saw this product either.
      const mined = categorySettled ? null : applyRules(categoryRules, garmentKeys(p));
      // The NAME only. Fed the description as well, this accused a tee of
      // being shorts and a pair of jeans of being a blazer: descriptions are
      // marketing copy that name-drops other garments, and a keyword table
      // cannot tell "pairs well with shorts" from "is shorts".
      const keyworded = categorySettled ? null : matchCategory(p.name);

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
          evidence: [...evidence, ...sameGroupNote(p.category, value)],
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

  /* ── 3. Phrases the catalogue files two ways ──────────────────────────── */

  // Needs no folding: this compares the catalogue against itself rather than
  // against a rule, so there is nothing that could have been trained on it.
  // Only products whose category is not already settled by their subcategory:
  // a coherent pair leaves nothing for a phrase pattern to argue about, and
  // arguing anyway produced the same `shirts` → `tops` noise as the rules did.
  const categoryUnsettled = loaded.filter(
    (p) => !p.subcategory || labelToValue[p.subcategory] !== p.category,
  );
  const categorySplits = findSplitLabels(categoryUnsettled, garmentKeys, (p) => p.category, { minSupport });
  const subcategorySplits = findSplitLabels(loaded, garmentKeys, (p) => p.subcategory, { minSupport });

  // One entry per product per field, keeping the best-attested phrase. A name
  // contains several phrases, and listing a product once per phrase turned two
  // dozen findings into a hundred lines saying the same thing.
  const splitBest = new Map<string, { suspect: Suspect; support: number }>();
  for (const [field, splits] of [["category", categorySplits], ["subcategory", subcategorySplits]] as const) {
    for (const split of splits) {
      for (const { value, row } of split.odd) {
        const key = `${field}:${row.id}`;
        const existing = splitBest.get(key);
        if (existing && existing.support >= split.support) continue;
        splitBest.set(key, {
          support: split.support,
          suspect: {
            id: row.id,
            name: row.name,
            field,
            stored: value,
            suggested: split.majority.value,
            evidence: [
              `"${split.key}" is filed as ${split.majority.value} on ${split.majority.count} of ${split.support} products`,
              ...(field === "category" ? sameGroupNote(value, split.majority.value) : []),
            ],
            agreement: 1,
          },
        });
      }
    }
  }
  const splitSuspects = [...splitBest.values()].map((e) => e.suspect);

  /* ── 4. Filed in the wrong part of the catalogue entirely ─────────────── */

  // What a settled category is still checked against.
  //
  // The fold loop above stops arguing about a category its subcategory settles.
  // That was too broad: it silenced the hand-written keyword table along with
  // the mined rules, and only the mined rules were the problem. Traced over the
  // cases that motivated both changes, the table is right every time —
  // "cross-embroidered shirt" → shirts, "cotton polo shirt" → tops,
  // "graphic-print V-neck sweater" → knitwear, all agreeing with how they are
  // filed and staying silent. Every false positive came from a mined rule like
  // `"shirt" → tops`, which only says that t-shirts outnumber shirts.
  //
  // So the table gets its say on every product, and at BUCKET level rather than
  // group. A t-shirt filed as Knitwear is inside the right group and still the
  // wrong thing; the group comparison alone let that through.
  //
  // Nothing is offered to apply: the subcategory is what has to change, and
  // only a person knows which one is meant.
  const wrongPart: Suspect[] = [];
  for (const p of loaded) {
    const settled = !!p.subcategory && labelToValue[p.subcategory] === p.category;
    // Unsettled products are already covered above, with a suggestion to apply.
    if (!settled) continue;
    const said = p.name ? matchCategory(p.name) : null;
    if (!said || said === p.category) continue;
    const saidGroup = groupOfValue.get(said);
    const storedGroup = groupOfValue.get(p.category);
    // Crossing groups is the louder version of the same problem, so it says so
    // rather than leaving two bucket names to be interpreted.
    const crossesGroups = !!saidGroup && !!storedGroup && saidGroup !== storedGroup;
    wrongPart.push({
      id: p.id,
      name: p.name,
      field: "group",
      stored: `${storedGroup ?? p.category} › ${p.subcategory}`,
      suggested: crossesGroups ? (saidGroup as string) : said,
      evidence: [
        crossesGroups
          ? `the name reads as ${saidGroup}, but this is filed under ${storedGroup}`
          : `the name reads as ${said}, but this is filed as ${p.category} — same group, different kind of thing`,
      ],
      agreement: 1,
    });
  }

  /* ── 5. The name names a subcategory, and it is not this one ───────────── */

  // Needs no evidence beyond itself, and catches what nothing else can. A
  // t-shirt filed as Hoodies sits in the right category — both labels are
  // `tops` — so the keyword table has no opinion; and the mined rule for
  // "t shirt" hovers under any sensible threshold because long-sleeve tees
  // carry the phrase too. But the name says "T-Shirt" and the tree has a
  // subcategory called exactly that.
  //
  // The longest match wins, which is what keeps it honest: "Long Sleeve
  // T-Shirt" resolves to Long Sleeves, and "bomber jacket" to Bomber Jackets,
  // because the more specific label is the longer one.
  const allLabels = tree.groups.flatMap((g) => g.items.map((i) => i.label));
  const namedWrong: Suspect[] = [];
  for (const p of loaded) {
    if (!p.name) continue;
    const named = subcategoryNamedIn(p.name, allLabels);
    if (!named || named === p.subcategory) continue;
    namedWrong.push({
      id: p.id,
      name: p.name,
      field: "subcategory",
      stored: p.subcategory ?? "(none)",
      suggested: named,
      evidence: [`the name says "${named}"`],
      agreement: 1,
    });
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

  const found = {
    subcategory_not_in_tree: orphaned,
    category_contradicts_subcategory: contradicting,
    filed_under_the_wrong_group: wrongPart.sort(byConfidence),
    subcategory_named_in_the_name: namedWrong.sort(byConfidence),
    same_phrase_filed_two_ways: splitSuspects.sort(byConfidence),
    category_disputed_by_name: categoryList,
    subcategory_disputed_by_name: subcategorySuspects.sort(byConfidence),
    gender_disputed_by_name: genderSuspects.sort(byConfidence),
    colour_group_possibly_missing: colourSuspects.sort(byConfidence),
  };

  // Claims an editor has already judged wrong are kept apart, because an audit
  // that repeats them on every run buries the findings that are new. They are
  // still sent, marked, so the page can show them for undoing without running
  // the whole audit again.
  const dismissals = await loadDismissed();
  const showDismissed = params.get("includeDismissed") === "1";
  let dismissedCount = 0;

  const open: Record<string, Suspect[]> = {};
  const rejected: Record<string, Suspect[]> = {};
  for (const [key, list] of Object.entries(found)) {
    open[key] = [];
    rejected[key] = [];
    for (const suspect of list) {
      if (dismissals.claims.has(claimKey(suspect))) rejected[key].push({ ...suspect, dismissed: true });
      else open[key].push(suspect);
    }
    dismissedCount += rejected[key].length;
  }

  const report = {
    catalogue: { products: loaded.length, category_tree: tree.source },
    settings: { minSupport, minPrecision, folds, limit },
    dismissed: dismissedCount,
    dismissalsAvailable: dismissals.available,
    dismissalsError: dismissals.error,
    // Open findings only; dismissed ones are counted apart, so no total mixes the two.
    totals: Object.fromEntries(Object.entries(open).map(([k, v]) => [k, v.length])),
    dismissedTotals: Object.fromEntries(Object.entries(rejected).map(([k, v]) => [k, v.length])),
    // Up to `limit` open findings per section, then up to `limit` dismissed ones.
    suspects: Object.fromEntries(
      Object.keys(open).map((k) => [k, [...open[k].slice(0, limit), ...rejected[k].slice(0, limit)]]),
    ),
  };

  if (params.get("format") !== "text") return NextResponse.json(report);

  const sections = showDismissed
    ? Object.fromEntries(Object.keys(open).map((k) => [k, [...open[k], ...rejected[k]]]))
    : open;

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
    filed_under_the_wrong_group: "FILED IN THE WRONG PART OF THE CATALOGUE  (the name says another group)",
    subcategory_named_in_the_name: "THE NAME NAMES A DIFFERENT SUBCATEGORY  (exact — no evidence needed beyond the name)",
    same_phrase_filed_two_ways: "SAME PHRASE, DIFFERENT LABEL  (the catalogue disagreeing with itself)",
    category_disputed_by_name: "CATEGORY DISPUTED BY THE NAME  (2 = both mechanisms agree)",
    subcategory_disputed_by_name: "SUBCATEGORY DISPUTED BY THE NAME",
    gender_disputed_by_name: "GENDER DISPUTED BY THE NAME",
    colour_group_possibly_missing: "COLOUR GROUP POSSIBLY MISSING",
  };

  for (const [name, list] of Object.entries(sections)) {
    if (!list.length) continue;
    lines.push("");
    lines.push(`── ${titles[name] ?? name} ── ${list.length}`);

    // Grouped by the change being proposed, because that is the unit of the
    // decision: ten polo shirts moving from tops to shirts is one call to
    // make, not ten. A flat list hides that they are the same question.
    const byChange = new Map<string, Suspect[]>();
    for (const s of list.slice(0, limit)) {
      const change = `${s.stored} → ${s.suggested}`;
      byChange.set(change, [...(byChange.get(change) ?? []), s]);
    }
    const ordered = [...byChange.entries()].sort((a, b) => b[1].length - a[1].length);

    for (const [change, group] of ordered) {
      lines.push(`  ${change}   (${group.length})`);
      for (const s of group) {
        const mark = s.agreement > 1 ? `[${s.agreement}]` : "   ";
        lines.push(`    ${mark} ${s.name.slice(0, 50).padEnd(52)} ${s.id}`);
        for (const e of s.evidence) lines.push(`          ${e}`);
      }
    }
    if (list.length > limit) lines.push(`  …and ${list.length - limit} more (raise &limit=)`);
  }

  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
