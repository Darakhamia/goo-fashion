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
  colorName?: string;
  styleKeywords?: string[];
  imageUrl?: string;
}

// Browser-like headers to bypass hotlink protection on merchant sites
function browserHeaders(url: string): Record<string, string> {
  let referer = "";
  try {
    referer = new URL(url).origin + "/";
  } catch {
    /* ignore */
  }
  return {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    ...(referer && { Referer: referer }),
  };
}

async function fetchBuffer(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 10_000
): Promise<{ buf: Buffer; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timer);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 8 * 1024 * 1024) return null;
    return { buf, contentType };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// Fetch with browser headers, fall back to the images.weserv.nl proxy
async function fetchAsDataUri(
  url: string
): Promise<{ ok: true; dataUri: string } | { ok: false; url: string; reason: string }> {
  // 1. direct with browser headers
  const direct = await fetchBuffer(url, browserHeaders(url));
  if (direct) {
    return {
      ok: true,
      dataUri: `data:${direct.contentType};base64,${direct.buf.toString("base64")}`,
    };
  }

  // 2. proxy via images.weserv.nl (strips protocol, handles hotlink-protected sources)
  try {
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(
      url.replace(/^https?:\/\//, "")
    )}`;
    const proxied = await fetchBuffer(proxyUrl, {
      "User-Agent": "goo-fashion/1.0",
      Accept: "image/*",
    });
    if (proxied) {
      return {
        ok: true,
        dataUri: `data:${proxied.contentType};base64,${proxied.buf.toString("base64")}`,
      };
    }
  } catch {
    /* fall through */
  }

  return { ok: false, url, reason: "all fetch attempts failed" };
}

function buildPrompt(pieces: SlotProduct[], style: Style): string {
  const keywords = Array.from(
    new Set(pieces.flatMap((p) => p.styleKeywords ?? []))
  ).slice(0, 4);
  const styleStr = keywords.length ? `${keywords.join(", ")} aesthetic.` : "";

  const itemsList = pieces
    .map((p) => {
      // Prefer the selected variant color name over the primary colors list
      const color = p.colorName ?? (p.colors?.length ? p.colors[0] : "");
      const colorStr = color ? `${color} ` : "";
      return `${colorStr}${p.name} by ${p.brand}`;
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

  // Collect raw URLs (nano-banana-2 accepts up to 14 references)
  const rawUrls = pieces
    .map((p) => p.imageUrl)
    .filter((url): url is string => !!url)
    .slice(0, 14);

  // Fetch each image server-side and convert to base64 data-URIs.
  // This prevents Replicate from hitting merchant sites that block hotlinking.
  const fetched = await Promise.all(rawUrls.map(fetchAsDataUri));
  const imageInput = fetched
    .filter((r): r is { ok: true; dataUri: string } => r.ok)
    .map((r) => r.dataUri);
  const failedUrls = fetched
    .filter((r): r is { ok: false; url: string; reason: string } => !r.ok)
    .map((r) => r.url);

  if (failedUrls.length > 0) {
    console.warn("[generate-outfit] failed to fetch reference images:", failedUrls);
  }

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
          debug: {
            outputType: typeof output,
            isArray: Array.isArray(output),
            keys:
              output && typeof output === "object"
                ? Object.keys(output as object)
                : null,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageUrl,
      prompt,
      model: "nano-banana-2",
      style,
      referencesUsed: imageInput.length,
      referencesFailed: failedUrls.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Generation failed.";
    const tokenHint = `${apiToken.slice(0, 5)}…(len ${apiToken.length})`;
    return NextResponse.json(
      { error: msg, tokenHint, failedUrls },
      { status: 500 }
    );
  }
}

