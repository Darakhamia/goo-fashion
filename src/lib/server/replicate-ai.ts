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

// A chat reply is waited on by a person. When Replicate is queueing (cold
// start, overload) a call would otherwise hang for minutes while the user
// retries, and every retry is another billed prediction.
const CHAT_TIMEOUT_MS = 30_000;

function client(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not set.");
  return new Replicate({ auth: token });
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

function normalizeOutput(output: unknown): string {
  // Replicate LLM output is string[] (one string per token chunk) or a string.
  if (Array.isArray(output)) return (output as string[]).join("");
  if (typeof output === "string") return output;
  throw new Error(`Unexpected Replicate output type: ${typeof output}`);
}

/**
 * Fallback rendering for models that don't accept structured `messages`:
 * a plain-text transcript. Newlines inside each turn are collapsed so user
 * text can never start a line with a forged "Assistant:" / "System:" label
 * and rewrite the conversation.
 */
function flattenPrompt(history: ChatTurn[], userMessage: string): string {
  const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
  let prompt = "";
  if (history.length > 0) {
    prompt += "Conversation so far:\n";
    for (const msg of history) {
      const label = msg.role === "user" ? "User" : "Assistant";
      prompt += `${label}: ${oneLine(msg.content)}\n`;
    }
    prompt += "\n";
  }
  prompt += `User: ${oneLine(userMessage)}\nAssistant:`;
  return prompt;
}

/**
 * `replicate.run` that stops when `signal` fires. The SDK (1.4) only looks at
 * the signal between polls: its first request blocks for up to 60 s under
 * `Prefer: wait` regardless, and on abort it cancels the prediction and
 * *returns* whatever the cancelled prediction holds instead of throwing. So the
 * abort is raced here, and the SDK finishes the cancel in the background once
 * it has the prediction's id.
 */
async function runUntil(
  replicate: Replicate,
  input: object,
  signal: AbortSignal,
): Promise<object> {
  signal.throwIfAborted();
  let onAbort = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([replicate.run(LLM_MODEL, { input, signal }), aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export async function chatCompletion(opts: {
  systemPrompt: string;
  history: ChatTurn[];
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
  /** Aborts the call and cancels the prediction, e.g. the request's own signal. */
  signal?: AbortSignal;
  /** Budget for the whole completion, fallback call included. */
  timeoutMs?: number;
}): Promise<string> {
  const replicate = client();
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? CHAT_TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  const shared = {
    max_completion_tokens: opts.maxTokens ?? 600,
    temperature: opts.temperature ?? 0.6,
  };

  // Preferred path: structured chat messages. Replicate's OpenAI-family models
  // accept a `messages` array (which overrides prompt/system_prompt). Real role
  // separation makes the model track multi-turn context far more reliably than
  // a flattened transcript, and user text can't impersonate other roles.
  const messages = [
    { role: "system", content: opts.systemPrompt },
    ...opts.history,
    { role: "user", content: opts.userMessage },
  ];

  try {
    const output = await runUntil(replicate, { ...shared, messages }, signal);
    return normalizeOutput(output);
  } catch (err) {
    // A timeout or a client that went away says nothing about the schema: a
    // second call would only start, and bill, a prediction nobody waits for.
    if (signal.aborted) throw err;
    // Model schema may not support `messages` (e.g. a non-OpenAI model set via
    // STYLIST_LLM_MODEL). Retry once with the flattened-transcript contract.
    console.warn(
      "[replicate-ai] structured messages call failed, falling back to flattened prompt:",
      err instanceof Error ? err.message : err
    );
    const output = await runUntil(
      replicate,
      {
        ...shared,
        prompt: flattenPrompt(opts.history, opts.userMessage),
        system_prompt: opts.systemPrompt,
      },
      signal,
    );
    return normalizeOutput(output);
  }
}
