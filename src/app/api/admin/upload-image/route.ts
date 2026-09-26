import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { isAlreadyMirrored, mirrorImageUrl } from "@/lib/server/storage/product-images";
import { validateTargetUrl } from "@/lib/server/parser/fetch";

/**
 * POST /api/admin/upload-image { url } → { url, mirrored }
 *
 * Copies a pasted product photo into our own storage, so the product does not
 * hotlink a retailer CDN. A URL that already points at our storage comes back
 * as it is (`mirrored: false`) — re-uploading it would only leave a duplicate
 * in the bucket and a new URL on the product.
 *
 * The download itself is the importer's: browser-like headers and a per-site
 * Referer (Farfetch and friends refuse bare requests), a timeout and a size
 * cap. A failure answers with the reason, so the editor can say the photo is
 * still external instead of pretending it was stored.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 501 });
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = String(body?.url ?? "").trim();
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Only http(s) image URLs can be stored" }, { status: 400 });
  }

  if (isAlreadyMirrored(url)) {
    return NextResponse.json({ url, mirrored: false });
  }

  // The server downloads this address, so it must not be one of our own
  // network's: loopback, private, link-local or cloud metadata. Checked after
  // the storage test above, since local Supabase lives on localhost.
  const target = validateTargetUrl(url, "direct");
  if ("error" in target) {
    return NextResponse.json({ error: target.error }, { status: 400 });
  }

  try {
    const stored = await mirrorImageUrl(url);
    return NextResponse.json({ url: stored, mirrored: true });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: `Could not copy the photo to storage (${reason})` },
      { status: 502 }
    );
  }
}
