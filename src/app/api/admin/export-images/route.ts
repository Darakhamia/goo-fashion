/**
 * Bulk download of the admin's cards, drawn as pictures, as one ZIP.
 *
 * Pieces and looks both answer here because the job is the same one: take the
 * card as the site draws it — the photo, the brand, the name, the price — and
 * hand back a file per card, named after the piece instead of after the CDN's
 * hash. The photo behind each card is fetched from wherever it actually lives,
 * our Storage bucket for most of it and a retailer CDN for the rest.
 *
 * The archive streams rather than being built and then sent: buffering a few
 * hundred cards to answer in one piece would put the whole export on the heap of
 * a function that has far less. Everything else about how it is packed, and the
 * budgets that stop it running forever, lives in lib/server/card-export; the
 * drawing itself lives in lib/server/card-image.
 *
 *   POST /api/admin/export-images {kind:"products"}          → every piece
 *   POST /api/admin/export-images {kind:"outfits", ids:[…]}  → just those looks
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getAllOutfits, getAllProducts } from "@/lib/data/db";
import { formatMetaPrice } from "@/lib/seo";
import { zipStream } from "@/lib/server/zip";
import {
  packCards,
  safeSegment,
  shortId,
  type CardJob,
  type ExportReport,
} from "@/lib/server/card-export";

export const dynamic = "force-dynamic";
// Downloading and drawing a few hundred cards is slow by nature and needs far
// longer than the platform's default. The packer's time budget stops inside
// this, so the archive always gets to close itself properly.
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
 * The commit this deploy was built from, for the archive's report.
 *
 * The host sets it; a machine running `next dev` does not, and says so. It is
 * how an archive that arrived looking wrong can be pinned on the code or on a
 * deploy that never happened, without anyone having to guess.
 */
function buildStamp(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : "local (not a deployed build)";
}

/**
 * A price line the way the card writes it: one figure when the retailers agree,
 * a range when they don't.
 *
 * In the piece's own currency, not the viewer's. The card converts to whatever
 * currency the visitor picked; an export has no visitor, and a file that says
 * "336 €" for a piece priced in euros is the one that stays true tomorrow.
 */
function priceLine(min: number, max: number, currency: string): string {
  const low = formatMetaPrice(min, currency);
  return min === max ? low : `${low}–${formatMetaPrice(max, currency)}`;
}

/**
 * One job per product card: the photo it shows, cropped the way it crops it, and
 * the text it carries. A product whose primary photo is missing falls back to
 * the first of its gallery, and only one with no photo anywhere is reported as a
 * miss.
 */
async function productJobs(ids: Set<string> | null): Promise<{ jobs: CardJob[]; missing: string[] }> {
  const all = await getAllProducts(true);
  const wanted = ids ? all.filter((p) => ids.has(p.id)) : all;

  const jobs: CardJob[] = [];
  const missing: string[] = [];
  for (const product of wanted) {
    const label = `${product.brand} — ${product.name}`;
    const url = product.imageUrl || product.images?.[0];
    if (!url) {
      missing.push(`${label} — no photo on the card`);
      continue;
    }
    // The card counts the piece itself plus every variant that isn't it.
    const colorCount = product.variants?.length
      ? 1 + product.variants.filter((v) => v.id !== product.id).length
      : 0;
    jobs.push({
      path: `products/${safeSegment(product.brand, "no-brand")} - ${safeSegment(product.name)} - ${shortId(product.id)}`,
      url,
      crop: product.cropData,
      label,
      spec: {
        kind: "product",
        title: product.brand,
        subtitle: product.name,
        price: priceLine(product.priceMin, product.priceMax, product.currency),
        colors: colorCount > 1 ? `${colorCount} colors` : undefined,
        badge: product.isNew ? "New" : undefined,
        focal: product.cropData ? { x: product.cropData.focalX, y: product.cropData.focalY } : undefined,
        backdrop: product.bgColor ?? null,
      },
    });
  }
  return { jobs, missing };
}

/** One job per look card: its photo, its name and the range its pieces add up to. */
async function outfitJobs(ids: Set<string> | null): Promise<{ jobs: CardJob[]; missing: string[] }> {
  const all = await getAllOutfits();
  const wanted = ids ? all.filter((o) => ids.has(o.id)) : all;

  const jobs: CardJob[] = [];
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
      spec: {
        kind: "look",
        title: outfit.name,
        price: priceLine(outfit.totalPriceMin, outfit.totalPriceMax, outfit.currency),
      },
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
    build: buildStamp(),
    asked: jobs.length + missing.length,
    packed: 0,
    bytes: 0,
    failures: [...missing],
    truncated: null,
  };
  const filename = `goo-${kind === "products" ? "product" : "look"}-cards-${new Date().toISOString().slice(0, 10)}.zip`;

  return new Response(zipStream(packCards(jobs, report)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Built per request from live rows; nothing about it is reusable.
      "Cache-Control": "no-store",
    },
  });
}
