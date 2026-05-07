import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";

const KEYS = {
  dark: "hero_image_url",
  light: "hero_image_url_light",
} as const;

type Variant = keyof typeof KEYS;

const BUCKET = "site-assets";
const DEFAULT_DARK =
  "https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?q=80&w=2069&auto=format&fit=crop";
const DEFAULT_LIGHT =
  "https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?q=80&w=2069&auto=format&fit=crop";

// GET /api/admin/hero-image
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({
      dark: { url: DEFAULT_DARK, isDefault: true },
      light: { url: DEFAULT_LIGHT, isDefault: true },
    });
  }

  const { data: rows } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [KEYS.dark, KEYS.light]);

  const byKey = Object.fromEntries(
    (rows ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
  );

  return NextResponse.json({
    dark: {
      url: byKey[KEYS.dark] ?? DEFAULT_DARK,
      isDefault: !byKey[KEYS.dark],
    },
    light: {
      url: byKey[KEYS.light] ?? DEFAULT_LIGHT,
      isDefault: !byKey[KEYS.light],
    },
  });
}

// POST /api/admin/hero-image — multipart form with `file` and optional `variant` (dark|light) fields
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

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Must be an image" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Max 15 MB" }, { status: 400 });

  const rawVariant = formData.get("variant");
  const variant: Variant = rawVariant === "light" ? "light" : "dark";
  const settingKey = KEYS[variant];

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (bucketErr && !bucketErr.message.includes("already exists")) {
      return NextResponse.json({ error: `Bucket error: ${bucketErr.message}` }, { status: 500 });
    }
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `hero-${variant}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: file.type, upsert: true });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename);

  const { error: dbErr } = await supabase
    .from("settings")
    .upsert({ key: settingKey, value: publicUrl, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  revalidatePath("/");
  return NextResponse.json({ ok: true, url: publicUrl, variant });
}

// DELETE /api/admin/hero-image?variant=dark|light — reset to default
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  const { searchParams } = new URL(req.url);
  const rawVariant = searchParams.get("variant");
  const variant: Variant = rawVariant === "light" ? "light" : "dark";
  const settingKey = KEYS[variant];
  const defaultUrl = variant === "light" ? DEFAULT_LIGHT : DEFAULT_DARK;

  await supabase.from("settings").delete().eq("key", settingKey);
  revalidatePath("/");
  return NextResponse.json({ ok: true, url: defaultUrl, variant });
}
