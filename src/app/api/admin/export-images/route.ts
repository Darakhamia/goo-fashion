/**
 * Bulk download of the photos behind the admin cards, as one ZIP.
 *
 * Pieces and looks both answer here because the job is the same one: take what
 * the cards show, fetch it from wherever it actually lives — our Storage bucket
 * for most of it, a retailer CDN for the rest — and hand back files named after
 * the piece instead of after the CDN's hash.
 *
 * The archive streams rather than being built and then sent: buffering a few
 * hundred photos to answer in one piece would put the whole export on the heap
 * of a function that has far less. Everything else about how it is packed, and
 * the budgets that stop it running forever, lives in lib/server/photo-export.
 *
 *   POST /api/admin/export-images {kind:"products"}          → every piece
 *   POST /api/admin/export-images {kind:"outfits", ids:[…]}  → just those looks
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getAllOutfits, getAllProducts } from "@/lib/data/db";
import { zipStream } from "@/lib/server/zip";
import {
  packPhotos,
  safeSegment,
  shortId,
  type ExportReport,
  type PhotoJob,
} from "@/lib/server/photo-export";

export const dynamic = "force-dynamic";
// Downloading a few hundred photos is slow by nature and needs far longer than
// the platform's default. The packer's time budget stops inside this, so the
// archive always gets to close itself properly.
export const maxDuration = 300;

type Kind = ExportReport["kind"];

interface ExportBody {
  kind?: string;
  /** Which cards to export. Omitted means every card of that kind. */
  ids?: unknown;
}

function parseIds(raw: unknown): Set<string> | null {
  if (!Array.isArray(raw)) return null;
  const ids = raw.filter((v): v is string => typeof v === "string" && v.length > 0);
  return ids.length ? new Set(ids) : null;
}

/**
 * The photo of each product card: what the card shows, cropped the way the card
 * crops it. A product whose primary photo is missing falls back to the first of
 * its gallery, and only one with no photo anywhere is reported as a miss.
 */
async function productJobs(ids: Set<string> | null): Promise<{ jobs: PhotoJob[]; missing: string[] }> {
  const all = await getAllProducts(true);
  const wanted = ids ? all.filter((p) => ids.has(p.id)) : all;

  const jobs: PhotoJob[] = [];
  const missing: string[] = [];
  for (const product of wanted) {
    const label = `${product.brand} — ${product.name}`;
    const url = product.imageUrl || product.images?.[0];
    if (!url) {
      missing.push(`${label} — no photo on the card`);
      continue;
    }
    jobs.push({
      path: `products/${safeSegment(product.brand, "no-brand")} - ${safeSegment(product.name)} - ${shortId(product.id)}`,
      url,
      crop: product.cropData,
      label,
    });
  }
  return { jobs, missing };
}

/** The look photo of each outfit card — one image per look, and no crop to apply. */
async function outfitJobs(ids: Set<string> | null): Promise<{ jobs: PhotoJob[]; missing: string[] }> {
  const all = await getAllOutfits();
  const wanted = ids ? all.filter((o) => ids.has(o.id)) : all;

  const jobs: PhotoJob[] = [];
  const missing: string[] = [];
  for (const outfit of wanted) {
    if (!outfit.imageUrl) {
      missing.push(`${outfit.name} — no photo on the card`);
      continue;
    }
    jobs.push({
      path: `outfits/${safeSegment(outfit.name, "look")} - ${shortId(outfit.id)}`,
      url: outfit.imageUrl,
      label: outfit.name,
    });
  }
  return { jobs, missing };
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: ExportBody;
  try {
    body = (await req.json()) as ExportBody;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const kind: Kind | null =
    body.kind === "products" || body.kind === "outfits" ? body.kind : null;
  if (!kind) {
    return NextResponse.json({ error: 'kind must be "products" or "outfits".' }, { status: 400 });
  }

  const ids = parseIds(body.ids);
  const { jobs, missing } = kind === "products" ? await productJobs(ids) : await outfitJobs(ids);

  // The only failure worth a status code: everything else is discovered after
  // the response has started, and gets written into the archive's report.
  if (!jobs.length) {
    return NextResponse.json(
      { error: missing.length ? "None of the selected cards has a photo." : "Nothing to export." },
      { status: 404 },
    );
  }

  const report: ExportReport = {
    kind,
    asked: jobs.length + missing.length,
    packed: 0,
    bytes: 0,
    failures: [...missing],
    truncated: null,
  };
  const filename = `goo-${kind}-photos-${new Date().toISOString().slice(0, 10)}.zip`;

  return new Response(zipStream(packPhotos(jobs, report)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Built per request from live rows; nothing about it is reusable.
      "Cache-Control": "no-store",
    },
  });
}
