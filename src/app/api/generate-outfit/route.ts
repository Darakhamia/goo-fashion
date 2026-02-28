import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";

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
  imageUrl?: string;
}

// Prompt for gpt-image-1 when we have visual references
function buildReferencePrompt(pieces: SlotProduct[]): string {
  const keywords = Array.from(
    new Set(pieces.flatMap((p) => p.styleKeywords ?? []))
  ).slice(0, 4);
  const styleStr = keywords.length ? `${keywords.join(", ")} aesthetic.` : "";

  return [
    "Editorial flat-lay fashion photography.",
    "Recreate the exact clothing and accessories shown in the reference product images.",
    "Arrange all items together in an artful composition on a clean white background, top-down overhead view.",
    styleStr,
    "Professional product styling, luxury fashion magazine quality.",
    "Sharp detail, even studio lighting, subtle shadows, no mannequin or model.",
    "Photorealistic, high resolution.",
  ]
    .filter(Boolean)
    .join(" ");
}

// Detailed text prompt for DALL-E 3 fallback
function buildTextPrompt(pieces: SlotProduct[]): string {
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

// Fetch a product image URL and return an OpenAI-ready File object
async function fetchImageFile(
  url: string,
  index: number
): Promise<Awaited<ReturnType<typeof toFile>> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    // Skip images over 5 MB
    if (buf.byteLength > 5 * 1024 * 1024) return null;

    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
      ? "webp"
      : "jpg";
    return await toFile(buf, `ref-${index}.${ext}`, { type: contentType });
  } catch {
    clearTimeout(timer);
    return null;
  }
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

  const pieces = body.pieces as SlotProduct[];

  // ── Try gpt-image-1 with product reference images ──────────────────────────
  const pieceUrls = pieces
    .map((p, i) => ({ url: p.imageUrl, i }))
    .filter((x): x is { url: string; i: number } => !!x.url);

  if (pieceUrls.length > 0) {
    const fetchedFiles = await Promise.all(
      pieceUrls.map(({ url, i }) => fetchImageFile(url, i))
    );
    const validFiles = fetchedFiles.filter(
      (f): f is NonNullable<typeof f> => f !== null
    );

    if (validFiles.length > 0) {
      try {
        const prompt = buildReferencePrompt(pieces);
        // gpt-image-1 accepts an array of reference images via images.edit.
        // input_fidelity: 'high' makes it closely match the reference product photos.
        // size is omitted — let the model default to its native resolution.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imageArg = (validFiles.length === 1 ? validFiles[0] : validFiles) as any;
        const response = await openai.images.edit({
          model: "gpt-image-1",
          image: imageArg,
          prompt,
          input_fidelity: "high",
          n: 1,
        });

        const imgData = response.data?.[0];
        console.log("[gpt-image-1] response keys:", Object.keys(imgData ?? {}));
        if (imgData?.b64_json) {
          return NextResponse.json({
            imageUrl: `data:image/png;base64,${imgData.b64_json}`,
            prompt,
            model: "gpt-image-1",
          });
        }
        if (imgData?.url) {
          return NextResponse.json({
            imageUrl: imgData.url,
            prompt,
            model: "gpt-image-1",
          });
        }
        console.warn("[gpt-image-1] no image data in response, falling back");
      } catch (err) {
        // Log the reason and fall through to DALL-E 3
        console.error(
          "[gpt-image-1] failed, falling back to DALL-E 3:",
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  // ── Fallback: DALL-E 3 text-only ───────────────────────────────────────────
  const prompt = buildTextPrompt(pieces);
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json({ error: "No image returned." }, { status: 500 });
    }

    return NextResponse.json({ imageUrl, prompt, model: "dall-e-3" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
