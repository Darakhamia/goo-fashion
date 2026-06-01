/**
 * Replicate AI client — LLM chat calls.
 * Model: meta/meta-llama-3.1-70b-instruct — strong multilingual (incl. Russian)
 * and far better instruction-following than the 8B model. Self-hosted Coolify
 * deploy has no 30s function timeout, so the larger model is viable.
 */
import Replicate from "replicate";

const LLM_MODEL = "meta/meta-llama-3.1-70b-instruct";

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

  // Llama-3 instruct prompt format
  let prompt = "";
  for (const msg of opts.history) {
    if (msg.role === "user") {
      prompt += `<|start_header_id|>user<|end_header_id|>\n${msg.content}<|eot_id|>\n`;
    } else {
      prompt += `<|start_header_id|>assistant<|end_header_id|>\n${msg.content}<|eot_id|>\n`;
    }
  }
  prompt += `<|start_header_id|>user<|end_header_id|>\n${opts.userMessage}<|eot_id|>\n<|start_header_id|>assistant<|end_header_id|>\n`;

  const output = await replicate.run(LLM_MODEL, {
    input: {
      prompt,
      system_prompt: opts.systemPrompt,
      max_tokens: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.7,
      top_p: 0.9,
      stop_sequences: "<|eot_id|>",
    },
  });

  // Replicate LLM output is string[] (one string per token chunk)
  if (Array.isArray(output)) return (output as string[]).join("");
  if (typeof output === "string") return output;
  throw new Error(`Unexpected Replicate output type: ${typeof output}`);
}
