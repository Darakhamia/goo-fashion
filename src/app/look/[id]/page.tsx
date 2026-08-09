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

// Dedupe the lookup between generateMetadata and the page render in one
// request. Share links may carry the look in the URL itself (?d=...) as a
// fallback for when the snapshot never reached the database — the database
// row wins when both exist.
const loadLook = cache(async (id: string, d: string | null): Promise<SharedLook | null> => {
  const fromDb = await getUserLookById(id);
  if (fromDb) return fromDb;
  return d ? sharedLookFromShareData(id, d) : null;
});

async function resolveLook({ params, searchParams }: Props): Promise<SharedLook | null> {
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
  const look = await resolveLook(props);
  if (!look) return {};

  const title = `${lookHeading(look)} · GOO`;
  const description =
    look.description?.trim() ||
    `A look with ${look.pieces.length} ${look.pieces.length === 1 ? "piece" : "pieces"}, shared on GOO.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/look/${id}` },
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
  const look = await resolveLook(props);

  if (!look) notFound();

  const heading = lookHeading(look);
  const pieces = sortedPieces(look);
  const collagePieces = pieces.filter((p) => p.imageUrl).slice(0, 4);

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        {/* Breadcrumb */}
        <div className="pt-8 flex items-center gap-3 text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
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
        <div className="mt-8 md:mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/* Left: look image (or a collage of the pieces) */}
          <div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--background)]">
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
                <div className="absolute inset-0 grid grid-cols-2 gap-px bg-[var(--border)]">
                  {collagePieces.map((piece) => (
                    <div key={piece.productId} className="relative overflow-hidden bg-[var(--surface)]">
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
                <div className="absolute top-4 left-4">
                  <span className="text-[9px] tracking-[0.16em] uppercase font-medium bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full block">
                    AI Generated
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: look info + pieces */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] px-6 md:px-10 py-8 md:py-12 flex flex-col">
            {/* Header */}
            <div className="mb-8 md:mb-10">
              <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
                Shared Look
              </p>
              <h1 className="text-3xl md:text-4xl font-bold uppercase text-[var(--foreground)] leading-tight mb-4">
                {heading}
              </h1>
              {look.description?.trim() && (
                <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-w-sm">
                  {look.description}
                </p>
              )}

              <div className="mt-6 flex items-center gap-6">
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
              <div className="flex flex-wrap gap-2 mb-10">
                {look.styleKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-[9px] tracking-[0.16em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] px-3 py-1.5 rounded-full capitalize"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {/* Pieces in look */}
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6">
                Pieces in this look
              </p>

              <div className="space-y-2">
                {pieces.map((piece) => {
                  const inner = (
                    <>
                      <div className="w-12 h-12 shrink-0 overflow-hidden relative bg-[var(--surface)] rounded-lg">
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
                          <p className="text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] mb-0.5">
                            {piece.brand}
                          </p>
                        )}
                        <p className="text-sm text-[var(--foreground)] truncate">{piece.name}</p>
                      </div>
                      {piece.priceMin != null && (
                        <div className="text-right shrink-0">
                          <p className="text-sm text-[var(--foreground)]">
                            From <Price amount={piece.priceMin} />
                          </p>
                          {piece.retailerCount > 0 && (
                            <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5">
                              {piece.retailerCount} {piece.retailerCount === 1 ? "store" : "stores"}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  );

                  const className =
                    "group flex items-center gap-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] transition-all duration-200";

                  return piece.productExists ? (
                    <Link
                      key={piece.productId}
                      href={`/product/${piece.productId}`}
                      className={`${className} hover:border-[var(--foreground-muted)] hover:shadow-sm hover:bg-[var(--surface)]`}
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

        {/* CTA */}
        <div className="mt-16 md:mt-24 mb-20 text-center">
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
