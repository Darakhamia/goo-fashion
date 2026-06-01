/**
 * Replicate AI client — LLM chat calls.
 * Model: openai/gpt-4o-mini, served THROUGH Replicate (uses the existing
 * REPLICATE_API_TOKEN — no personal OpenAI key on the site). Excellent
 * multilingual quality (incl. Russian) and reliable instruction-following.
 */
import Replicate from "replicate";

const LLM_MODEL = "openai/gpt-4o-mini";

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

  // Plain conversational prompt (no model-specific control tokens) so it works
  // with OpenAI-family models on Replicate.
  let prompt = "";
  for (const msg of opts.history) {
    const label = msg.role === "user" ? "User" : "Assistant";
    prompt += `${label}: ${msg.content}\n`;
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
