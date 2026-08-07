/**
 * Mines field-filling rules out of the catalogue's own manual labelling.
 *
 * Every product an editor has filed by hand is a labelled example: this name
 * and description go with this category, this subcategory, this gender, these
 * colour groups, these style keywords. Given a few hundred of them, the pairs
 * that hold consistently are worth turning into rules — both to fix the
 * products that are still wrong and to pre-fill the next one.
 *
 * Everything here is pure. It takes rows and returns rules and scores, so the
 * mining can be judged on held-out data before any of it is trusted, and so
 * the thresholds can be tuned without touching a database.
 *
 * A rule is only as good as its numbers, so every one carries its support (how
 * many labelled rows back it) and its precision (how often it was right). A
 * rule with a precision of 1.0 over three rows is a coincidence waiting to
 * happen; the caller decides what to believe.
 */

/**
 * Function words, which cannot carry a signal about a garment.
 *
 * The list has to include the very short ones. A first pass kept a bigram
 * whenever either half was meaningful, and left "a", "s" and "it" out of this
 * set on the grounds that they are too short to stand alone — with the result
 * that "with a", "on the" and "it s" mined into confident-looking rules over
 * dozens of products. A phrase made only of these words is noise no matter how
 * consistently it co-occurs with a label.
 *
 * "t" is deliberately absent: it has to survive for "t shirt".
 */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "do", "for", "from",
  "has", "have", "if", "in", "is", "it", "its", "of", "on", "or", "our", "s",
  "so", "that", "the", "then", "this", "to", "was", "we", "with", "you", "your",
  "all", "any", "new", "off", "sale",
  "или", "для", "это", "как", "так", "все", "его", "она", "они",
]);

/** Tokens shorter than this are dropped as unigrams; bigrams may keep them. */
const MIN_UNIGRAM = 3;

/**
 * Unigrams and bigrams of a piece of text, with `skip` tokens removed entirely.
 *
 * Bigrams are built from the raw word stream so "t shirt" survives even though
 * "t" is too short to stand alone. A bigram containing a skipped or stop word
 * is dropped outright rather than kept for its meaningful half: a first pass
 * kept those, and mined "originals womens → footwear" and "cloud white →
 * footwear" — the brand's own vocabulary and a colourway, both of which say
 * nothing about the next brand's products. Losing a genuine "nike blazer"
 * along with them is the price, and a cheap one, since the hand-written table
 * covers model names already.
 */
export function tokenize(text: string, skip: Set<string> = new Set()): string[] {
  const words = (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w && !/^\d+$/.test(w));

  const dead = (w: string) => STOPWORDS.has(w) || skip.has(w);
  const out = new Set<string>();
  for (const w of words) {
    if (w.length >= MIN_UNIGRAM && !dead(w)) out.add(w);
  }
  for (let i = 0; i + 1 < words.length; i++) {
    const a = words[i];
    const b = words[i + 1];
    if (dead(a) || dead(b)) continue;
    out.add(`${a} ${b}`);
  }
  return [...out];
}

/**
 * The single most common value, as a baseline to judge everything else by.
 *
 * A mechanism that scores well on a catalogue where nearly every product
 * carries the same label has not necessarily learned anything — it may have
 * learned the label's frequency. Reporting this alongside is what tells the
 * two apart.
 */
export function majorityValue<T>(
  rows: T[],
  valueOf: (row: T) => string | null | undefined,
): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = valueOf(row);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  if (!counts.size) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** How often each label appears, most common first. */
export function labelFrequency<T>(
  rows: T[],
  valuesOf: (row: T) => string[],
): { value: string; count: number; share: number }[] {
  const counts = new Map<string, number>();
  let labelled = 0;
  for (const row of rows) {
    const values = new Set(valuesOf(row).filter(Boolean));
    if (!values.size) continue;
    labelled++;
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, share: labelled ? count / labelled : 0 }))
    .sort((a, b) => b.count - a.count);
}

/** The labels common enough to be worth guessing for every product. */
export function majorityLabels<T>(
  rows: T[],
  valuesOf: (row: T) => string[],
  threshold = 0.5,
): string[] {
  const frequency = labelFrequency(rows, valuesOf);
  const common = frequency.filter((f) => f.share >= threshold).map((f) => f.value);
  return common.length ? common : frequency.slice(0, 1).map((f) => f.value);
}

export interface MinedRule {
  /** The token, colour name or brand this rule fires on. */
  key: string;
  value: string;
  /** Labelled rows carrying the key. */
  support: number;
  /** Of those, how many carry this value. */
  hits: number;
  precision: number;
}

export interface MineOptions {
  minSupport?: number;
  minPrecision?: number;
  /**
   * Keep only each key's leading value. Right for a field a product has one
   * of (a category), wrong for one it can have several of (style keywords),
   * where every value clearing the bar is its own rule.
   */
  topOnly?: boolean;
}

/**
 * Counts key→value pairs across labelled rows and keeps the ones that hold.
 *
 * One function serves every field because they differ only in what counts as a
 * key: tokens of a name, a brand, a colour. Rows with no value for the field
 * are skipped rather than counted as evidence, so precision always divides by
 * rows that could have voted.
 */
export function mineRules<T>(
  rows: T[],
  keysOf: (row: T) => string[],
  valuesOf: (row: T) => string[],
  opts: MineOptions = {},
): MinedRule[] {
  const minSupport = opts.minSupport ?? 3;
  const minPrecision = opts.minPrecision ?? 0.8;

  const totals = new Map<string, number>();
  const counts = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const values = valuesOf(row).filter(Boolean);
    if (!values.length) continue;
    for (const key of new Set(keysOf(row).filter(Boolean))) {
      totals.set(key, (totals.get(key) ?? 0) + 1);
      const byValue = counts.get(key) ?? new Map<string, number>();
      for (const value of new Set(values)) {
        byValue.set(value, (byValue.get(value) ?? 0) + 1);
      }
      counts.set(key, byValue);
    }
  }

  const rules: MinedRule[] = [];
  for (const [key, byValue] of counts) {
    const support = totals.get(key) ?? 0;
    if (support < minSupport) continue;

    const candidates = [...byValue.entries()].sort((a, b) => b[1] - a[1]);
    const kept = opts.topOnly ? candidates.slice(0, 1) : candidates;
    for (const [value, hits] of kept) {
      const precision = hits / support;
      if (precision < minPrecision) continue;
      rules.push({ key, value, support, hits, precision });
    }
  }

  // Most reliable first; among equals, prefer the more specific phrase and then
  // the better-attested one. `applyRules` walks this order and takes the first
  // hit, so it reads as "specific → general" the way a hand-written table does.
  rules.sort(
    (a, b) =>
      b.precision - a.precision ||
      b.key.split(" ").length - a.key.split(" ").length ||
      b.support - a.support ||
      a.key.localeCompare(b.key),
  );
  return rules;
}

/** The leading rule that fires on these keys, or null when none does. */
export function applyRules(rules: MinedRule[], keys: string[]): MinedRule | null {
  const present = new Set(keys);
  for (const rule of rules) if (present.has(rule.key)) return rule;
  return null;
}

/** Every value whose rule fires — for a field a product can have several of. */
export function applyMultiRules(rules: MinedRule[], keys: string[]): string[] {
  const present = new Set(keys);
  const values = new Set<string>();
  for (const rule of rules) if (present.has(rule.key)) values.add(rule.value);
  return [...values];
}

/**
 * Explicit (colour, group) pairs to mine a colour→group map from.
 *
 * A row lists its colours and its groups as two separate arrays, so a piece
 * with two of each does not say which goes with which. Rather than guess from
 * the cross-product — which invents a wrong pair for every right one — this
 * uses the rows that can only mean one thing: a single colour with a single
 * group, or a colour whose name matches a group's outright.
 */
export function colorGroupPairs(
  rows: { colors: string[]; colorGroups: string[] }[],
): { color: string; group: string }[] {
  const pairs: { color: string; group: string }[] = [];
  for (const row of rows) {
    const colors = (row.colors ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean);
    const groups = (row.colorGroups ?? []).filter(Boolean);
    if (!colors.length || !groups.length) continue;

    if (colors.length === 1 && groups.length === 1) {
      pairs.push({ color: colors[0], group: groups[0] });
      continue;
    }
    for (const color of colors) {
      const named = groups.find(
        (g) => g.toLowerCase() === color || color.includes(g.toLowerCase()),
      );
      if (named) pairs.push({ color, group: named });
    }
  }
  return pairs;
}

/* ── Scoring ──────────────────────────────────────────────────────────────── */

/**
 * Splits rows into a training and a held-out set, the same way every run.
 *
 * Hashing the id rather than shuffling means two runs are comparable: a
 * threshold change moves the score because the rules changed, not because the
 * split did.
 */
export function splitHoldout<T>(
  rows: T[],
  idOf: (row: T) => string,
  share = 0.2,
): { train: T[]; holdout: T[] } {
  const train: T[] = [];
  const holdout: T[] = [];
  for (const row of rows) {
    let hash = 0x811c9dc5;
    const id = idOf(row);
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    (hash % 1000 < share * 1000 ? holdout : train).push(row);
  }
  return { train, holdout };
}

export interface SingleLabelScore {
  /** Held-out rows carrying a manual value to check against. */
  evaluated: number;
  /** Of those, how many the mechanism had an answer for. */
  answered: number;
  correct: number;
  /** answered / evaluated — how much of the work it can attempt. */
  coverage: number;
  /** correct / answered — how much to trust an answer it does give. */
  accuracy: number;
  /** correct / evaluated — the two above in one number. */
  overall: number;
  misses: { name: string; expected: string; got: string }[];
}

export function scoreSingleLabel<T>(
  rows: T[],
  actualOf: (row: T) => string | null | undefined,
  predict: (row: T) => string | null,
  nameOf: (row: T) => string,
  maxMisses = 40,
): SingleLabelScore {
  let evaluated = 0;
  let answered = 0;
  let correct = 0;
  const misses: SingleLabelScore["misses"] = [];

  for (const row of rows) {
    const actual = actualOf(row);
    if (!actual) continue;
    evaluated++;
    const got = predict(row);
    if (got === null) continue;
    answered++;
    if (got === actual) correct++;
    else if (misses.length < maxMisses) {
      misses.push({ name: nameOf(row), expected: actual, got });
    }
  }

  return {
    evaluated,
    answered,
    correct,
    coverage: evaluated ? answered / evaluated : 0,
    accuracy: answered ? correct / answered : 0,
    overall: evaluated ? correct / evaluated : 0,
    misses,
  };
}

export interface MultiLabelScore {
  evaluated: number;
  answered: number;
  coverage: number;
  /** Of everything proposed, the share the editor had also chosen. */
  precision: number;
  /** Of everything the editor chose, the share that was proposed. */
  recall: number;
  /** Rows where the proposed set matched the editor's exactly. */
  exact: number;
}

export function scoreMultiLabel<T>(
  rows: T[],
  actualOf: (row: T) => string[],
  predict: (row: T) => string[],
): MultiLabelScore {
  let evaluated = 0;
  let answered = 0;
  let exact = 0;
  let proposed = 0;
  let hit = 0;
  let expected = 0;

  for (const row of rows) {
    const actual = new Set(actualOf(row).filter(Boolean));
    if (!actual.size) continue;
    evaluated++;
    expected += actual.size;

    const got = predict(row);
    if (!got.length) continue;
    answered++;
    proposed += got.length;
    for (const value of got) if (actual.has(value)) hit++;
    if (got.length === actual.size && got.every((v) => actual.has(v))) exact++;
  }

  return {
    evaluated,
    answered,
    coverage: evaluated ? answered / evaluated : 0,
    precision: proposed ? hit / proposed : 0,
    recall: expected ? hit / expected : 0,
    exact,
  };
}

/* ── Nearest neighbours ───────────────────────────────────────────────────── */

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface Neighbour<T> {
  row: T;
  similarity: number;
}

/** The k most similar rows, nearest first. Rows without an embedding sit out. */
export function nearest<T>(
  embedding: number[] | null | undefined,
  pool: T[],
  embeddingOf: (row: T) => number[] | null | undefined,
  k: number,
): Neighbour<T>[] {
  if (!embedding?.length) return [];
  const scored: Neighbour<T>[] = [];
  for (const row of pool) {
    const other = embeddingOf(row);
    if (!other?.length) continue;
    scored.push({ row, similarity: cosine(embedding, other) });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}

/**
 * The value the neighbours agree on, with how strongly.
 *
 * Votes are weighted by similarity so a close match counts for more than a
 * distant one, and the returned share is what a caller thresholds on to decide
 * between filling a field and merely suggesting it.
 */
export function voteSingle<T>(
  neighbours: Neighbour<T>[],
  valueOf: (row: T) => string | null | undefined,
): { value: string; share: number } | null {
  const weights = new Map<string, number>();
  let total = 0;
  for (const { row, similarity } of neighbours) {
    const value = valueOf(row);
    if (!value) continue;
    const weight = Math.max(similarity, 0);
    weights.set(value, (weights.get(value) ?? 0) + weight);
    total += weight;
  }
  if (!total) return null;
  const [best] = [...weights.entries()].sort((a, b) => b[1] - a[1]);
  return { value: best[0], share: best[1] / total };
}

/** Every value at least `threshold` of the neighbours' weight agrees on. */
export function voteMulti<T>(
  neighbours: Neighbour<T>[],
  valuesOf: (row: T) => string[],
  threshold = 0.4,
): string[] {
  const weights = new Map<string, number>();
  let total = 0;
  for (const { row, similarity } of neighbours) {
    const weight = Math.max(similarity, 0);
    total += weight;
    for (const value of new Set(valuesOf(row).filter(Boolean))) {
      weights.set(value, (weights.get(value) ?? 0) + weight);
    }
  }
  if (!total) return [];
  return [...weights.entries()]
    .filter(([, w]) => w / total >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => value);
}
