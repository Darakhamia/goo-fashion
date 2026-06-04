/**
 * Text embeddings for the AI Stylist's semantic catalog search.
 *
 * Provider: OpenAI `text-embedding-3-small` (1536 dims), via the same key
 * resolution as the rest of the site ({@link getOpenAIKey}). Chosen over a
 * Replicate-hosted model because OpenAI embeddings have no cold start — a
 * Replicate model scales to zero and the first request after idle stalls for
 * minutes, which made live chat hang.
 *
 * Dimensions MUST match the `embedding vector(1536)` column (migration 007).
 */
import OpenAI from "openai";
import { getOpenAIKey } from "@/lib/server/get-openai-key";

const EMBED_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;
const MAX_INPUT_CHARS = 8000;

async function openaiClient(): Promise<OpenAI> {
  const apiKey = await getOpenAIKey();
  if (!apiKey) throw new Error("OpenAI API key not configured (env OPENAI_API_KEY or settings).");
  return new OpenAI({ apiKey });
}

/**
 * Embed a single string. Throws on any failure or unexpected shape — the
 * message is informative for diagnosis. Use {@link embedText} on hot paths.
 */
export async function embedTextOrThrow(text: string): Promise<number[]> {
  const clean = text.trim();
  if (!clean) throw new Error("embedText: empty text");
  const client = await openaiClient();
  const res = await client.embeddings.create({
    model: EMBED_MODEL,
    input: clean.slice(0, MAX_INPUT_CHARS),
  });
  const vec = res.data[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMS) {
    throw new Error(`embedText: got ${vec?.length ?? "no"} dims, expected ${EMBEDDING_DIMS}`);
  }
  return vec;
}

/**
 * Embed many strings in a single OpenAI call (much faster for backfill).
 * Returns vectors in the same order as the input. Throws on any failure.
 */
export async function embedTextsOrThrow(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = await openaiClient();
  const res = await client.embeddings.create({
    model: EMBED_MODEL,
    input: texts.map((t) => (t.trim() || " ").slice(0, MAX_INPUT_CHARS)),
  });
  // Re-order defensively by the returned index.
  const out: number[][] = new Array(texts.length);
  for (const item of res.data) {
    if (!Array.isArray(item.embedding) || item.embedding.length !== EMBEDDING_DIMS) {
      throw new Error(`embedTexts: bad embedding at index ${item.index}`);
    }
    out[item.index] = item.embedding;
  }
  return out;
}

/**
 * Safe wrapper: returns null on any failure so the stylist degrades to keyword
 * search instead of breaking the request. `timeoutMs` caps how long live chat
 * waits (OpenAI is fast, but this guards against a slow network / rate limit).
 */
export async function embedText(
  text: string,
  opts?: { timeoutMs?: number }
): Promise<number[] | null> {
  const run = embedTextOrThrow(text).catch((err) => {
    console.warn("[embeddings] embedText failed:", err instanceof Error ? err.message : err);
    return null;
  });
  if (!opts?.timeoutMs || opts.timeoutMs <= 0) return run;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), opts.timeoutMs);
  });
  return Promise.race([run, timeout]).finally(() => clearTimeout(timer));
}
