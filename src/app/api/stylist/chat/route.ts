import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { getAllProducts } from "@/lib/data/db";
import type { Product } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────────

interface OutfitPiece {
  slot: string;
  productId: string;
  name: string;
  brand: string;
  priceMin: number;
  styleKeywords: string[];
  category: string;
}

interface StylistChatRequest {
  userMessage: string;
  // Full prior turns (not including userMessage) — optional for multi-turn
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  // Builder outfit selection
  currentOutfit?: Partial<Record<string, OutfitPiece | null>>;
  // Page surface hint
  surface?: "builder" | "browse" | "product";
}

interface StylistChatResponse {
  reply: string;
  suggestedProductIds: string[];
  styleKeywords: string[];
}

// ── Catalog summary builder ───────────────────────────────────────────────────

// Builds a compact, token-efficient product list for injection into the system prompt.
// Only primary/ungrouped products are included to avoid duplicate variant entries.
// Fields: id · name · brand · category · price · styleKeywords
function buildCatalogSummary(products: Product[], limit = 100): string {
  const lines = products
    .filter((p) => p.isGroupPrimary !== false) // keep primary + ungrouped, skip non-primary variants
    .slice(0, limit)
    .map((p) => {
      const keywords = p.styleKeywords.join(", ");
      return `${p.id} | ${p.name} | ${p.brand} | ${p.category} | $${p.priceMin} | ${keywords}`;
    });

  return lines.join("\n");
}

// ── Outfit context block ──────────────────────────────────────────────────────

function buildOutfitContext(outfit?: Partial<Record<string, OutfitPiece | null>>): string {
  if (!outfit) return "Current outfit: empty — user is starting fresh.";

  const pieces = Object.values(outfit).filter((p): p is OutfitPiece => p != null);
  if (pieces.length === 0) return "Current outfit: empty — user is starting fresh.";

  const totalPrice = pieces.reduce((sum, p) => sum + p.priceMin, 0);
  const allKeywords = Array.from(new Set(pieces.flatMap((p) => p.styleKeywords)));

  const lines = pieces.map(
    (p) =>
      `- ${p.slot}: ${p.name} by ${p.brand} ($${p.priceMin}) [${p.styleKeywords.join(", ")}]`
  );

  return [
    "Current outfit:",
    ...lines,
    `Style profile: ${allKeywords.join(", ")}`,
    `Total so far: $${totalPrice.toLocaleString()}`,
  ].join("\n");
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(catalogSummary: string, outfitContext: string): string {
  return `You are the AI Stylist for GOO, a curated luxury and contemporary fashion platform.
Your role is to help users build outfits, discover pieces, and understand how to style them.

PERSONALITY:
- Confident but approachable. You have strong taste and can explain your reasoning briefly.
- Concise. Keep replies to 1–3 sentences. Never lecture or pad with filler.
- Specific. Reference the user's actual outfit when it exists.
- Warm but editorial — like a knowledgeable friend who works in fashion.

RULES:
1. ONLY recommend products from the GOO catalog listed below. Never invent names, brands, or IDs.
2. If no catalog product matches the request, say so honestly and redirect to the closest available option.
3. Do not repeat items already in the outfit unless commenting on them specifically.
4. At the end of every reply, include a JSON block in exactly this format:
\`\`\`json
{"suggestedProductIds":["id1","id2"],"styleKeywords":["minimal","classic"]}
\`\`\`
5. Use only IDs from the catalog below. Use only these style keywords: minimal, streetwear, classic, avant-garde, romantic, utilitarian, bohemian, preppy, sporty, dark, maximalist, coastal, academic.
6. If you have no specific product suggestions, use empty arrays: {"suggestedProductIds":[],"styleKeywords":[]}.
7. The JSON block must appear at the very end of your message, on its own line. Do not explain it.

${outfitContext}

AVAILABLE CATALOG (id | name | brand | category | price | style keywords):
${catalogSummary}`;
}

// ── JSON block extractor ──────────────────────────────────────────────────────

interface ParsedBlock {
  suggestedProductIds: string[];
  styleKeywords: string[];
}

function extractJsonBlock(text: string): { clean: string; parsed: ParsedBlock } {
  const empty: ParsedBlock = { suggestedProductIds: [], styleKeywords: [] };

  // Match a ```json ... ``` fenced block
  const fenceMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    const clean = text.replace(/```json[\s\S]*?```/g, "").trim();
    try {
      const obj = JSON.parse(fenceMatch[1]);
      return {
        clean,
        parsed: {
          suggestedProductIds: Array.isArray(obj.suggestedProductIds) ? obj.suggestedProductIds : [],
          styleKeywords: Array.isArray(obj.styleKeywords) ? obj.styleKeywords : [],
        },
      };
    } catch {
      return { clean, parsed: empty };
    }
  }

  // Fallback: try to find a raw JSON object at the end of the text
  const rawMatch = text.match(/\{[^{}]*"suggestedProductIds"[^{}]*\}\s*$/s);
  if (rawMatch) {
    const clean = text.slice(0, text.lastIndexOf(rawMatch[0])).trim();
    try {
      const obj = JSON.parse(rawMatch[0]);
      return {
        clean,
        parsed: {
          suggestedProductIds: Array.isArray(obj.suggestedProductIds) ? obj.suggestedProductIds : [],
          styleKeywords: Array.isArray(obj.styleKeywords) ? obj.styleKeywords : [],
        },
      };
    } catch {
      return { clean, parsed: empty };
    }
  }

  // No JSON found — return the full text unchanged
  return { clean: text.trim(), parsed: empty };
}

// ── Validation: strip hallucinated IDs ────────────────────────────────────────

// Ensures returned IDs actually exist in the catalog. Removes any the model invented.
function validateProductIds(ids: string[], catalogIds: Set<string>): string[] {
  return ids.filter((id) => catalogIds.has(id)).slice(0, 6);
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── Key resolution ────────────────────────────────────────────────────────
  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI Stylist is not configured. An admin needs to add an OpenAI API key in Settings." },
      { status: 501 }
    );
  }

  // ── Parse request ─────────────────────────────────────────────────────────
  const body = await req.json().catch(() => null) as StylistChatRequest | null;
  if (!body?.userMessage?.trim()) {
    return NextResponse.json({ error: "userMessage is required" }, { status: 400 });
  }

  const { userMessage, conversationHistory = [], currentOutfit } = body;

  // ── Load catalog ──────────────────────────────────────────────────────────
  const products = await getAllProducts();
  const catalogIds = new Set(products.map((p) => p.id));
  const catalogSummary = buildCatalogSummary(products, 100);

  // ── Build prompts ─────────────────────────────────────────────────────────
  const outfitContext = buildOutfitContext(currentOutfit ?? undefined);
  const systemPrompt = buildSystemPrompt(catalogSummary, outfitContext);

  // ── Assemble message history ──────────────────────────────────────────────
  // Filter out stale suggestion content from prior assistant turns —
  // only the text portion matters for conversation continuity.
  const priorMessages: OpenAI.Chat.ChatCompletionMessageParam[] = conversationHistory
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  // System prompt is the first message in the array — standard chat completions format
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...priorMessages,
    { role: "user", content: userMessage.trim() },
  ];

  // ── Call OpenAI ───────────────────────────────────────────────────────────
  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 400,
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    if (!raw) {
      return NextResponse.json<StylistChatResponse>({
        reply: "I couldn't come up with a response right now. Try asking again.",
        suggestedProductIds: [],
        styleKeywords: [],
      });
    }

    // ── Extract structured block ──────────────────────────────────────────
    const { clean: reply, parsed } = extractJsonBlock(raw);

    // Validate IDs against real catalog (removes hallucinations)
    const suggestedProductIds = validateProductIds(parsed.suggestedProductIds, catalogIds);
    const styleKeywords = parsed.styleKeywords.slice(0, 5);

    // Guard against empty reply after stripping JSON
    const finalReply = reply.trim() || "Here are some options that might work for your look.";

    return NextResponse.json<StylistChatResponse>({
      reply: finalReply,
      suggestedProductIds,
      styleKeywords,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[stylist/chat]", msg);
    return NextResponse.json(
      { error: `OpenAI request failed: ${msg}` },
      { status: 502 }
    );
  }
}
