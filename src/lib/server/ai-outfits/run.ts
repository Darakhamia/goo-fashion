/**
 * One run of the AI outfit generator, from a brief to looks in the queue.
 *
 *   1. candidates   the brief's pieces, a short list per slot (candidates.ts)
 *   2. plan         the model puts outfits together and names them (model.ts)
 *   3. check        each outfit kept or refused (validate.ts); refused ones go
 *                   back to the model with the reason, for one more round
 *   4. words        names and descriptions tidied or replaced (copy.ts)
 *   5. picture      each kept outfit drawn by the image model (outfit-image.ts)
 *   6. queue        each lands in Pending as a submitted look marked as the
 *                   AI's (`ai_meta`), where an admin approves it or not
 *
 * What it talks to — the model, the image model, the database — comes in as
 * `deps`, so the whole run can be exercised without any of them.
 */
import type { ColorGroup, Gender, Product, Season, StyleKeyword } from "@/lib/types";
import { genderOfPieces } from "@/lib/outfit-gender";
import type { ImageStyle, OutfitImageResult, SlotProduct } from "@/lib/server/outfit-image";
import { buildCandidates, poolProblem, randomSource, type GenerationBrief } from "./candidates";
import { checkOutfit, signature, type CheckedOutfit } from "./validate";
import { checkCopy, type CopyNote } from "./copy";
import { builderSlots, familyOfGroup, type ColourFamily } from "./pieces";
import type { ModelOutfit, ModelUsage, PlanRequest } from "./model";

/** Most outfits one run makes. Each is a picture; ten is a few minutes and a few dollars. */
export const MAX_OUTFITS = 10;
/** Model rounds per run: the first, and one more for what the checks refused. */
const ROUNDS = 2;
/** Outfits asked for beyond what is still needed, since some are refused. */
const SPARE = 2;
/** Pictures drawn at the same time. */
const DRAW_AT_ONCE = 2;

export interface RunInput {
  count: number;
  styles: StyleKeyword[];
  colorGroupIds: number[];
  brands: string[];
  gender: "women" | "men" | null;
  imageStyle: Exclude<ImageStyle, "tryon">;
}

/** What a generated look carries beside the usual submission, in `pending_looks.ai_meta`. */
export interface AiMeta {
  runId: string;
  model: string;
  /** The model's note for the moderator: why the pieces go together. */
  notes: string;
  palette: string[];
  brief: { styles: string[]; colours: string[]; brands: string[]; gender: string | null };
  /** What was changed in the words, and why (copy.ts). */
  copy: CopyNote[];
  /** Set when the picture could not be drawn; the look is queued without one. */
  imageError?: string;
}

/** A look for the queue, in `pending_looks` columns. */
export interface QueuedLook {
  generated_image: string | null;
  generated_style: string;
  pieces: { slot: string; productId: string; variantId: null; imageUrl: string; name: string }[];
  total_price: number;
  style_keywords: string[];
  seasons: Season[];
  /** The brief's, else what the pieces add up to. */
  gender: Gender;
  name: string;
  description: string;
  ai_meta: AiMeta;
}

export interface RunDeps {
  runId: string;
  products: Product[];
  colorGroups: ColorGroup[];
  /** Piece sets of the catalogue's outfits and the queue's looks. */
  existingSignatures: Set<string>;
  /** Names of the catalogue's outfits and the queue's looks, lower case. */
  existingNames: Set<string>;
  seed: number;
  modelName: string;
  plan: (req: PlanRequest) => Promise<{ outfits: ModelOutfit[]; usage: ModelUsage }>;
  draw: (pieces: SlotProduct[], style: ImageStyle) => Promise<OutfitImageResult>;
  toUsd: (amount: number, currency: string) => Promise<number>;
  queue: (look: QueuedLook) => Promise<void>;
  /** Progress for the studio: a line of the log, and the counts so far. */
  report: (update: { message?: string; made?: number; failed?: number; costUsd?: number }) => Promise<void>;
}

export interface RunResult {
  made: number;
  failed: number;
  refused: number;
  costUsd: number;
  error?: string;
}

/** The brief in the generator's terms: colour groups as colour families. */
export function briefFrom(input: RunInput, colorGroups: ColorGroup[]): GenerationBrief {
  const families = new Set<ColourFamily>();
  for (const id of input.colorGroupIds) {
    const group = colorGroups.find((g) => g.id === id);
    const family = group && familyOfGroup(group);
    if (family) families.add(family);
  }
  return {
    count: Math.max(1, Math.min(MAX_OUTFITS, Math.round(input.count))),
    styles: input.styles,
    colours: [...families],
    brands: input.brands,
    gender: input.gender,
  };
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(work));
}

export async function runGeneration(input: RunInput, deps: RunDeps): Promise<RunResult> {
  const brief = briefFrom(input, deps.colorGroups);
  const random = randomSource(deps.seed);
  const pool = buildCandidates(deps.products, deps.colorGroups, brief, random);
  const problem = poolProblem(pool, brief);
  if (problem) {
    await deps.report({ message: problem });
    return { made: 0, failed: 0, refused: 0, costUsd: 0, error: problem };
  }
  await deps.report({
    message: `Chose ${pool.candidates.length} candidate pieces (of ${Object.values(pool.matching).reduce((a, b) => a + b, 0)} that fit the brief).`,
  });

  // ── Plan and check, in up to two rounds ──
  const keyOf = new Map(pool.candidates.map((c) => [c.product.id, c.key]));
  const kept: CheckedOutfit[] = [];
  const feedback: string[] = [];
  let refused = 0;
  let costUsd = 0;
  for (let round = 0; round < ROUNDS && kept.length < brief.count; round++) {
    const wanted = brief.count - kept.length;
    const avoid = kept.map((o) => o.pieces.map((p) => p.key));
    let reply: { outfits: ModelOutfit[]; usage: ModelUsage };
    try {
      reply = await deps.plan({ brief, candidates: pool.candidates, count: wanted + SPARE, feedback, avoid });
    } catch (err) {
      const message = `The model call failed: ${err instanceof Error ? err.message : String(err)}`;
      await deps.report({ message });
      if (!kept.length) return { made: 0, failed: 0, refused, costUsd, error: message };
      break;
    }
    costUsd += reply.usage.costUsd;
    await deps.report({ costUsd });

    for (const proposal of reply.outfits) {
      if (kept.length >= brief.count) break;
      const verdict = checkOutfit(proposal, { pool, brief, existing: deps.existingSignatures, kept });
      if (verdict.ok) kept.push(verdict.outfit);
      else {
        refused++;
        const label = String(proposal.name ?? "").trim() || "an outfit";
        feedback.push(`"${label.slice(0, 40)}": ${verdict.reason}`);
      }
    }
    await deps.report({
      message: `Round ${round + 1}: ${reply.outfits.length} proposed, ${kept.length} of ${brief.count} kept so far.`,
    });
  }
  // Every refusal, for the log: the model's mistakes are worth seeing.
  for (const f of feedback) await deps.report({ message: `Refused ${f}` });
  if (!kept.length) {
    const error = "The model proposed no outfit that passed the checks.";
    await deps.report({ message: error });
    return { made: 0, failed: 0, refused, costUsd, error };
  }

  // ── Words, picture, queue ──
  const knownBrands = [...new Set(deps.products.map((p) => p.brand).filter(Boolean))].sort((a, b) => b.length - a.length);
  const takenNames = new Set(deps.existingNames);
  const ready = kept.map((outfit) => {
    const copy = checkCopy(outfit, { knownBrands, takenNames });
    takenNames.add(copy.name.toLowerCase());
    return { outfit, copy };
  });

  let made = 0;
  let failed = 0;
  await inBatches(ready, DRAW_AT_ONCE, async ({ outfit, copy }) => {
    const slots = builderSlots(outfit.pieces.map((p) => p.slot));
    const imagePieces: SlotProduct[] = outfit.pieces.map((p, i) => ({
      slot: slots[i],
      name: p.product.name,
      brand: p.product.brand,
      category: p.product.category,
      material: p.product.material || undefined,
      colors: p.product.colors,
      styleKeywords: p.product.styleKeywords,
      imageUrl: p.product.imageUrl,
    }));

    // One retry: a picture fails more often for a passing reason than a lasting one.
    let image = await deps.draw(imagePieces, input.imageStyle);
    if (!image.ok) image = await deps.draw(imagePieces, input.imageStyle);

    let total = 0;
    for (const p of outfit.pieces) total += await deps.toUsd(p.product.priceMin, p.product.currency || "USD");

    const look: QueuedLook = {
      generated_image: image.ok ? image.imageUrl : null,
      generated_style: input.imageStyle,
      pieces: outfit.pieces.map((p, i) => ({
        slot: slots[i],
        productId: p.product.id,
        variantId: null,
        imageUrl: p.product.imageUrl,
        name: p.product.name,
      })),
      total_price: Math.round(total * 100) / 100,
      style_keywords: outfit.styles,
      seasons: outfit.seasons,
      gender: brief.gender ?? genderOfPieces(outfit.pieces.map((p) => p.product.gender)),
      name: copy.name,
      description: copy.description,
      ai_meta: {
        runId: deps.runId,
        model: deps.modelName,
        notes: outfit.notes,
        palette: outfit.palette,
        brief: { styles: brief.styles, colours: brief.colours, brands: brief.brands, gender: brief.gender },
        copy: copy.notes,
        ...(!image.ok && { imageError: image.error }),
      },
    };

    try {
      await deps.queue(look);
      made++;
      const replaced = copy.notes.filter((n) => n.action === "replaced").map((n) => `${n.field}: ${n.problem}`);
      await deps.report({
        made,
        message:
          `Queued "${copy.name}" (${outfit.pieces.map((p) => keyOf.get(p.product.id)).join(" + ")})` +
          (image.ok ? "" : ` without a picture: ${image.error}`) +
          (replaced.length ? `. Standard wording used — ${replaced.join("; ")}` : ""),
      });
    } catch (err) {
      failed++;
      await deps.report({ failed, message: `Could not queue "${copy.name}": ${err instanceof Error ? err.message : String(err)}` });
    }
  });

  return { made, failed, refused, costUsd };
}

/** The piece set of a stored outfit or look, as `existingSignatures` holds it. */
export function signatureOf(productIds: (string | undefined | null)[]): string {
  return signature(productIds.filter((id): id is string => typeof id === "string" && id.length > 0));
}
