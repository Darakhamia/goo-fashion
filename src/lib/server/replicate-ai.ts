/**
 * Replicate AI client — centralised LLM + embedding calls.
 *
 * LLM   : meta/meta-llama-3.1-70b-instruct  (chat responses)
 * Embed : nateraw/bge-large-en-v1.5          (1024-dim text vectors)
 */
import Replicate from "replicate";

const LLM_MODEL   = "meta/meta-llama-3.1-70b-instruct";
const EMBED_MODEL = "nateraw/bge-large-en-v1.5";

export const EMBEDDING_DIMS = 1024;

function client(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not set.");
  return new Replicate({ auth: token });
}

/**
 * Generate a 1024-dim embedding for a piece of text.
 * Used both for product indexing and for query vectorisation.
 */
export async function embedText(text: string): Promise<number[]> {
  const replicate = client();
  const output = await replicate.run(EMBED_MODEL, {
    input: { text: text.slice(0, 512) },
  });
  if (!Array.isArray(output)) {
    throw new Error(`Unexpected embedding output type: ${typeof output}`);
  }
  return output as number[];
}

/**
 * Build the text representation of a product that gets embedded.
 * Keep it short but information-dense so searches match well.
 */
export function productToEmbedText(p: {
  name: string;
  brand: string;
  category: string;
  description?: string;
  styleKeywords?: string[];
  priceMin?: number;
}): string {
  const parts = [
    `${p.name} by ${p.brand}`,
    p.category,
    p.description ?? "",
    (p.styleKeywords ?? []).join(" "),
    p.priceMin != null ? `$${p.priceMin}` : "",
  ];
  return parts.filter(Boolean).join(". ");
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Call the Replicate LLM and return the complete text response.
 * Conversation history is serialised into the prompt (Llama-3 format).
 */
export async function chatCompletion(opts: {
  systemPrompt: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const replicate = client();

  // Build a prompt string in Llama-3 instruct format
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

  if (Array.isArray(output)) return (output as string[]).join("");
  return String(output);
}
