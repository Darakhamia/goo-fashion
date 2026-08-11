import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getAllProducts } from "@/lib/data/db";
import { productToDb, dbToProduct, writeProductRow, missingColumnWarning } from "@/lib/data/db";
import type { DbProduct } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";
import { storeBackgroundColor } from "@/lib/server/bg-color";

/** Most a single ids= lookup will resolve, so one caller can't ask for the lot. */
const MAX_IDS = 24;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // ids=a,b,c → just those products, in the order asked for. Used by the
  // "Recently viewed" row, which holds ids and needs them back as products.
  const idsParam = searchParams.get("ids");
  if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
    if (ids.length === 0) return NextResponse.json([]);
    // Ungrouped: a colour variant is a product in its own right and has its own
    // page, so grouping would fold away the very item that was viewed.
    const all = await getAllProducts(true);
    const byId = new Map(all.map((p) => [p.id, p]));
    const picked = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    return NextResponse.json(picked, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  }

  // raw=true → skip variant grouping (used by admin panel to show all products)
  const raw = searchParams.get("raw") === "true";
  const products = await getAllProducts(raw);
  return NextResponse.json(products, {
    headers: raw
      ? { "Cache-Control": "no-store" } // admin view must always be fresh
      : {
          // Public catalog: CDN-cache 5 min, serve stale while revalidating —
          // this fetch fires every time the stylist drawer opens.
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(
      { error: "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 501 }
    );
  }
  const body = await req.json();
  const row = productToDb(body);
  const { data, error, dropped } = await writeProductRow<DbProduct>(row, (payload) =>
    supabase!.from("products").insert(payload).select().single(),
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Measure the photo's backdrop now, while there is one product to measure, so
  // an imported piece looks right on the storefront without a maintenance run.
  // Best-effort: failure leaves the column null and the batch job picks it up.
  const created = data as DbProduct;
  const bgColor =
    created.bg_color ?? (created.image_url ? await storeBackgroundColor(created.id, created.image_url) : null);

  revalidatePath("/");
  return NextResponse.json(
    {
      ...dbToProduct({ ...created, bg_color: bgColor }),
      ...(dropped.length && { warning: missingColumnWarning(dropped) }),
    },
    { status: 201 },
  );
}
