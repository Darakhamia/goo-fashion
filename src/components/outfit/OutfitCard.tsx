"use client";

import Link from "next/link";
import Image from "next/image";
import { Outfit } from "@/lib/types";

interface OutfitCardProps {
  outfit: Outfit;
  size?: "default" | "large";
}

export default function OutfitCard({ outfit, size = "default" }: OutfitCardProps) {
  const isLarge = size === "large";

  return (
    <Link href={`/outfit/${outfit.id}`} className="group block">
      {/* Image */}
      <div
        className={`img-zoom relative bg-[var(--surface)] overflow-hidden ${
          isLarge ? "aspect-[3/4]" : "aspect-[3/4]"
        }`}
      >
        <Image
          src={outfit.imageUrl}
          alt={outfit.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />

        {/* AI Badge */}
        {outfit.isAIGenerated && (
          <div className="absolute top-3 left-3 z-10">
            <span className="text-[9px] tracking-[0.16em] uppercase font-medium bg-[var(--background)]/90 backdrop-blur-sm text-[var(--foreground)] px-2.5 py-1.5 block">
              AI
            </span>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-[var(--foreground)]/0 group-hover:bg-[var(--foreground)]/8 transition-colors duration-500 z-10" />

        {/* Hover Label */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
          <span className="text-[10px] tracking-[0.18em] uppercase font-medium bg-[var(--background)]/95 backdrop-blur-sm text-[var(--foreground)] px-4 py-2">
            View Outfit
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-[var(--foreground)] leading-snug">
            {outfit.name}
          </h3>
          {outfit.isSaved && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="shrink-0 mt-0.5 text-[var(--foreground)]"
            >
              <path d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z" />
            </svg>
          )}
        </div>
        <p className="text-xs text-[var(--foreground-muted)]">
          {outfit.items.length} pieces
          <span className="mx-2 text-[var(--foreground-subtle)]">·</span>
          ${outfit.totalPriceMin.toLocaleString()}–${outfit.totalPriceMax.toLocaleString()}
        </p>
        <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)]">
          {outfit.occasion}
        </p>
      </div>
    </Link>
  );
}
