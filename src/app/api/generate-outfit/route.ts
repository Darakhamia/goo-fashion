import { NextResponse } from "next/server";
import Replicate from "replicate";

type Style = "mannequin" | "flatlay";

interface SlotProduct {
  slot: string;
  name: string;
  brand: string;
  category: string;
  material?: string;
  colors?: string[];
  styleKeywords?: string[];
  imageUrl?: string;
}

function buildPrompt(pieces: SlotProduct[], style: Style): string {
  const keywords = Array.from(
    new Set(pieces.flatMap((p) => p.styleKeywords ?? []))
  ).slice(0, 4);
  const styleStr = keywords.length ? `${keywords.join(", ")} aesthetic.` : "";

  const itemsList = pieces
    .map((p) => {
      const color = p.colors?.length ? `${p.colors[0]} ` : "";
      return `${color}${p.name} by ${p.brand}`;
    })
    .join(", ");

  if (style === "mannequin") {
    return [
      "Fashion editorial photography.",
      `A complete outfit on a sleek black mannequin against a deep black studio background: ${itemsList}.`,
      styleStr,
      "Use the reference product images to accurately reproduce the exact garments.",
      "Dramatic directional studio lighting, luxury fashion editorial quality.",
      "Full body shot, high resolution, photorealistic.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    "Professional flat lay fashion photography.",
    `These items arranged artfully on a pure white background photographed from directly above: ${itemsList}.`,
    styleStr,
    "Use the reference product images to accurately reproduce the exact garments.",
    "Clean even studio lighting, soft shadows, luxury fashion magazine quality.",
    "Top-down overhead view, high resolution, photorealistic.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function POST(req: Request) {
  const apiToken = process.env.REPLICATE_API_TOKEN?.trim();
  if (!apiToken) {
    return NextResponse.json(
      {
        error:
          "Replicate API token not configured. Add REPLICATE_API_TOKEN to your environment.",
      },
      { status: 501 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.pieces || !Array.isArray(body.pieces) || body.pieces.length < 1) {
    return NextResponse.json({ error: "No pieces provided." }, { status: 400 });
  }

  const pieces = body.pieces as SlotProduct[];
  const style: Style = body.style === "flatlay" ? "flatlay" : "mannequin";

  // Collect product image URLs as references (nano-banana-2 accepts up to 14)
  const imageInput = pieces
    .map((p) => p.imageUrl)
    .filter((url): url is string => !!url)
    .slice(0, 14);

  const prompt = buildPrompt(pieces, style);

  try {
    const replicate = new Replicate({ auth: apiToken });

    const output = await replicate.run("google/nano-banana-2", {
      input: {
        prompt,
        ...(imageInput.length > 0 && { image_input: imageInput }),
        aspect_ratio: "1:1",
        resolution: "1K",
        output_format: "jpg",
      },
    });

    // Replicate v1 SDK returns a FileOutput (or array) with .url() method.
    // Older models return string or string[]. Handle all shapes.
    const extractUrl = (item: unknown): string | undefined => {
      if (!item) return undefined;
      if (typeof item === "string") return item;
      const maybe = item as { url?: unknown };
      if (typeof maybe.url === "function") {
        const v = (maybe.url as () => unknown)();
        if (typeof v === "string") return v;
        if (v && typeof (v as { toString?: () => string }).toString === "function") {
          return (v as { toString: () => string }).toString();
        }
      }
      if (typeof maybe.url === "string") return maybe.url;
      return undefined;
    };

    const imageUrl = Array.isArray(output)
      ? extractUrl(output[0])
      : extractUrl(output);

    if (!imageUrl) {
      console.error("[nano-banana-2] unexpected output shape:", output);
      return NextResponse.json(
        {
          error: "No image returned from Replicate.",
          debug: { outputType: typeof output, isArray: Array.isArray(output), keys: output && typeof output === "object" ? Object.keys(output as object) : null },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl, prompt, model: "nano-banana-2", style });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Generation failed.";
    // Surface a token diagnostic so we can tell if the env var is actually reaching runtime
    const tokenHint = `${apiToken.slice(0, 5)}…(len ${apiToken.length})`;
    return NextResponse.json(
      { error: msg, tokenHint },
      { status: 500 }
    );
  }
}
