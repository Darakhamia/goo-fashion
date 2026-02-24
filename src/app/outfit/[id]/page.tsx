import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/product/ProductCard";
import OutfitCard from "@/components/outfit/OutfitCard";
import { getOutfitById, outfits } from "@/lib/data/outfits";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OutfitDetailPage({ params }: Props) {
  const { id } = await params;
  const outfit = getOutfitById(id);

  if (!outfit) notFound();

  const relatedOutfits = outfits
    .filter((o) => o.id !== outfit.id && o.occasion === outfit.occasion)
    .slice(0, 3);

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        {/* Breadcrumb */}
        <div className="pt-8 flex items-center gap-3 text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
          <Link href="/" className="hover:text-[var(--foreground)] transition-colors duration-200">
            Home
          </Link>
          <span>/</span>
          <Link href="/browse" className="hover:text-[var(--foreground)] transition-colors duration-200">
            Outfits
          </Link>
          <span>/</span>
          <span className="text-[var(--foreground)]">{outfit.name}</span>
        </div>

        {/* Main layout */}
        <div className="mt-8 md:mt-12 grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--border)]">
          {/* Left: Editorial Image */}
          <div className="bg-[var(--background)]">
            <div className="relative aspect-[3/4] overflow-hidden">
              <Image
                src={outfit.imageUrl}
                alt={outfit.name}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {outfit.isAIGenerated && (
                <div className="absolute top-4 left-4">
                  <span className="text-[9px] tracking-[0.16em] uppercase font-medium bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)] px-3 py-1.5 block">
                    AI Generated
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Outfit Info + Items */}
          <div className="bg-[var(--background)] px-6 md:px-10 py-8 md:py-12 flex flex-col">
            {/* Header */}
            <div className="mb-8 md:mb-10">
              <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3 capitalize">
                {outfit.occasion} · {outfit.season !== "all" ? outfit.season : "All Season"}
              </p>
              <h1 className="font-display text-3xl md:text-4xl font-light text-[var(--foreground)] leading-tight mb-4">
                {outfit.name}
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-w-sm">
                {outfit.description}
              </p>

              <div className="mt-6 flex items-center gap-6">
                <div>
                  <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">
                    Total
                  </p>
                  <p className="font-display text-2xl font-light text-[var(--foreground)]">
                    ${outfit.totalPriceMin.toLocaleString()}
                    <span className="text-base text-[var(--foreground-muted)]">
                      {" "}
                      — ${outfit.totalPriceMax.toLocaleString()}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">
                    Pieces
                  </p>
                  <p className="font-display text-2xl font-light text-[var(--foreground)]">
                    {outfit.items.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Style tags */}
            <div className="flex flex-wrap gap-2 mb-10">
              {outfit.styleKeywords.map((kw) => (
                <span
                  key={kw}
                  className="text-[9px] tracking-[0.16em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] px-3 py-1.5 capitalize"
                >
                  {kw}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <button className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200">
                Save Outfit
              </button>
              <button className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] border border-[var(--border)] px-8 py-4 hover:border-[var(--border-strong)] transition-colors duration-200">
                Share
              </button>
            </div>

            {/* Items in outfit */}
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6">
                Pieces in this outfit
              </p>

              <div className="space-y-px">
                {outfit.items.map(({ product, role }) => (
                  <Link
                    key={product.id}
                    href={`/product/${product.id}`}
                    className="group flex items-center gap-4 py-4 border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors duration-200 -mx-6 md:-mx-10 px-6 md:px-10"
                  >
                    <div className="w-12 h-12 shrink-0 overflow-hidden relative bg-[var(--surface)]">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] mb-0.5">
                        {product.brand}
                      </p>
                      <p className="text-sm text-[var(--foreground)] truncate">{product.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-[var(--foreground)]">
                        From ${product.priceMin.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5">
                        {product.retailers.length} stores
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Related Outfits */}
        {relatedOutfits.length > 0 && (
          <section className="mt-20 md:mt-28">
            <div className="mb-8">
              <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
                Similar Outfits
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)]">
                You might also like
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)]">
              {relatedOutfits.map((related) => (
                <div key={related.id} className="bg-[var(--background)] p-4">
                  <OutfitCard outfit={related} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
