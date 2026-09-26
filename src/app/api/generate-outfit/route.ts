import { NextResponse } from "next/server";
import Replicate from "replicate";
import { requirePlan } from "@/lib/server/require-plan";
import { isSupabaseConfigured } from "@/lib/supabase";
import { uploadGeneratedImage } from "@/lib/storage";
import { getPrompt } from "@/lib/server/get-prompt";
import { isBlockedDirectHost, validateTargetUrl } from "@/lib/server/parser/fetch";
import {
  DEFAULT_IMAGE_FIDELITY,
  DEFAULT_IMAGE_MANNEQUIN,
  DEFAULT_IMAGE_FLATLAY,
  DEFAULT_IMAGE_TRYON,
} from "@/lib/server/prompt-defaults";

type Style = "mannequin" | "flatlay" | "tryon";

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

// Hops followed before a reference is given up on. Each one is re-checked.
const MAX_REDIRECTS = 3;

/**
 * Our own Storage bucket. Product photos are mirrored there, and in local
 * development Supabase lives on localhost — which the private-host check below
 * would otherwise refuse. Public objects only: nothing else on that host is
 * something this route should read.
 */
function isOwnStoragePublicUrl(url: string): boolean {
  const base = process.env.SUPABASE_URL;
  if (!base) return false;
  try {
    const u = new URL(url);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      u.host === new URL(base).host &&
      u.pathname.startsWith("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}

/**
 * Reference URLs arrive in the request body, so the server must not fetch them
 * blindly: a loopback, private or cloud-metadata address would turn this route
 * into a proxy into our own network. Same rule as the parser's direct mode.
 */
function isFetchableUrl(url: string): boolean {
  if (isOwnStoragePublicUrl(url)) return true;
  const valid = validateTargetUrl(url, "direct");
  if ("error" in valid) return false;
  // That check reads the hostname as written, so two spellings of an internal
  // address get past it: an IPv6 literal ("[::1]", "[::ffff:169.254.169.254]")
  // and a trailing dot ("localhost.", "metadata.google.internal."). Product
  // photos are served under neither.
  const host = valid.url.hostname;
  if (host.startsWith("[")) return false;
  return !isBlockedDirectHost(host.replace(/\.+$/, ""));
}

/**
 * fetch() that follows redirects itself, so every hop passes the same check —
 * otherwise a public URL answering "302 → http://169.254.169.254/" walks
 * straight past the check on the first address. Null when a hop is refused or
 * there are too many of them.
 */
async function fetchCheckingRedirects(
  url: string,
  init: { signal: AbortSignal; headers: Record<string, string> }
): Promise<Response | null> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isFetchableUrl(current)) return null;
    const res = await fetch(current, { ...init, redirect: "manual" });
    const location =
      res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) return res;
    res.body?.cancel().catch(() => undefined); // free the socket of the hop left behind
    current = new URL(location, current).toString();
  }
  return null;
}

async function fetchBuffer(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 10_000
): Promise<{ buf: Buffer; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchCheckingRedirects(url, { signal: controller.signal, headers });
    clearTimeout(timer);
    if (!res || !res.ok) return null;
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
  // 0. only public http(s) addresses — not even through the proxy below
  if (!isFetchableUrl(url)) {
    return { ok: false, url, reason: "not a public http(s) URL" };
  }

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

function buildItemsList(pieces: SlotProduct[]): string {
  return pieces
    .map((p, i) => {
      const color = p.colorName ?? (p.colors?.length ? p.colors[0] : "");
      const colorStr = color ? `${color} ` : "";
      const material = p.material ? `, ${p.material}` : "";
      return `(${i + 1}) ${p.slot}: ${colorStr}${p.name} by ${p.brand}${material}`;
    })
    .join("; ");
}

async function buildPrompt(pieces: SlotProduct[], style: Style): Promise<string> {
  const itemsList = buildItemsList(pieces);

  const [fidelity, mannequin, flatlay, tryon] = await Promise.all([
    getPrompt("prompt_image_fidelity", DEFAULT_IMAGE_FIDELITY),
    getPrompt("prompt_image_mannequin", DEFAULT_IMAGE_MANNEQUIN),
    getPrompt("prompt_image_flatlay", DEFAULT_IMAGE_FLATLAY),
    getPrompt("prompt_image_tryon", DEFAULT_IMAGE_TRYON),
  ]);

  const fill = (tpl: string) =>
    tpl.replace("{{items}}", itemsList).replace("{{fidelity}}", fidelity);

  if (style === "tryon")    return fill(tryon);
  if (style === "mannequin") return fill(mannequin);
  return fill(flatlay);
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
  const style: Style =
    body.style === "flatlay" ? "flatlay" : body.style === "tryon" ? "tryon" : "mannequin";

  // For try-on: caller supplies the user's photo as a base64 data-URI.
  // It becomes the first reference so the model knows whose body to dress.
  const userPhotoDataUri: string | undefined =
    style === "tryon" && typeof body.userPhotoDataUri === "string" && body.userPhotoDataUri.startsWith("data:")
      ? body.userPhotoDataUri
      : undefined;

  if (style === "tryon" && !userPhotoDataUri) {
    return NextResponse.json({ error: "A photo is required for the try-on style." }, { status: 400 });
  }

  // Collect raw URLs (nano-banana-2 accepts up to 14 references).
  // They come from the client, so fetchAsDataUri refuses any that is not a
  // public http(s) address.
  const rawUrls = pieces
    .map((p) => p.imageUrl)
    .filter((url): url is string => typeof url === "string" && !!url)
    .slice(0, userPhotoDataUri ? 13 : 14); // reserve one slot for the user photo

  // Fetch each image server-side and convert to base64 data-URIs.
  // This prevents Replicate from hitting merchant sites that block hotlinking.
  const fetched = await Promise.all(rawUrls.map(fetchAsDataUri));
  const clothingDataUris = fetched
    .filter((r): r is { ok: true; dataUri: string } => r.ok)
    .map((r) => r.dataUri);

  // User photo goes first so the model reads it as the "body reference"
  const imageInput = userPhotoDataUri ? [userPhotoDataUri, ...clothingDataUris] : clothingDataUris;
  const failedUrls = fetched
    .filter((r): r is { ok: false; url: string; reason: string } => !r.ok)
    .map((r) => r.url);


  if (failedUrls.length > 0) {
    console.warn("[generate-outfit] failed to fetch reference images:", failedUrls);
  }

  const prompt = await buildPrompt(pieces, style);

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
            keys: output && typeof output === "object" ? Object.keys(output as object) : null,
          },
        },
        { status: 500 }
      );
    }

    // ── Persist to Supabase Storage so the URL doesn't expire after 1 h ──────
    //
    // The fallback below is the mechanism behind "all the outfit images
    // disappeared at once": Replicate's URL works for about an hour and then
    // stops, so a failed upload hands back a picture that looks fine, is saved,
    // and dies later that day — silently, because the only signal was a
    // console.warn on the server.
    //
    // It still falls back rather than failing the generation: a picture for an
    // hour beats no picture. But it now says so, so the caller can warn instead
    // of finding out tomorrow.
    let persistedUrl = imageUrl;
    let persisted = false;
    if (isSupabaseConfigured) {
      // One retry, because the usual cause is a transient blip rather than a
      // misconfiguration, and a second attempt costs a second.
      for (let attempt = 1; attempt <= 2 && !persisted; attempt++) {
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
            persisted = true;
          }
        } catch (uploadErr) {
          console.warn(
            `[generate-outfit] storage upload failed (attempt ${attempt}/2), ` +
            "the Replicate URL expires in about an hour:",
            uploadErr,
          );
        }
      }
    }

    return NextResponse.json({
      imageUrl: persistedUrl,
      // False means the picture is Replicate's temporary copy and will stop
      // loading within the hour. Saving a look with one of these is what leaves
      // a card with a broken image days later.
      persisted,
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

