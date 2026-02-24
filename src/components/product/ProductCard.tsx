"use client";

import Link from "next/link";
import Image from "next/image";
import { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
  showBrand?: boolean;
}

export default function ProductCard({ product, showBrand = true }: ProductCardProps) {
  return (
    <Link href={`/product/${product.id}`} className="group block">
      {/* Image */}
      <div className="img-zoom relative bg-[var(--surface)] overflow-hidden aspect-[3/4]">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
        />

        {/* New Badge */}
        {product.isNew && (
          <div className="absolute top-3 left-3 z-10">
            <span className="text-[9px] tracking-[0.16em] uppercase font-medium bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)] px-2.5 py-1.5 block">
              New
            </span>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          aria-label="Save item"
        >
          <span className="flex items-center justify-center w-8 h-8 bg-[var(--bg-overlay-90)] backdrop-blur-sm">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </span>
        </button>

        {/* Retailers count overlay */}
        {product.retailers.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
            <div className="bg-[var(--bg-overlay-95)] backdrop-blur-sm px-3 py-2.5">
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)]">
                Available at {product.retailers.length} stores
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-3.5 space-y-1">
        {showBrand && (
          <p className="text-[10px] tracking-[0.16em] uppercase font-medium text-[var(--foreground-subtle)]">
            {product.brand}
          </p>
        )}
        <h3 className="text-sm text-[var(--foreground)] leading-snug group-hover:text-[var(--foreground-muted)] transition-colors duration-200">
          {product.name}
        </h3>
        <p className="text-sm text-[var(--foreground-muted)]">
          {product.priceMin === product.priceMax
            ? `$${product.priceMin.toLocaleString()}`
            : `From $${product.priceMin.toLocaleString()}`}
        </p>
      </div>
    </Link>
  );
}
