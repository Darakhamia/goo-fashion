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
