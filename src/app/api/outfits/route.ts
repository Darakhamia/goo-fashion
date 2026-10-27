import { NextResponse } from "next/server";
import { getOutfitsByIds, readAllOutfits } from "@/lib/data/db";
import { requireAdmin } from "@/lib/server/admin-auth";

// Outfits are made in the builder and published from My looks — a shopper's
// through the moderation queue, an admin's straight away (api/looks/publish).
// The studio's own "New outfit" form, and the POST here that it called, went
// with the CEO's decision of 2026-10-27: one way to build a look, not two.

/** Most a single ids= lookup will resolve, so one caller can't ask for the lot. */
const MAX_IDS = 24;

export async function GET(req: Request) {
  // ids=a,b,c → just those outfits, in the order asked for. Used by the
  // "Recently viewed" row, which holds ids and needs them back as outfits.
  const idsParam = new URL(req.url).searchParams.get("ids");
  if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
    if (ids.length === 0) return NextResponse.json([]);
    return NextResponse.json(await getOutfitsByIds(ids));
  }

  // The whole list is what the admin Outfits table reads, so a failed read is
  // an error rather than an empty list or demo looks it would show as real.
  // The shop's pages that fetch it keep their own empty state on a non-array.
  // The database's own message is for admins only; the shop gets a plain one.
  const { outfits, error } = await readAllOutfits();
  if (error) {
    console.error("[api/outfits] list:", error);
    const admin = await requireAdmin();
    return NextResponse.json(
      { error: admin ? `Could not load outfits: ${error}` : "Could not load outfits." },
      { status: 500 },
    );
  }
  return NextResponse.json(outfits);
}
