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

// ── Download any URL to a Buffer ─────────────────────────────────────────────

async function fetchBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GOO-Fashion-Bot/1.0)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

// ── Replicate: remove background ─────────────────────────────────────────────

async function removeBackground(imageUrl: string): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN?.trim();
  if (!apiToken) throw new Error("REPLICATE_API_TOKEN is not set");

  const replicate = new Replicate({ auth: apiToken });

  // lucataco/remove-bg is a well-maintained background removal model
  const output = await replicate.run("lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285d65c14d73e5bd9fb6666ca6d", {
    input: { image: imageUrl },
  });

  // output is a URL string or ReadableStream depending on SDK version
  if (typeof output === "string") return output;
  if (output instanceof URL) return output.href;

  // Some SDK versions wrap as ReadableStream — convert to blob URL via buffer
  if (output && typeof (output as { url?: () => Promise<URL> }).url === "function") {
    const url = await (output as { url: () => Promise<URL> }).url();
    return url.href;
  }

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

  try {
    // Step 1 — Download original
    steps.push({ step: "download_original", status: "ok" });
    let mirroredUrl: string | null = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { buffer, contentType } = await fetchBuffer(imageUrl);
        const ext = contentType.includes("png") ? "png" : "jpg";
        mirroredUrl = await uploadToStorage(buffer, ext, contentType);
        steps.push({ step: "mirror_to_storage", status: "ok", detail: mirroredUrl });
      } catch (err) {
        steps.push({ step: "mirror_to_storage", status: "error", detail: String(err) });
      }
    }

    // Step 2 — Remove background via Replicate
    // Pass our mirrored URL if available (guaranteed public), else original
    const sourceForReplicate = mirroredUrl ?? imageUrl;
    let removedBgReplicateUrl: string;
    try {
      removedBgReplicateUrl = await removeBackground(sourceForReplicate);
      steps.push({ step: "remove_background", status: "ok", detail: removedBgReplicateUrl });
    } catch (err) {
      steps.push({ step: "remove_background", status: "error", detail: String(err) });
      return NextResponse.json({ steps, mirroredUrl, removedUrl: null }, { status: 422 });
    }

    // Step 3 — Download Replicate output PNG and upload to our storage
    let finalUrl: string = removedBgReplicateUrl;
    if (isSupabaseConfigured && supabase) {
      try {
        const { buffer } = await fetchBuffer(removedBgReplicateUrl);
        finalUrl = await uploadToStorage(buffer, "png", "image/png");
        steps.push({ step: "upload_result", status: "ok", detail: finalUrl });
      } catch (err) {
        steps.push({ step: "upload_result", status: "error", detail: String(err) });
        // Use Replicate CDN URL as fallback
      }
    }

    return NextResponse.json({
      steps,
      originalUrl: imageUrl,
      mirroredUrl,
      removedUrl: finalUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { steps, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
