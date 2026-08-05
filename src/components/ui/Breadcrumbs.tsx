import Link from "next/link";

export interface Crumb {
  label: string;
  /** Omitted for the final crumb — the page you are already on. */
  href?: string;
}

/**
 * The trail above a detail page, held to one line at any width.
 *
 * Every crumb but the last keeps its full label and links back into the
 * catalog with the matching filter applied. The last one is the page itself,
 * so it is the emphasised one and the only part allowed to take the ellipsis —
 * it is also the only part that can be arbitrarily long.
 *
 * A full product chain runs about 480px, so on a phone it would push the name
 * — the crumb that matters most — clean out of the box. Below `sm` everything
 * ahead of the deepest filter folds behind a "…" that still leads back to the
 * catalog; the full chain returns as soon as there is room for it.
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const lastIndex = items.length - 1;
  const foldFrom = Math.max(1, lastIndex - 1);
  const hasFolded = items.length > 2;

  return (
    <nav
      aria-label="Breadcrumb"
      className="pt-8 flex items-center gap-3 overflow-hidden whitespace-nowrap text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]"
    >
      {hasFolded && (
        <Link
          href="/browse"
          aria-label="Browse the catalog"
          className="shrink-0 flex sm:hidden hover:text-[var(--foreground)] transition-colors duration-200"
        >
          …
        </Link>
      )}
      {items.map((item, i) => {
        const isLast = i === lastIndex;
        const folded = hasFolded && !isLast && i < foldFrom;
        return (
          <span
            key={`${item.label}-${i}`}
            className={[
              "items-center gap-3",
              folded ? "hidden sm:flex" : "flex",
              isLast ? "min-w-0" : "shrink-0",
            ].join(" ")}
          >
            {i > 0 && <span className="shrink-0">/</span>}
            {isLast || !item.href ? (
              <span
                className={isLast ? "min-w-0 truncate text-[var(--foreground)]" : "shrink-0"}
                title={isLast ? item.label : undefined}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="shrink-0 hover:text-[var(--foreground)] transition-colors duration-200"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
