import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const BUCKET = "product-images";

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 501 });
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  let imageBuffer: Buffer;
  let contentType = "image/jpeg";
  try {
    const response = await fetch(body.url);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 400 });
    }
    contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "URL does not point to an image" }, { status: 400 });
    }
    imageBuffer = Buffer.from(await response.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Failed to fetch image from URL" }, { status: 400 });
  }

  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (bucketErr && !bucketErr.message.includes("already exists")) {
      return NextResponse.json({ error: `Bucket error: ${bucketErr.message}` }, { status: 500 });
    }
  }

  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg").replace("webp", "webp") ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(filename, imageBuffer, { contentType, upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename);

  return NextResponse.json({ url: publicUrl });
}
