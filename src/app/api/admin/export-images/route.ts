/**
 * Download of the admin's cards, drawn as pictures.
 *
 * Pieces and looks both answer here because the job is the same one: take the
 * card as the site draws it — the photo, the brand, the name, the price — and
 * hand back a picture of it, named after the piece instead of after the CDN's
 * hash. The photo behind each card is fetched from wherever it actually lives,
 * our Storage bucket for most of it and a retailer CDN for the rest.
 *
 * One card comes back as a bare PNG, because a ZIP holding a single file is a
 * chore rather than a delivery: the admin who picked one piece wants that
 * picture in their downloads, ready to post. Several come back as a ZIP, which
 * streams rather than being built and then sent — buffering a few hundred cards
 * to answer in one piece would put the whole export on the heap of a function
 * that has far less. Everything else about how it is packed, and the budgets
 * that stop it running forever, lives in lib/server/card-export; the drawing
 * itself lives in lib/server/card-image.
 *
 * A look is exported with the pieces it is made of: its own card, and the card
 * of every piece in it, in a folder named after the look. A look card on its own
 * is half the post — the caption under it names the pieces — and finding each
 * piece again in the products table to download it separately is the chore this
 * export exists to remove.
 *
 *   POST /api/admin/export-images {kind:"products"}            → every piece, zipped
 *   POST /api/admin/export-images {kind:"products", ids:["…"]} → that one card, as a PNG
 *   POST /api/admin/export-images {kind:"outfits", ids:[…]}    → those looks and their pieces, zipped
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getAllOutfits, getAllProducts } from "@/lib/data/db";
import type { Product } from "@/lib/types";
import { formatMetaPrice } from "@/lib/seo";
import { CARD_MEDIA_TYPE } from "@/lib/server/card-image";
import { zipStream } from "@/lib/server/zip";
import {
  packCards,
  renderJob,
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
 * A `Content-Disposition` that survives a piece named in Cyrillic.
 *
 * The plain `filename` is the ASCII the header may legally carry, and RFC 5987's
 * `filename*` carries the real one for anything that understands it — which is
 * every browser, and the studio's own download button.
 */
function attachment(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
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
 * The name a piece's card file carries: who made it, what it is, and a tail that
 * keeps two pieces with the same name apart.
 */
function productFileName(product: Product): string {
  return `${safeSegment(product.brand, "no-brand")} - ${safeSegment(product.name)} - ${shortId(product.id)}`;
}

/**
 * The card a piece shows, as a job to draw at `path` — or null when the piece
 * has no photo anywhere to draw one around.
 *
 * A product whose primary photo is missing falls back to the first of its
 * gallery, and only one with no photo at all comes back null.
 */
function productCard(product: Product, path: string): CardJob | null {
  const url = product.imageUrl || product.images?.[0];
  if (!url) return null;

  // The card counts the piece itself plus every variant that isn't it.
  const colorCount = product.variants?.length
    ? 1 + product.variants.filter((v) => v.id !== product.id).length
    : 0;

  return {
    path,
    url,
    crop: product.cropData,
    label: `${product.brand} — ${product.name}`,
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
  };
}

/** What one kind's selection turns into: the cards to draw, and what it could not. */
interface Selection {
  jobs: CardJob[];
  missing: string[];
  /**
   * The name of the one look this export is about, when it is about one — the
   * archive is then named after it rather than after the date alone, because a
   * download of a single look is a thing the admin is holding, not a batch.
   */
  archiveLabel: string | null;
}

/** One job per product card, straight out of the products table. */
async function productJobs(ids: Set<string> | null): Promise<Selection> {
  const all = await getAllProducts(true);
  const wanted = ids ? all.filter((p) => ids.has(p.id)) : all;

  const jobs: CardJob[] = [];
  const missing: string[] = [];
  for (const product of wanted) {
    const card = productCard(product, `products/${productFileName(product)}`);
    if (card) jobs.push(card);
    else missing.push(`${product.brand} — ${product.name} — no photo on the card`);
  }
  return { jobs, missing, archiveLabel: null };
}

/**
 * The jobs behind a look: its own card, and the card of every piece in it.
 *
 * Each look gets a folder of its own, so the pieces stay with the look they
 * belong to however many looks are in the archive, and the pieces are numbered
 * in the order the look lists them — hero first, the way the site shows them.
 *
 * A look whose own photo is missing still hands over its pieces: the pieces are
 * the half of the export that is always usable, and losing them because the look
 * has no photo yet would be a strange kind of punishment.
 */
async function outfitJobs(ids: Set<string> | null): Promise<Selection> {
  const all = await getAllOutfits();
  const wanted = ids ? all.filter((o) => ids.has(o.id)) : all;

  const jobs: CardJob[] = [];
  const missing: string[] = [];
  for (const outfit of wanted) {
    const name = safeSegment(outfit.name, "look");
    const folder = `outfits/${name} - ${shortId(outfit.id)}`;

    if (outfit.imageUrl) {
      jobs.push({
        path: `${folder}/look - ${name}`,
        url: outfit.imageUrl,
        label: outfit.name,
        spec: {
          kind: "look",
          title: outfit.name,
          price: priceLine(outfit.totalPriceMin, outfit.totalPriceMax, outfit.currency),
        },
      });
    } else {
      missing.push(`${outfit.name} — no photo on the card`);
    }

    outfit.items.forEach((item, i) => {
      const nth = String(i + 1).padStart(2, "0");
      const card = productCard(item.product, `${folder}/items/${nth} - ${productFileName(item.product)}`);
      if (card) jobs.push(card);
      else missing.push(`${outfit.name} → ${item.product.brand} — ${item.product.name} — no photo on the card`);
    });
  }
  return { jobs, missing, archiveLabel: wanted.length === 1 ? wanted[0].name : null };
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
  const { jobs, missing, archiveLabel } =
    kind === "products" ? await productJobs(ids) : await outfitJobs(ids);

  // The only failure worth a status code: everything else is discovered after
  // the response has started, and gets written into the archive's report.
  if (!jobs.length) {
    return NextResponse.json(
      { error: missing.length ? "None of the selected cards has a photo." : "Nothing to export." },
      { status: 404 },
    );
  }

  // One card: draw it and answer with the picture itself. This is also the only
  // path that can report a failed render with a status code — once an archive
  // has started streaming, a 200 is already on the wire and the trouble has to
  // go into _export.txt instead.
  if (jobs.length === 1 && !missing.length) {
    const drawn = await renderJob(jobs[0]);
    if (!drawn.ok) {
      return NextResponse.json({ error: `${drawn.job.label} — ${drawn.reason}` }, { status: 502 });
    }
    return new Response(new Uint8Array(drawn.data), {
      headers: {
        "Content-Type": CARD_MEDIA_TYPE,
        "Content-Disposition": attachment(drawn.name.split("/").pop() ?? drawn.name),
        "Cache-Control": "no-store",
      },
    });
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
  const today = new Date().toISOString().slice(0, 10);
  // A single look's archive is named after the look; anything wider is named
  // after what it holds, since no one name would be true of all of it.
  const filename = archiveLabel
    ? `goo-look-${safeSegment(archiveLabel, "look")}-${today}.zip`
    : `goo-${kind === "products" ? "product" : "look"}-cards-${today}.zip`;

  return new Response(zipStream(packCards(jobs, report)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": attachment(filename),
      // Built per request from live rows; nothing about it is reusable.
      "Cache-Control": "no-store",
    },
  });
}
