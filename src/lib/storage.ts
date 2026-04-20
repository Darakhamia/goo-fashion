import { supabase } from "@/lib/supabase";

const BUCKET = "generated-outfits";

/**
 * Ensure the storage bucket exists. Called once per server process startup.
 * Creates a public bucket if it doesn't exist; ignores "already exists" errors.
 */
let bucketReady = false;
async function ensureBucket(): Promise<void> {
  if (bucketReady || !supabase) return;
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024, // 10 MB
  });
  // "already exists" is expected after the first call — not an error.
  if (error && !error.message.includes("already exists")) {
    throw new Error(`[storage] createBucket failed: ${error.message}`);
  }
  bucketReady = true;
}

/**
 * Upload a raw image buffer to Supabase Storage and return its permanent
 * public URL.
 *
 * @param buffer   Raw image bytes
 * @param userId   Clerk userId — used as a path prefix (organises per-user)
 * @param ext      File extension without dot, e.g. "jpg"
 * @param contentType  MIME type, e.g. "image/jpeg"
 */
export async function uploadGeneratedImage(
  buffer: Buffer,
  userId: string,
  ext = "jpg",
  contentType = "image/jpeg"
): Promise<string> {
  if (!supabase) {
    throw new Error("[storage] Supabase is not configured.");
  }

  await ensureBucket();

  // e.g. "user_abc123/2026-04-20/1745123456789.jpg"
  const date = new Date().toISOString().slice(0, 10);
  const path = `${userId}/${date}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false });

  if (error) {
    throw new Error(`[storage] upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
