import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
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
  if (!REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN is not set");

  // Create prediction using 851-labs/background-remover (no version hash needed)
  const createRes = await fetch(
    "https://api.replicate.com/v1/models/851-labs/background-remover/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",          // ask Replicate to wait up to ~60s before returning
      },
      body: JSON.stringify({ input: { image: imageUrl } }),
      signal: AbortSignal.timeout(90_000),
    }
  );

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Replicate API error ${createRes.status}: ${body}`);
  }

  let prediction = await createRes.json() as {
    id: string;
    status: string;
    output?: string;
    error?: string;
    urls?: { get: string };
  };

  // If Prefer:wait returned a final status, use it immediately
  if (prediction.status !== "succeeded" && prediction.status !== "failed") {
    // Otherwise poll
    const pollUrl = prediction.urls?.get ?? `https://api.replicate.com/v1/predictions/${prediction.id}`;
    const deadline = Date.now() + 120_000;
    while (prediction.status !== "succeeded" && prediction.status !== "failed") {
      if (Date.now() > deadline) throw new Error("Replicate timed out after 120s");
      await new Promise((r) => setTimeout(r, 1500));
      const pollRes = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
      });
      prediction = await pollRes.json();
    }
  }

  if (prediction.status === "failed" || prediction.error) {
    throw new Error(`Replicate failed: ${prediction.error ?? "unknown error"}`);
  }

  if (!prediction.output) throw new Error("Replicate returned no output");

  return prediction.output as string;
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
