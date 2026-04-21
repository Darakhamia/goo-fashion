import { NextResponse } from "next/server";
import Replicate from "replicate";
import { requirePlan } from "@/lib/server/require-plan";
import { isSupabaseConfigured } from "@/lib/supabase";
import { uploadGeneratedImage } from "@/lib/storage";

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
  const itemsList = pieces
    .map((p, i) => {
      const color = p.colorName ?? (p.colors?.length ? p.colors[0] : "");
      const colorStr = color ? `${color} ` : "";
      const material = p.material ? `, ${p.material}` : "";
      return `(${i + 1}) ${p.slot}: ${colorStr}${p.name} by ${p.brand}${material}`;
    })
    .join("; ");

  // Fidelity block — logos and branding must survive.
  const fidelity = [
    "CRITICAL FIDELITY: Reproduce every garment EXACTLY as shown in the corresponding reference image.",
    "Match silhouette, cut, fabric texture, drape, color, pattern, print, stitching, buttons, zippers, and hardware precisely.",
    "LOGOS AND BRANDING: Preserve ALL logos, wordmarks, graphic prints, text, and emblems EXACTLY as they appear in the reference images — do not simplify, replace, blur, or omit any logo or text. If a logo is on the chest, it must appear on the chest. If there is a brand name on the shoe, it must be legible.",
    "Do not invent, substitute, restyle, or add any item not in the references.",
  ].join(" ");

  if (style === "mannequin") {
    return [
      "Luxury fashion ecommerce photograph. Full-body shot of a faceless matte black mannequin (sleek, no facial features) wearing the following outfit, head to toe:",
      itemsList + ".",
      "Garment layering: outerwear is worn over the top (open or unzipped to reveal the top underneath); bottom worn on the legs; shoes on the feet; bags on the shoulder or crossbody — never floating.",
      fidelity,
      "BACKGROUND: Pure clean white seamless studio infinity cove — floor and wall blend into a single unbroken white. No props, no texture, no gradient, no shadow on the wall. Only a soft natural contact shadow directly beneath the mannequin's feet on the floor.",
      "Lighting: soft diffused frontal studio light, no harsh shadows. The focus is entirely on the clothes.",
      "Framing: full-body centered front view, entire figure head to toe visible with even breathing room on all sides. Square 1:1 frame. Photorealistic, sharp focus.",
    ].join(" ");
  }

  return [
    "Editorial fashion flat-lay photograph for a luxury magazine cover.",
    `Arrange these clothing items and accessories on a pure white surface, viewed from directly overhead (top-down 90° shot): ${itemsList}.`,
    "Composition: lay the pieces out as if a person is wearing the outfit — hat/cap at the top, top/shirt centered below, outerwear overlapping the top (slightly open), trousers/skirt below the top along the vertical center axis (can be folded at the knee for editorial rhythm), shoes at the bottom pointing downward. Bags and accessories rest naturally at the sides. Allow organic overlaps between adjacent pieces (jacket hem over shirt, shoe toe over trouser cuff) — this creates visual flow. NOT a grid, NOT items in separate corners.",
    fidelity,
    "BACKGROUND: Absolutely pure white — no texture, no paper grain, no shadows on the background itself. Each item casts only its own soft, sharp-edged drop shadow directly beneath it, giving a clean floating effect. The shadows are the only visual element besides the clothes.",
    "Lighting: bright overhead studio strobe, perfectly even white exposure. Colors must be completely true-to-life.",
    "Square 1:1 frame. Top-down overhead view. Photorealistic, ultra-sharp focus, luxury fashion editorial quality.",
  ].join(" ");
}

export async function POST(req: Request) {
  const gate = await requirePlan("imageGeneration");
  if (!gate.ok) return gate.response;

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

    // ── Persist to Supabase Storage so the URL doesn't expire after 1 h ──────
    // Fallback: if Supabase is not configured or the upload fails, return the
    // temporary Replicate URL unchanged so the feature still works.
    let persistedUrl = imageUrl;
    if (isSupabaseConfigured) {
      try {
        const imgResult = await fetchBuffer(imageUrl, {
          "User-Agent": "goo-fashion/1.0",
          Accept: "image/*",
        });
        if (imgResult) {
          persistedUrl = await uploadGeneratedImage(
            imgResult.buf,
            gate.userId,
            "jpg",
            imgResult.contentType.startsWith("image/") ? imgResult.contentType : "image/jpeg"
          );
        }
      } catch (uploadErr) {
        console.warn("[generate-outfit] storage upload failed, using Replicate URL:", uploadErr);
      }
    }

    return NextResponse.json({
      imageUrl: persistedUrl,
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

