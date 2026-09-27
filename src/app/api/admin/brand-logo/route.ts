import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { sniffRasterImage } from "@/lib/server/read-capped";

const BUCKET = "site-assets";

/** File extension for each raster type `sniffRasterImage` recognises. */
const EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";
}

// POST /api/admin/brand-logo — multipart form: `name` (brand) + `file` (image)
// Uploads the logo to storage and stores its public URL on the brand row.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 501 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const name = (formData.get("name") as string | null)?.trim();
  const file = formData.get("file") as File | null;
  if (!name) return NextResponse.json({ error: "Brand name is required" }, { status: 400 });
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Must be an image" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Max 5 MB" }, { status: 400 });

  // The type, and the extension with it, come from the bytes rather than from
  // the browser's label or the file name. The bucket is public on a domain that
  // is same-site with ours, and an SVG served from there is a page that runs
  // script — so SVG is refused even though a logo is often drawn as one.
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = sniffRasterImage(buffer);
  if (!contentType) {
    return NextResponse.json(
      { error: "The logo must be a JPEG, PNG, WebP, GIF or AVIF image (SVG is not accepted)" },
      { status: 400 }
    );
  }

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (bucketErr && !bucketErr.message.includes("already exists")) {
      return NextResponse.json({ error: `Bucket error: ${bucketErr.message}` }, { status: 500 });
    }
  }

  const filename = `brand-${slug(name)}-${Date.now()}.${EXTENSION[contentType]}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType, upsert: true });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename);

  const { error: dbErr } = await supabase
    .from("brands")
    .update({ logo_url: publicUrl })
    .eq("name", name);
  if (dbErr) {
    if (dbErr.code === "42703" || dbErr.message?.includes("logo_url")) {
      return NextResponse.json(
        { error: "logo_url column missing — run supabase-migration-brand-logos.sql", code: "COLUMN_MISSING" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: "brands.logo_updated",
    target_id: name,
    target_type: "brand",
    metadata: { name, logoUrl: publicUrl },
  });

  revalidatePath("/");
  return NextResponse.json({ ok: true, name, logoUrl: publicUrl });
}

// DELETE /api/admin/brand-logo?name=Brand — clear a brand's logo
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  const name = new URL(req.url).searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "Brand name is required" }, { status: 400 });

  const { error } = await supabase.from("brands").update({ logo_url: null }).eq("name", name);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    admin_id: admin.userId,
    action: "brands.logo_removed",
    target_id: name,
    target_type: "brand",
    metadata: { name },
  });

  revalidatePath("/");
  return NextResponse.json({ ok: true, name });
}
