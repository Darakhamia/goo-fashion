import { NextResponse } from "next/server";
import Replicate from "replicate";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const BUCKET = "product-images";

// ── Supabase upload ───────────────────────────────────────────────────────────

async function ensureProductImagesBucket() {
  if (!supabase) return;
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 20 * 1024 * 1024,
  });
  if (error && !error.message.includes("already exists")) {
    throw new Error(`Bucket error: ${error.message}`);
  }
}

async function uploadToStorage(buffer: Buffer, ext: string, contentType: string): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  await ensureProductImagesBucket();
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── Download image with browser-like headers (bypasses CDN hotlink protection) ─

async function fetchImageBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  let referer = "https://www.google.com/";
  try {
    const { origin, hostname } = new URL(url);
    if (hostname.includes("farfetch")) referer = "https://www.farfetch.com/";
    else if (hostname.includes("ssense")) referer = "https://www.ssense.com/";
    else if (hostname.includes("mytheresa")) referer = "https://www.mytheresa.com/";
    else referer = origin + "/";
  } catch {}

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": referer,
      "Sec-Fetch-Dest": "image",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "cross-site",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

// ── Replicate: remove background ─────────────────────────────────────────────

async function removeBackground(buffer: Buffer, contentType: string): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN?.trim();
  if (!apiToken) throw new Error("REPLICATE_API_TOKEN is not set");

  const replicate = new Replicate({ auth: apiToken });

  // Pass as base64 data URI — avoids Replicate also hitting CDN 403
  const base64 = buffer.toString("base64");
  const dataUri = `data:${contentType};base64,${base64}`;

  // 851-labs/background-remover is a deployment-style model (no version hash needed)
  const output = await replicate.run("851-labs/background-remover", {
    input: { image: dataUri },
  });

  if (typeof output === "string") return output;
  if (output instanceof URL) return output.href;
  if (output && typeof (output as { url?: () => Promise<URL> }).url === "function") {
    const url = await (output as { url: () => Promise<URL> }).url();
    return url.href;
  }
  const str = String(output);
  if (str.startsWith("http")) return str;

  throw new Error(`Unexpected Replicate output type: ${typeof output}`);
}

// ── POST /api/admin/image-tools ───────────────────────────────────────────────

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const imageUrl: string = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (!imageUrl) return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });

  const steps: { step: string; status: "ok" | "error"; detail?: string }[] = [];

  // Step 1 — Download original image
  let imageBuffer: Buffer;
  let imageContentType: string;
  try {
    const result = await fetchImageBuffer(imageUrl);
    imageBuffer = result.buffer;
    imageContentType = result.contentType;
    steps.push({ step: "download_original", status: "ok" });
  } catch (err) {
    steps.push({ step: "download_original", status: "error", detail: String(err) });
    return NextResponse.json({ steps, error: String(err) }, { status: 422 });
  }

  // Step 2 — Mirror original to Supabase Storage
  let mirroredUrl: string | null = null;
  if (isSupabaseConfigured && supabase) {
    try {
      const ext = imageContentType.includes("png") ? "png" : "jpg";
      mirroredUrl = await uploadToStorage(imageBuffer, ext, imageContentType);
      steps.push({ step: "mirror_to_storage", status: "ok", detail: mirroredUrl });
    } catch (err) {
      steps.push({ step: "mirror_to_storage", status: "error", detail: String(err) });
    }
  }

  // Step 3 — Remove background via Replicate (buffer → base64)
  let removedBgUrl: string;
  try {
    removedBgUrl = await removeBackground(imageBuffer, imageContentType);
    steps.push({ step: "remove_background", status: "ok", detail: removedBgUrl });
  } catch (err) {
    steps.push({ step: "remove_background", status: "error", detail: String(err) });
    return NextResponse.json({ steps, mirroredUrl, removedUrl: null }, { status: 422 });
  }

  // Step 4 — Download Replicate PNG and upload to our storage
  let finalUrl: string = removedBgUrl;
  if (isSupabaseConfigured && supabase) {
    try {
      const { buffer } = await fetchImageBuffer(removedBgUrl);
      finalUrl = await uploadToStorage(buffer, "png", "image/png");
      steps.push({ step: "upload_result", status: "ok", detail: finalUrl });
    } catch (err) {
      steps.push({ step: "upload_result", status: "error", detail: String(err) });
    }
  }

  return NextResponse.json({
    steps,
    originalUrl: imageUrl,
    mirroredUrl,
    removedUrl: finalUrl,
  });
}
