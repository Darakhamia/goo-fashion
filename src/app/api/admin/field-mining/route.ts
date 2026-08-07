/**
 * Reads the catalogue's manual labelling and reports what could be learned
 * from it. Read-only — GET only, no writes anywhere, nothing stored.
 *
 * The question this answers, before any autofill is built: is there enough
 * signal in a few hundred hand-filed products to fill a field automatically,
 * and for which fields? So every mechanism is mined on 80% of the catalogue and
 * scored on the 20% it has never seen, and the two numbers that matter are
 * reported separately — how often it has an answer, and how often that answer
 * matches what the editor chose. A field that scores badly should not get
 * autofill, and this is how that is decided rather than guessed.
 *
 * The existing hand-written keyword table is scored on the same held-out rows,
 * so "mined rules" can be compared against what the code already does instead
 * of being assumed better.
 *
 *   GET /api/admin/field-mining              → JSON report
 *   GET /api/admin/field-mining?format=text  → the same, readable in a browser
 *   GET /api/admin/field-mining?knn=1        → also score nearest-neighbour
 *                                              voting over stored embeddings
 *   &minSupport=3 &minPrecision=0.8 &holdout=0.2 &k=10 &rules=all
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { matchCategory, inferGenderFromText } from "@/lib/server/product-fields";
import {
  loadLabelledProducts,
  makeKeyBuilders,
  type LabelledProduct as Row,
} from "@/lib/server/catalogue-labels";
import {
  applyMultiRules,
  applyRules,
  colorGroupPairs,
  labelFrequency,
  majorityLabels,
  majorityValue,
  mineRules,
  nearest,
  scoreMultiLabel,
  scoreSingleLabel,
  splitHoldout,
  voteMulti,
  voteSingle,
  type MinedRule,
} from "@/lib/server/mining";

export const dynamic = "force-dynamic";

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const params = new URL(req.url).searchParams;
  const minSupport = Math.max(1, Number(params.get("minSupport")) || 3);
  const minPrecision = Math.min(1, Math.max(0, Number(params.get("minPrecision")) || 0.8));
  const holdoutShare = Math.min(0.5, Math.max(0.05, Number(params.get("holdout")) || 0.2));
  const k = Math.max(1, Number(params.get("k")) || 10);
  const wantKnn = params.get("knn") === "1";
  const allRules = params.get("rules") === "all";

  const loaded = await loadLabelledProducts(wantKnn);
  if ("error" in loaded) {
    return NextResponse.json(
      { error: `Could not read products: ${loaded.error}` },
      { status: 503 },
    );
  }
  if (!loaded.length) {
    return NextResponse.json({ error: "No products to learn from." }, { status: 400 });
  }

  const { train, holdout } = splitHoldout(loaded, (r) => r.id, holdoutShare);
  const opts = { minSupport, minPrecision };

  // The shared builders: name-only for garments with brand, colour, size and
  // gender words dropped; name plus description for style; gender words kept
  // for gender, where they turned out to be the whole signal.
  const { garmentKeys: nameKeys, proseKeys, genderKeys } = makeKeyBuilders(loaded);

  const categoryRules = mineRules(train, nameKeys, (r) => [r.category], { ...opts, topOnly: true });
  const subcategoryRules = mineRules(train, nameKeys, (r) => (r.subcategory ? [r.subcategory] : []), { ...opts, topOnly: true });
  const genderByBrand = mineRules(train, (r) => (r.brand ? [r.brand] : []), (r) => (r.gender ? [r.gender] : []), { ...opts, topOnly: true });
  const genderByName = mineRules(train, genderKeys, (r) => (r.gender ? [r.gender] : []), { ...opts, topOnly: true });
  const styleRules = mineRules(train, proseKeys, (r) => r.styleKeywords, opts);
  const colorRules = mineRules(
    colorGroupPairs(train),
    (p) => [p.color],
    (p) => [p.group],
    { minSupport: Math.min(2, minSupport), minPrecision, topOnly: true },
  );

  // Colour groups are scored per colour name rather than per product: the map
  // is what is being judged, and a product with three colours exercises it
  // three times.
  const holdoutColorPairs = colorGroupPairs(holdout);

  // What a mechanism has to beat to have learned anything: always answer with
  // whatever the catalogue says most often.
  const majorityCategory = majorityValue(train, (r) => r.category);
  const majoritySubcategory = majorityValue(train, (r) => r.subcategory);
  const majorityGender = majorityValue(train, (r) => r.gender);
  const majorityColourGroup = majorityValue(colorGroupPairs(train), (p) => p.group);
  const majorityStyle = majorityLabels(train, (r) => r.styleKeywords);

  // A catalogue leaning hard on one brand mines that brand's vocabulary rather
  // than the language of clothes, so the concentration belongs in the report.
  const brandCounts = new Map<string, number>();
  for (const r of loaded) if (r.brand) brandCounts.set(r.brand, (brandCounts.get(r.brand) ?? 0) + 1);
  const brands = [...brandCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([brand, count]) => ({ brand, count, share: count / loaded.length }));

  const report = {
    catalogue: {
      products: loaded.length,
      trained_on: train.length,
      held_out: holdout.length,
      distinct_brands: brands.length,
      top_brands: brands.slice(0, 10),
      style_label_frequency: labelFrequency(loaded, (r) => r.styleKeywords),
      labelled: {
        category: loaded.filter((r) => r.category).length,
        subcategory: loaded.filter((r) => r.subcategory).length,
        gender: loaded.filter((r) => r.gender).length,
        colour_groups: loaded.filter((r) => r.colorGroups.length).length,
        style_keywords: loaded.filter((r) => r.styleKeywords.length).length,
      },
      embeddings_present: wantKnn ? loaded.filter((r) => r.embedding?.length).length : null,
    },
    settings: { minSupport, minPrecision, holdoutShare, k, knn: wantKnn },
    scores: {
      category_mined: scoreSingleLabel(holdout, (r) => r.category, (r) => applyRules(categoryRules, nameKeys(r))?.value ?? null, (r) => r.name),
      // The table already in the code, on the same rows — the bar to beat.
      category_existing_keywords: scoreSingleLabel(holdout, (r) => r.category, (r) => matchCategory(`${r.name} ${r.description}`), (r) => r.name),
      category_majority: scoreSingleLabel(holdout, (r) => r.category, () => majorityCategory, () => "", 0),
      subcategory_mined: scoreSingleLabel(holdout, (r) => r.subcategory, (r) => applyRules(subcategoryRules, nameKeys(r))?.value ?? null, (r) => r.name),
      subcategory_majority: scoreSingleLabel(holdout, (r) => r.subcategory, () => majoritySubcategory, () => "", 0),
      gender_by_name: scoreSingleLabel(holdout, (r) => r.gender, (r) => applyRules(genderByName, genderKeys(r))?.value ?? null, (r) => r.name),
      gender_by_brand: scoreSingleLabel(holdout, (r) => r.gender, (r) => applyRules(genderByBrand, r.brand ? [r.brand] : [])?.value ?? null, (r) => r.name),
      gender_existing_text: scoreSingleLabel(holdout, (r) => r.gender, (r) => inferGenderFromText(`${r.name} ${r.description}`) ?? null, (r) => r.name),
      // Name first, then the hand-written text rule, then the brand as a last
      // resort — each step is weaker than the one before, so nothing overrides
      // a better signal.
      gender_combined: scoreSingleLabel(
        holdout,
        (r) => r.gender,
        (r) =>
          applyRules(genderByName, genderKeys(r))?.value ??
          inferGenderFromText(`${r.name} ${r.description}`) ??
          applyRules(genderByBrand, r.brand ? [r.brand] : [])?.value ??
          null,
        (r) => r.name,
      ),
      gender_majority: scoreSingleLabel(holdout, (r) => r.gender, () => majorityGender, () => "", 0),
      colour_group_mined: scoreSingleLabel(holdoutColorPairs, (p) => p.group, (p) => applyRules(colorRules, [p.color])?.value ?? null, (p) => p.color),
      colour_group_majority: scoreSingleLabel(holdoutColorPairs, (p) => p.group, () => majorityColourGroup, () => "", 0),
      style_mined: scoreMultiLabel(holdout, (r) => r.styleKeywords, (r) => applyMultiRules(styleRules, proseKeys(r))),
      style_majority: scoreMultiLabel(holdout, (r) => r.styleKeywords, () => majorityStyle),
    } as Record<string, unknown>,
    rules: {
      counts: {
        category: categoryRules.length,
        subcategory: subcategoryRules.length,
        gender_by_name: genderByName.length,
        gender_by_brand: genderByBrand.length,
        colour_group: colorRules.length,
        style: styleRules.length,
      },
      category: allRules ? categoryRules : categoryRules.slice(0, 80),
      subcategory: allRules ? subcategoryRules : subcategoryRules.slice(0, 80),
      gender_by_name: genderByName,
      gender_by_brand: genderByBrand,
      colour_group: colorRules,
      style: allRules ? styleRules : styleRules.slice(0, 80),
    },
  };

  if (wantKnn) {
    // The embeddings are already stored, so this costs nothing but CPU — and it
    // is the mechanism most likely to carry style, where token rules are thin.
    const pool = train.filter((r) => r.embedding?.length);
    const neighboursOf = (r: Row) => nearest(r.embedding, pool, (o) => o.embedding, k);
    report.scores.category_knn = scoreSingleLabel(holdout, (r) => r.category, (r) => voteSingle(neighboursOf(r), (o) => o.category)?.value ?? null, (r) => r.name);
    report.scores.subcategory_knn = scoreSingleLabel(holdout, (r) => r.subcategory, (r) => voteSingle(neighboursOf(r), (o) => o.subcategory)?.value ?? null, (r) => r.name);
    report.scores.gender_knn = scoreSingleLabel(holdout, (r) => r.gender, (r) => voteSingle(neighboursOf(r), (o) => o.gender)?.value ?? null, (r) => r.name);
    report.scores.style_knn = scoreMultiLabel(holdout, (r) => r.styleKeywords, (r) => voteMulti(neighboursOf(r), (o) => o.styleKeywords));
  }

  if (params.get("format") !== "text") return NextResponse.json(report);

  /* A browser-readable rendering of the same thing, so the report can be read
     and pasted without a JSON viewer. */
  const lines: string[] = [];
  const c = report.catalogue;
  lines.push("FIELD MINING REPORT");
  lines.push("===================");
  lines.push(`products ${c.products} · trained on ${c.trained_on} · held out ${c.held_out}`);
  lines.push(`minSupport=${minSupport} minPrecision=${minPrecision} holdout=${holdoutShare} k=${k}`);
  lines.push("");
  lines.push("HAND-FILLED FIELDS");
  for (const [field, n] of Object.entries(c.labelled)) {
    lines.push(`  ${field.padEnd(16)} ${String(n).padStart(4)} of ${c.products}  (${pct(n / c.products)})`);
  }
  if (c.embeddings_present !== null) {
    lines.push(`  ${"embeddings".padEnd(16)} ${String(c.embeddings_present).padStart(4)} of ${c.products}`);
  }
  lines.push("");
  lines.push(`BRAND MIX  (${c.distinct_brands} brands)`);
  for (const b of c.top_brands) {
    lines.push(`  ${b.brand.slice(0, 28).padEnd(30)} ${String(b.count).padStart(4)}  ${pct(b.share)}`);
  }
  lines.push("");
  lines.push("STYLE KEYWORD FREQUENCY  (how often each is used at all)");
  for (const f of c.style_label_frequency.slice(0, 15)) {
    lines.push(`  ${f.value.padEnd(30)} ${String(f.count).padStart(4)}  ${pct(f.share)}`);
  }
  lines.push("");
  lines.push("SCORES  (on held-out products the rules never saw)");
  lines.push("  *_majority = always answer with the catalogue's most common value.");
  lines.push("  A mechanism that does not beat its majority line has learned nothing.");
  lines.push(`  ${"mechanism".padEnd(30)} ${"answers".padStart(8)} ${"correct".padStart(8)} ${"overall".padStart(8)}`);
  for (const [name, raw] of Object.entries(report.scores)) {
    const s = raw as Record<string, number>;
    if ("accuracy" in s) {
      lines.push(`  ${name.padEnd(30)} ${pct(s.coverage).padStart(8)} ${pct(s.accuracy).padStart(8)} ${pct(s.overall).padStart(8)}   n=${s.evaluated}`);
    } else {
      lines.push(`  ${name.padEnd(30)} ${pct(s.coverage).padStart(8)} ${"P " + pct(s.precision)} / ${"R " + pct(s.recall)}  exact=${s.exact} n=${s.evaluated}`);
    }
  }
  lines.push("");
  lines.push("  answers = share of products it had any answer for");
  lines.push("  correct = share of those answers matching the editor's choice");
  lines.push("  P/R     = precision / recall over multi-label style keywords");
  lines.push("");
  lines.push("RULES FOUND");
  for (const [field, count] of Object.entries(report.rules.counts)) {
    lines.push(`  ${field.padEnd(16)} ${count}`);
  }
  for (const field of ["colour_group", "gender_by_name", "gender_by_brand", "category", "subcategory", "style"] as const) {
    const rules = report.rules[field] as MinedRule[];
    if (!rules.length) continue;
    lines.push("");
    lines.push(`── ${field} ──`);
    for (const r of rules.slice(0, 60)) {
      lines.push(`  ${r.key.padEnd(28)} → ${r.value.padEnd(22)} ${r.hits}/${r.support} (${pct(r.precision)})`);
    }
    if (rules.length > 60) lines.push(`  …and ${rules.length - 60} more (add &rules=all)`);
  }
  lines.push("");
  lines.push("WHERE IT GOT THINGS WRONG");
  for (const [name, raw] of Object.entries(report.scores)) {
    const s = raw as { misses?: { name: string; expected: string; got: string }[] };
    if (!s.misses?.length) continue;
    lines.push("");
    lines.push(`── ${name} ──`);
    for (const m of s.misses.slice(0, 15)) {
      lines.push(`  ${m.name.slice(0, 46).padEnd(48)} said ${m.got.padEnd(18)} should be ${m.expected}`);
    }
  }

  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
