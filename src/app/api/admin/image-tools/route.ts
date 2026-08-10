import { NextResponse } from "next/server";
import Replicate from "replicate";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchImageBuffer, uploadToStorage } from "@/lib/server/storage/product-images";

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
