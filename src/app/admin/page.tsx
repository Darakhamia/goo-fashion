import { outfits } from "@/lib/data/outfits";
import { products } from "@/lib/data/products";
import Image from "next/image";
import Link from "next/link";

const statCards = [
  {
    label: "Total Products",
    value: products.length,
    trend: "+3 this month",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M2 5L8 2L14 5V11L8 14L2 11V5Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M8 2V14" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 5L14 11" stroke="currentColor" strokeWidth="1.2" />
        <path d="M14 5L2 11" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    label: "Total Outfits",
    value: outfits.length,
    trend: "+5 this month",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M5 2L3 5H13L11 2H5Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M3 5V13H13V5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Total Users",
    value: 1247,
    trend: "+84 this month",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M1 14C1 11.239 3.239 9 6 9C8.761 9 11 11.239 11 14"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M11 7C12.381 7 13.5 5.881 13.5 4.5C13.5 3.119 12.381 2 11 2"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M13 10C14.105 10.5 15 11.7 15 13.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: "Monthly Revenue",
    value: "$47,820",
    trend: "+12.4% vs last month",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1.5V14.5M11 4.5C11 3.119 9.657 2 8 2C6.343 2 5 3.119 5 4.5C5 5.881 6.343 7 8 7C9.657 7 11 8.119 11 9.5C11 10.881 9.657 12 8 12C6.343 12 5 10.881 5 9.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

const recentProducts = products.slice(-6).reverse();

export default function AdminDashboardPage() {
  return (
    <div className="max-w-6xl">
      {/* Page title */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">
          Dashboard
        </h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
          Overview of GOO platform activity.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="border border-[var(--border)] p-6"
            style={{ background: "var(--background)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">
                {card.label}
              </span>
              <span className="text-[var(--foreground-subtle)]">{card.icon}</span>
            </div>
            <p className="font-display text-3xl font-light text-[var(--foreground)] mb-2">
              {card.value}
            </p>
            <p className="text-[10px] text-[var(--foreground-subtle)] tracking-wide">
              {card.trend}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Products */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">
            Recent Products
          </h2>
          <Link
            href="/admin/products"
            className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            View all &rarr;
          </Link>
        </div>

        <div
          className="border border-[var(--border)]"
          style={{ background: "var(--background)" }}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal w-14">
                  Image
                </th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden md:table-cell">
                  Brand
                </th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden lg:table-cell">
                  Category
                </th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">
                  Price
                </th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden sm:table-cell">
                  New
                </th>
              </tr>
            </thead>
            <tbody>
              {recentProducts.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="relative w-8 h-10 overflow-hidden flex-shrink-0">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="32px"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--foreground)]">{product.name}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-[var(--foreground-muted)]">{product.brand}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs tracking-[0.08em] uppercase text-[var(--foreground-subtle)]">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--foreground)]">
                      ${product.priceMin}
                      {product.priceMax !== product.priceMin && `–$${product.priceMax}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {product.isNew ? (
                      <span className="text-[9px] tracking-[0.14em] uppercase border border-[var(--foreground)] text-[var(--foreground)] px-1.5 py-0.5 leading-none">
                        New
                      </span>
                    ) : (
                      <span className="text-[var(--foreground-subtle)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-4">
          Quick Actions
        </h2>
        <div className="flex gap-3">
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 border border-[var(--border)] px-5 py-2.5 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1V11M1 6H11"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            Add Product
          </Link>
          <Link
            href="/admin/outfits"
            className="inline-flex items-center gap-2 border border-[var(--border)] px-5 py-2.5 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1V11M1 6H11"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            Add Outfit
          </Link>
        </div>
      </div>
    </div>
  );
}
