import type { Metadata } from "next";
import Link from "next/link";
import { allLandings } from "@/lib/server/landing";
import { pageMetadata } from "@/lib/seo";

// Regenerated at most every five minutes, like the brand pages it lists.
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: "All Brands",
  description:
    "Every brand in the GOO catalog, A to Z, with how many pieces of each — compare prices across stores and buy from the original retailer.",
  path: "/brands",
});

/** First letter for the A–Z index; digits and symbols share "#". */
function letterOf(name: string): string {
  const first = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

/** Every brand page, A to Z — the hub the brand pages hang from (docs/SEO_PLAN.md, SEO-17). */
export default async function BrandsPage() {
  const brands = (await allLandings())
    .filter((l) => l.kind === "brand")
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  const byLetter = new Map<string, typeof brands>();
  for (const b of brands) {
    const letter = letterOf(b.name);
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), b]);
  }

  return (
    <div className="min-h-screen">
      <section className="max-w-[1440px] mx-auto px-5 md:px-12 pt-6 md:pt-24 pb-8 md:pb-16">
        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-4 max-md:hidden">
          Brands
        </p>
        <h1 className="text-5xl md:text-6xl font-black uppercase text-[var(--foreground)] leading-[1.05] max-md:text-[28px] max-md:font-semibold max-md:normal-case max-md:leading-[1.15]">
          All brands
        </h1>
        <p className="mt-4 text-sm text-[var(--foreground-muted)] max-w-sm max-md:mt-1.5 max-md:text-[15px]">
          {brands.length} brands in the catalog, A to Z.
        </p>
      </section>

      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-5 md:px-12 py-8 md:py-20">
          <div className="columns-1 sm:columns-2 lg:columns-4 gap-12">
            {[...byLetter.entries()].map(([letter, list]) => (
              <div key={letter} className="break-inside-avoid mb-8 max-md:mb-5">
                <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3 max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)] max-md:mb-1">
                  {letter}
                </p>
                <ul className="space-y-2 max-md:space-y-0 max-md:rounded-2xl max-md:bg-[var(--surface)] max-md:px-4">
                  {list.map((brand) => (
                    <li key={brand.path} className="max-md:not-first:shadow-[inset_0_1px_0_var(--border)]">
                      <Link
                        href={brand.path}
                        className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-150 max-md:flex max-md:h-11 max-md:items-center max-md:justify-between max-md:text-base max-md:text-[var(--foreground)]"
                      >
                        {brand.name}
                        <span className="ml-2 text-[var(--foreground-subtle)]">{brand.products.length}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
