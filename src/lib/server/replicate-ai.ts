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

export async function chatCompletion(opts: {
  systemPrompt: string;
  history: ChatTurn[];
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const replicate = client();

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
    const output = await replicate.run(LLM_MODEL, {
      input: { ...shared, messages },
    });
    return normalizeOutput(output);
  } catch (err) {
    // Model schema may not support `messages` (e.g. a non-OpenAI model set via
    // STYLIST_LLM_MODEL). Retry once with the flattened-transcript contract.
    console.warn(
      "[replicate-ai] structured messages call failed, falling back to flattened prompt:",
      err instanceof Error ? err.message : err
    );
    const output = await replicate.run(LLM_MODEL, {
      input: {
        ...shared,
        prompt: flattenPrompt(opts.history, opts.userMessage),
        system_prompt: opts.systemPrompt,
      },
    });
    return normalizeOutput(output);
  }
}
