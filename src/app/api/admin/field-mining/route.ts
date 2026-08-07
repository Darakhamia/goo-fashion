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
  applyMultiRules,
  applyRules,
  colorGroupPairs,
  mineRules,
  nearest,
  scoreMultiLabel,
  scoreSingleLabel,
  splitHoldout,
  tokenize,
  voteMulti,
  voteSingle,
  type MinedRule,
} from "@/lib/server/mining";

export const dynamic = "force-dynamic";

const PAGE = 1000;

interface Row {
  id: string;
  name: string;
  description: string;
  brand: string;
  gender: string | null;
  category: string;
  subcategory: string | null;
  colors: string[];
  colorGroups: string[];
  styleKeywords: string[];
  embedding: number[] | null;
}

/** A vector column comes back from PostgREST as "[0.1,0.2,…]". */
function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw !== "string" || !raw.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Brand words, so a brand that sells one kind of thing cannot mine into a rule. */
function brandTokens(brand: string): Set<string> {
  return new Set(
    (brand ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean),
  );
}

async function loadRows(withEmbedding: boolean): Promise<Row[] | { error: string }> {
  const groups = await supabase!.from("color_groups").select("id, name");
  const groupName = new Map<number, string>();
  for (const g of (groups.data ?? []) as { id: number; name: string }[]) {
    groupName.set(g.id, g.name);
  }

  const columns = [
    "id", "name", "description", "brand", "gender",
    "category", "subcategory", "colors", "color_group_ids", "style_keywords",
    ...(withEmbedding ? ["embedding"] : []),
  ].join(", ");

  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!
      .from("products")
      .select(columns)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) return { error: error.message };

    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    for (const r of batch) {
      rows.push({
        id: String(r.id),
        name: String(r.name ?? ""),
        description: String(r.description ?? ""),
        brand: String(r.brand ?? ""),
        gender: (r.gender as string) ?? null,
        category: String(r.category ?? ""),
        subcategory: (r.subcategory as string) ?? null,
        colors: (r.colors as string[]) ?? [],
        colorGroups: ((r.color_group_ids as number[]) ?? [])
          .map((id) => groupName.get(id))
          .filter((n): n is string => !!n),
        styleKeywords: (r.style_keywords as string[]) ?? [],
        embedding: withEmbedding ? parseEmbedding(r.embedding) : null,
      });
    }
    if (batch.length < PAGE) break;
  }
  return rows;
}

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

  const loaded = await loadRows(wantKnn);
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

  // Category and subcategory are mined from the NAME only. A description is
  // marketing copy that name-drops other garments ("wears well with jeans"),
  // which reads to a token counter as evidence for the wrong bucket. Style
  // keywords are the opposite case — the aesthetic lives in that prose — so
  // they get both fields.
  const nameKeys = (r: Row) => tokenize(r.name, brandTokens(r.brand));
  const proseKeys = (r: Row) => tokenize(`${r.name} ${r.description}`, brandTokens(r.brand));

  const categoryRules = mineRules(train, nameKeys, (r) => [r.category], { ...opts, topOnly: true });
  const subcategoryRules = mineRules(train, nameKeys, (r) => (r.subcategory ? [r.subcategory] : []), { ...opts, topOnly: true });
  const genderByBrand = mineRules(train, (r) => (r.brand ? [r.brand] : []), (r) => (r.gender ? [r.gender] : []), { ...opts, topOnly: true });
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

  const report = {
    catalogue: {
      products: loaded.length,
      trained_on: train.length,
      held_out: holdout.length,
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
      subcategory_mined: scoreSingleLabel(holdout, (r) => r.subcategory, (r) => applyRules(subcategoryRules, nameKeys(r))?.value ?? null, (r) => r.name),
      gender_by_brand: scoreSingleLabel(holdout, (r) => r.gender, (r) => applyRules(genderByBrand, r.brand ? [r.brand] : [])?.value ?? null, (r) => r.name),
      gender_existing_text: scoreSingleLabel(holdout, (r) => r.gender, (r) => inferGenderFromText(`${r.name} ${r.description}`) ?? null, (r) => r.name),
      colour_group_mined: scoreSingleLabel(holdoutColorPairs, (p) => p.group, (p) => applyRules(colorRules, [p.color])?.value ?? null, (p) => p.color),
      style_mined: scoreMultiLabel(holdout, (r) => r.styleKeywords, (r) => applyMultiRules(styleRules, proseKeys(r))),
    } as Record<string, unknown>,
    rules: {
      counts: {
        category: categoryRules.length,
        subcategory: subcategoryRules.length,
        gender_by_brand: genderByBrand.length,
        colour_group: colorRules.length,
        style: styleRules.length,
      },
      category: allRules ? categoryRules : categoryRules.slice(0, 80),
      subcategory: allRules ? subcategoryRules : subcategoryRules.slice(0, 80),
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
  lines.push("SCORES  (on held-out products the rules never saw)");
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
  for (const field of ["colour_group", "gender_by_brand", "category", "subcategory", "style"] as const) {
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
