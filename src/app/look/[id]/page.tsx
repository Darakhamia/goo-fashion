import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "@/components/ui/Image";
import Price from "@/components/ui/Price";
import { getUserLookById, sharedLookFromShareData, type SharedLook } from "@/lib/data/db";
import { SITE_URL } from "@/lib/seo";

// Looks are created at runtime, so a given id may not exist at build time and
// must always be re-fetched — never statically cached (which could freeze in a
// 404 for a look that was created later).
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string | string[] }>;
}

interface ResolvedLook {
  look: SharedLook;
  /**
   * True when the page was built from the ?d= payload rather than a database
   * row. That payload is unsigned — anyone can write one — so such a page is
   * kept out of search results (as is a row shared while signed out, see
   * `SharedLook.anonymous`).
   */
  fromLink: boolean;
}

// Dedupe the lookup between generateMetadata and the page render in one
// request. Share links may carry the look in the URL itself (?d=...) as a
// fallback for when the snapshot never reached the database — the database
// row wins when both exist.
const loadLook = cache(async (id: string, d: string | null): Promise<ResolvedLook | null> => {
  const fromDb = await getUserLookById(id);
  if (fromDb) return { look: fromDb, fromLink: false };
  const fromLink = d ? await sharedLookFromShareData(id, d) : null;
  return fromLink ? { look: fromLink, fromLink: true } : null;
});

async function resolveLook({ params, searchParams }: Props): Promise<ResolvedLook | null> {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const d = typeof sp.d === "string" ? sp.d : null;
  return loadLook(id, d);
}

// Ordering so the pieces read top-to-bottom like a real outfit.
const SLOT_PRIORITY: Record<string, number> = {
  outerwear: 0, top: 1, bottom: 2, shoes: 3, accessories: 4, accessories2: 5,
};

function lookHeading(look: SharedLook): string {
  if (look.name && look.name.trim()) return look.name.trim();
  return "Shared Look";
}

function sortedPieces(look: SharedLook) {
  return [...look.pieces].sort(
    (a, b) => (SLOT_PRIORITY[a.slot] ?? 99) - (SLOT_PRIORITY[b.slot] ?? 99)
  );
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const resolved = await resolveLook(props);
  if (!resolved) return {};
  const { look, fromLink } = resolved;

  const title = `${lookHeading(look)} · GOO`;
  const description =
    look.description?.trim() ||
    `A look with ${look.pieces.length} ${look.pieces.length === 1 ? "piece" : "pieces"}, shared on GOO.`;

  return {
    title,
    description,
    // Neither a link-built page nor a look shared while signed out has an
    // account behind its text — anyone could have written it — so it names no
    // canonical and asks not to be indexed. The explicit null keeps it from
    // inheriting the root layout's canonical ("/").
    ...(fromLink || look.anonymous
      ? { robots: { index: false, follow: false }, alternates: { canonical: null } }
      : { alternates: { canonical: `${SITE_URL}/look/${id}` } }),
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/look/${id}`,
      type: "website",
      images: look.generatedImage ? [{ url: look.generatedImage, alt: lookHeading(look) }] : [],
    },
  };
}

export default async function SharedLookPage(props: Props) {
  const resolved = await resolveLook(props);

  if (!resolved) notFound();
  const { look } = resolved;

  const heading = lookHeading(look);
  const pieces = sortedPieces(look);
  const collagePieces = pieces.filter((p) => p.imageUrl).slice(0, 4);

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-3 md:px-12">
        {/* Breadcrumb — desktop only: phones go back with the header's back button */}
        <div className="hidden md:flex pt-8 items-center gap-3 text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
          <Link href="/" className="hover:text-[var(--foreground)] transition-colors duration-200">
            Home
          </Link>
          <span>/</span>
          <Link href="/browse" className="hover:text-[var(--foreground)] transition-colors duration-200">
            Looks
          </Link>
          <span>/</span>
          <span className="text-[var(--foreground)] truncate max-w-[40vw]">{heading}</span>
        </div>

        {/* Main layout */}
        <div className="mt-3 md:mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          {/* Left: look image (or a collage of the pieces) — on phones a
              borderless card, the pieces on one light field (DESIGN_SYSTEM.md §12.5) */}
          <div className="rounded-3xl md:rounded-2xl overflow-hidden md:border md:border-[var(--border)] bg-[var(--background)]">
            <div className="relative aspect-[3/4] overflow-hidden">
              {look.generatedImage ? (
                <Image
                  src={look.generatedImage}
                  alt={heading}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  unoptimized
                />
              ) : collagePieces.length > 0 ? (
                <div className="absolute inset-0 grid grid-cols-2 gap-px bg-white md:bg-[var(--border)]">
                  {collagePieces.map((piece) => (
                    <div key={piece.productId} className="relative overflow-hidden bg-white md:bg-[var(--surface)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={piece.imageUrl as string}
                        alt={piece.name}
                        className="absolute inset-0 w-full h-full object-contain p-3"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[var(--foreground-subtle)] text-sm">
                  No preview available
                </div>
              )}
              {look.generatedImage && (
                <div className="absolute top-3.5 left-3.5 md:top-4 md:left-4">
                  <span className="block rounded-full bg-white/80 md:bg-black/60 md:backdrop-blur-sm text-black md:text-white text-[11px] md:text-[9px] font-semibold md:font-medium md:tracking-[0.16em] md:uppercase px-[9px] py-1 md:px-3 md:py-1.5">
                    AI Generated
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: look info + pieces */}
          <div className="md:rounded-2xl md:border md:border-[var(--border)] md:bg-[var(--background)] px-1 md:px-10 md:py-12 flex flex-col">
            {/* Header */}
            <div className="mb-3 md:mb-10">
              <p className="text-[13px] md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium text-[var(--foreground-muted)] md:text-[var(--foreground-subtle)] mb-1 md:mb-3">
                Shared look
              </p>
              {/* Desktop's −0.015em is spelled out: any tracking class turns off the
                  size-based rule in globals.css (DESIGN_SYSTEM.md §12.13). */}
              <h1 className="text-[22px] md:text-4xl font-semibold md:font-bold md:uppercase tracking-[-0.01em] md:tracking-[-0.015em] text-[var(--foreground)] leading-tight mb-2 md:mb-4">
                {heading}
              </h1>
              {look.description?.trim() && (
                <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-w-sm">
                  {look.description}
                </p>
              )}

              {/* Total and count — phones read them in the bar */}
              <div className="mt-6 hidden md:flex items-center gap-6">
                {look.totalPrice != null && (
                  <div>
                    <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">
                      Total
                    </p>
                    <p className="text-2xl font-bold text-[var(--foreground)]">
                      <Price amount={look.totalPrice} />
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">
                    Pieces
                  </p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{pieces.length}</p>
                </div>
              </div>
            </div>

            {/* Style tags */}
            {look.styleKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 md:gap-2 mb-5 md:mb-10">
                {look.styleKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex md:inline items-center h-7 md:h-auto px-3 md:py-1.5 rounded-full bg-[var(--fg-overlay-08)] md:bg-transparent md:border md:border-[var(--border)] text-[12px] md:text-[9px] md:tracking-[0.16em] md:uppercase text-[var(--foreground)] md:text-[var(--foreground-muted)] capitalize"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {/* Pieces in look */}
            <div>
              <p className="text-[13px] md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium text-[var(--foreground-muted)] md:text-[var(--foreground-subtle)] mb-2.5 md:mb-6">
                Pieces in this look
              </p>

              <div className="space-y-2">
                {pieces.map((piece) => {
                  const inner = (
                    <>
                      <div className="w-12 h-12 shrink-0 overflow-hidden relative bg-white md:bg-[var(--surface)] rounded-[10px] md:rounded-lg">
                        {piece.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={piece.imageUrl}
                            alt={piece.name}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        {piece.brand && (
                          <p className="max-md:truncate text-[12px] md:text-[9px] md:tracking-[0.16em] md:uppercase text-[var(--foreground-muted)] md:text-[var(--foreground-subtle)] md:mb-0.5">
                            {piece.brand}
                          </p>
                        )}
                        <p className="text-sm max-md:font-medium text-[var(--foreground)] truncate">{piece.name}</p>
                      </div>
                      {piece.priceMin != null && (
                        <div className="text-right shrink-0">
                          <p className="text-sm max-md:font-semibold text-[var(--foreground)]">
                            From <Price amount={piece.priceMin} />
                          </p>
                          {piece.retailerCount > 0 && (
                            <p className="text-[11px] md:text-[9px] text-[var(--foreground-muted)] md:text-[var(--foreground-subtle)] mt-0.5">
                              {piece.retailerCount} {piece.retailerCount === 1 ? "store" : "stores"}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  );

                  // Phones: soft plaques without a border, as on the outfit page.
                  const className =
                    "group flex items-center gap-3 md:gap-4 max-md:min-h-16 py-2 pl-2 pr-3 md:p-3 rounded-[14px] md:rounded-xl md:border md:border-[var(--border)] bg-[var(--surface)] md:bg-[var(--background)] transition-colors duration-200";

                  return piece.productExists ? (
                    <Link
                      key={piece.productId}
                      href={`/product/${piece.productId}`}
                      className={`${className} md:hover:border-[var(--foreground-muted)] md:hover:shadow-sm md:hover:bg-[var(--surface)]`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={piece.productId} className={className}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Phones: the bar stands where the tab bar would (DESIGN_SYSTEM.md §12.8),
            carrying the total and the page's one action. */}
        <div className="md:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6px)] z-40 h-16 rounded-3xl border border-[var(--border)] bg-[var(--surface-overlay-92)] backdrop-blur-md flex items-center gap-2 pl-[18px] pr-2.5">
          <div className="flex-1 min-w-0">
            {look.totalPrice != null && (
              <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                <Price amount={look.totalPrice} />
              </p>
            )}
            <p className="text-[12px] text-[var(--foreground-muted)]">
              {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
            </p>
          </div>
          <Link
            href="/builder"
            className="shrink-0 h-11 px-5 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[15px] font-semibold flex items-center"
          >
            Build your own look
          </Link>
        </div>

        {/* CTA — desktop; phones have it in the bar */}
        <div className="hidden md:block mt-16 md:mt-24 mb-20 text-center">
          <Link
            href="/builder"
            className="inline-flex items-center gap-2.5 bg-[var(--foreground)] text-[var(--background)] rounded-full px-8 py-3.5 text-[15px] font-semibold tracking-[-0.01em] hover:opacity-90 transition-opacity"
          >
            Build your own look
          </Link>
        </div>
      </div>
    </div>
  );
}
