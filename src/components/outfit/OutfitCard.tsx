"use client";

import Link from "next/link";
import Image from "next/image";
import { Outfit } from "@/lib/types";
import { useLikes } from "@/lib/context/likes-context";
import OutfitCollage from "./OutfitCollage";

interface OutfitCardProps {
  outfit: Outfit;
  size?: "default" | "large";
  compact?: boolean;
}

export default function OutfitCard({ outfit, size = "default", compact = false }: OutfitCardProps) {
  const { isOutfitLiked, toggleOutfitLike } = useLikes();
  const liked = isOutfitLiked(outfit.id);

  return (
    <div className="group relative block">
      <Link href={`/outfit/${outfit.id}`} className="block">
        {/* Image */}
        <div className={`img-zoom relative bg-[var(--surface)] overflow-hidden ${size === "large" ? "aspect-[3/4]" : "aspect-[3/4]"}`}>
          {outfit.imageUrl ? (
            <div className="absolute inset-0">
              <Image
                src={outfit.imageUrl}
                alt={outfit.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              />
            </div>
          ) : (
            <OutfitCollage
              outfit={outfit}
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            />
          )}

          {/* AI Badge */}
          {outfit.isAIGenerated && (
            <div className="absolute top-2 left-2 z-10">
              <span className="text-[8px] tracking-[0.16em] uppercase font-medium bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)] px-2 py-1 block">
                AI
              </span>
            </div>
          )}

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--fg-overlay-08)] transition-colors duration-500 z-10" />

          {/* Hover Label */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
            <span className="text-[9px] tracking-[0.18em] uppercase font-medium bg-[var(--bg-overlay-95)] backdrop-blur-sm text-[var(--foreground)] px-3 py-1.5">
              View Outfit
            </span>
          </div>
        </div>
      </Link>

      {/* Like Button */}
      <button
        onClick={() => toggleOutfitLike(outfit.id)}
        aria-label={liked ? "Unlike outfit" : "Like outfit"}
        className="absolute top-2 right-2 z-20 w-7 h-7 flex items-center justify-center bg-[var(--bg-overlay-90)] backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
            stroke="currentColor"
            strokeWidth="1.3"
            fill={liked ? "currentColor" : "none"}
            className="text-[var(--foreground)]"
          />
        </svg>
      </button>

      {/* Info */}
      {!compact && (
        <Link href={`/outfit/${outfit.id}`} className="block mt-3 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xs font-medium text-[var(--foreground)] leading-snug">{outfit.name}</h3>
            {liked && (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 mt-0.5 text-[var(--foreground)]">
                <path d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z" />
              </svg>
            )}
          </div>
          <p className="text-[10px] text-[var(--foreground-muted)]">
            {outfit.items.length} pieces
            <span className="mx-1.5 text-[var(--foreground-subtle)]">·</span>
            ${outfit.totalPriceMin.toLocaleString()}–${outfit.totalPriceMax.toLocaleString()}
          </p>
          <p className="text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)]">
            {outfit.occasion}
          </p>
        </Link>
      )}
    </div>
  );
}
