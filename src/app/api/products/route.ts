import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getAllProducts, getProductsByIds, readAllProducts } from "@/lib/data/db";
import { productToDb, dbToProduct, writeProductRow, missingColumnWarning } from "@/lib/data/db";
import type { DbProduct } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";
import { storeBackgroundColor } from "@/lib/server/bg-color";

/** Most a single ids= lookup will resolve, so one caller can't ask for the lot. */
const MAX_IDS = 24;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // ids=a,b,c → just those products, in the order asked for. Used by the
  // "Recently viewed" row, the bag, and /saved, which hold ids and need them
  // back as products. Reads only those rows, not the catalogue.
  const idsParam = searchParams.get("ids");
  if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
    if (ids.length === 0) return NextResponse.json([]);
    // Ungrouped: a colour variant is a product in its own right and has its own
    // page, so grouping would fold away the very item that was viewed.
    const picked = await getProductsByIds(ids);
    return NextResponse.json(picked, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  }

  // raw=true → skip variant grouping. Only the admin panel asks for this, so a
  // failed read is reported as one rather than as an empty catalogue.
  if (searchParams.get("raw") === "true") {
    const { products, error } = await readAllProducts(true);
    if (error) {
      return NextResponse.json(
        { error: `Could not load products: ${error}` },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
    // Admin view must always be fresh.
    return NextResponse.json(products, { headers: { "Cache-Control": "no-store" } });
  }

  const products = await getAllProducts();
  return NextResponse.json(products, {
    headers: {
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
