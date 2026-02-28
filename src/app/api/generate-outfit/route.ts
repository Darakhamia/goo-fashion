import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface SlotProduct {
  slot: string;
  name: string;
  brand: string;
  category: string;
  material?: string;
  colors?: string[];
  styleKeywords?: string[];
}

// Build a detailed flat-lay prompt from the selected pieces
function buildPrompt(pieces: SlotProduct[]): string {
  const itemLines = pieces.map((p) => {
    const color = p.colors?.length ? p.colors[0] : "";
    const material = p.material ? `, ${p.material}` : "";
    const colorStr = color ? `${color} ` : "";
    return `• ${colorStr}${p.name} by ${p.brand}${material}`;
  });

  const keywords = Array.from(
    new Set(pieces.flatMap((p) => p.styleKeywords ?? []))
  ).slice(0, 4);

  const styleStr = keywords.length
    ? `Style aesthetic: ${keywords.join(", ")}.`
    : "";

  return [
    "Editorial flat-lay fashion photography.",
    "Clean white background, top-down overhead view.",
    "Professional product styling, luxury fashion magazine quality.",
    "Items arranged in an artful composition with subtle shadows:",
    ...itemLines,
    styleStr,
    "Sharp detail, even studio lighting, no mannequin or model.",
    "The garments are neatly laid out as if on a flat surface.",
    "Photorealistic, high resolution.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function POST(req: Request) {
  if (!openai) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 501 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.pieces || !Array.isArray(body.pieces) || body.pieces.length < 1) {
    return NextResponse.json({ error: "No pieces provided." }, { status: 400 });
  }

  const prompt = buildPrompt(body.pieces as SlotProduct[]);

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",   // "hd" costs 2× more
      response_format: "url",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json({ error: "No image returned." }, { status: 500 });
    }

    return NextResponse.json({ imageUrl, prompt });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
