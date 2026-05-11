"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Outfit } from "@/lib/types";
import { useLikes } from "@/lib/context/likes-context";
import { useAuth } from "@/lib/context/auth-context";
import { useCurrency } from "@/lib/context/currency-context";
import OutfitCollage from "./OutfitCollage";

interface OutfitCardProps {
  outfit: Outfit;
  size?: "default" | "large";
  compact?: boolean;
}

export default function OutfitCard({ outfit, size = "default", compact = false }: OutfitCardProps) {
  const { isOutfitLiked, toggleOutfitLike } = useLikes();
  const { isLoggedIn, login } = useAuth();
  const { formatPrice } = useCurrency();
  const liked = isOutfitLiked(outfit.id);

  const handleLike = () => {
    if (!isLoggedIn) {
      login("", "");
      return;
    }
    toggleOutfitLike(outfit.id);
  };

  return (
    <motion.div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link href={`/outfit/${outfit.id}`} className="block relative">
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

          {/* AI / Community Badges — horizontal row */}
          {(outfit.isAIGenerated || outfit.source === "community") && (
            <div className="absolute top-3 left-3 z-10 flex flex-row gap-1.5 flex-wrap">
              {outfit.isAIGenerated && (
                <span className="text-[9px] tracking-[0.14em] uppercase font-bold bg-[var(--foreground)] text-[var(--background)] px-2.5 py-1 rounded-md">
                  AI
                </span>
              )}
              {outfit.source === "community" && (
                <span className="text-[9px] tracking-[0.14em] uppercase font-bold border border-[var(--border-strong)] bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)] px-2.5 py-1 rounded-md">
                  Community
                </span>
              )}
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--fg-overlay-08)] transition-colors duration-500 z-10" />
        </div>
      </Link>

      {/* Like Button — always visible, circular */}
      <button
        onClick={handleLike}
        aria-label={!isLoggedIn ? "Sign in to save outfit" : liked ? "Unlike outfit" : "Like outfit"}
        className="absolute top-3 right-3 z-20 w-9 h-9 flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] rounded-full shadow-sm hover:border-[var(--foreground-muted)] transition-colors duration-200"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
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
        <div className="flex flex-col gap-3 p-4 pt-3">
          <Link href={`/outfit/${outfit.id}`} className="block">
            <h3 className="text-xl font-bold text-[var(--foreground)] leading-tight">
              {outfit.name}
            </h3>
            <p className="text-sm text-[var(--foreground-muted)] mt-1.5">
              {outfit.items.length} pieces
              <span className="mx-1.5 text-[var(--foreground-subtle)]">·</span>
              {formatPrice(outfit.totalPriceMin)}–{formatPrice(outfit.totalPriceMax)}
            </p>
          </Link>

          {outfit.occasion && (
            <span className="self-start text-[9px] tracking-[0.14em] uppercase font-semibold border border-[var(--border)] text-[var(--foreground-muted)] px-3 py-1 rounded-full">
              {outfit.occasion}
            </span>
          )}

          <Link
            href={`/outfit/${outfit.id}`}
            className="flex items-center justify-between border border-[var(--border-strong)] hover:border-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] text-[var(--foreground)] transition-all duration-200 px-4 py-2.5 rounded-xl group/btn"
          >
            <span className="text-[9px] tracking-[0.16em] uppercase font-bold">View Outfit</span>
            <span className="text-base leading-none font-light text-[var(--foreground-muted)] group-hover/btn:text-[var(--foreground)] transition-colors">→</span>
          </Link>
        </div>
      )}
    </motion.div>
  );
}
