/**
 * Replicate AI client — LLM chat calls.
 * Model: openai/gpt-4.1, served THROUGH Replicate (uses the existing
 * REPLICATE_API_TOKEN — no personal OpenAI key on the site). Stronger
 * instruction-following than 4o-mini, excellent multilingual quality (incl.
 * Russian). Override the model without a deploy via STYLIST_LLM_MODEL.
 */
import Replicate from "replicate";

const DEFAULT_LLM_MODEL = "openai/gpt-4.1";
const LLM_MODEL = (process.env.STYLIST_LLM_MODEL?.trim() ||
  DEFAULT_LLM_MODEL) as `${string}/${string}`;

function client(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not set.");
  return new Replicate({ auth: token });
}

export async function chatCompletion(opts: {
  systemPrompt: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const replicate = client();

  // Replicate's OpenAI-family models take a single `prompt` string plus a
  // separate `system_prompt`. We render the turn-by-turn history with explicit
  // role labels and a clear boundary so the model treats it as a transcript to
  // continue rather than text to paraphrase. The trailing "Assistant:" cues it
  // to produce only the next reply.
  let prompt = "";
  if (opts.history.length > 0) {
    prompt += "Conversation so far:\n";
    for (const msg of opts.history) {
      const label = msg.role === "user" ? "User" : "Assistant";
      prompt += `${label}: ${msg.content}\n`;
    }
    prompt += "\n";
  }
  prompt += `User: ${opts.userMessage}\nAssistant:`;

  const output = await replicate.run(LLM_MODEL, {
    input: {
      prompt,
      system_prompt: opts.systemPrompt,
      max_completion_tokens: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.6,
    },
  });

  // Replicate LLM output is string[] (one string per token chunk) or a string.
  if (Array.isArray(output)) return (output as string[]).join("");
  if (typeof output === "string") return output;
  throw new Error(`Unexpected Replicate output type: ${typeof output}`);
}

// ── Embeddings ────────────────────────────────────────────────────────────────

/** Embedding model + dimensions. Must match migration 005 (vector(1024)). */
const EMBED_MODEL = "nateraw/bge-large-en-v1.5";
// Community models on Replicate must be pinned to a version hash.
const EMBED_VERSION = "9cf9f015a9cb9c61d1a2610659cdac4a4ca222f2d3707a68517b18c198a9add1";
export const EMBEDDING_DIMS = 1024;

/**
 * Embed text into a 1024-dim vector via Replicate (BGE-large). Throws on any
 * failure or unexpected shape — the thrown message includes a sample of the
 * raw output so callers can diagnose. Use {@link embedText} for the safe,
 * null-returning variant in hot paths.
 */
export async function embedTextOrThrow(text: string): Promise<number[]> {
  const clean = text.trim();
  if (!clean) throw new Error("embedText: empty text");
  const replicate = client();
  const output = await replicate.run(
    `${EMBED_MODEL}:${EMBED_VERSION}` as `${string}/${string}:${string}`,
    {
      input: {
        texts: JSON.stringify([clean.slice(0, 4000)]),
        convert_to_numpy: false,
        normalize_embeddings: true,
      },
    }
  );
  const vec = extractEmbedding(output);
  if (!vec) {
    throw new Error(
      `embedText: unexpected output shape: ${JSON.stringify(output).slice(0, 200)}`
    );
  }
  if (vec.length !== EMBEDDING_DIMS) {
    throw new Error(`embedText: got ${vec.length} dims, expected ${EMBEDDING_DIMS}`);
  }
  return vec;
}

/**
 * Safe wrapper around {@link embedTextOrThrow}: returns null on any failure so
 * the stylist degrades to keyword search instead of breaking the request.
 *
 * Pass `timeoutMs` in latency-sensitive paths (e.g. live chat): the BGE model
 * on Replicate scales to zero, so the first request after idle cold-starts and
 * can take minutes. With a timeout we stop waiting and fall back to keyword
 * search; the prediction still finishes in the background and warms the model
 * for next time.
 */
export async function embedText(
  text: string,
  opts?: { timeoutMs?: number }
): Promise<number[] | null> {
  const run = embedTextOrThrow(text).catch((err) => {
    console.warn("[replicate-ai] embedText failed:", err instanceof Error ? err.message : err);
    return null;
  });
  if (!opts?.timeoutMs || opts.timeoutMs <= 0) return run;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), opts.timeoutMs);
  });
  return Promise.race([run, timeout]).finally(() => clearTimeout(timer));
}

/**
 * BGE on Replicate returns one embedding per input text. Depending on the model
 * version that arrives as number[][], { embedding: number[] }[], or a bare
 * number[]. Normalise all shapes to the first embedding vector.
 */
function extractEmbedding(output: unknown): number[] | null {
  if (!Array.isArray(output) || output.length === 0) return null;
  const first = output[0];
  if (typeof first === "number") return output as number[];
  if (Array.isArray(first)) return first as number[];
  if (first && typeof first === "object" && Array.isArray((first as { embedding?: unknown }).embedding)) {
    return (first as { embedding: number[] }).embedding;
  }
  return null;
}
