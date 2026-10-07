"use client";

import Link from "next/link";
import Image from "@/components/ui/Image";
import { motion } from "framer-motion";
import { Outfit } from "@/lib/types";
import { useLikes } from "@/lib/context/likes-context";
import { useAuth } from "@/lib/context/auth-context";
import { useCurrency } from "@/lib/context/currency-context";
import OutfitCollage from "./OutfitCollage";

interface OutfitCardProps {
  outfit: Outfit;
}

function PeopleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-2.761 2.239-5 5-5s5 2.239 5 5" strokeLinecap="round" />
      <circle cx="12" cy="5.5" r="2" />
      <path d="M14.5 14c0-2.209-1.119-4-3.5-4.3" strokeLinecap="round" />
    </svg>
  );
}

export default function OutfitCard({ outfit }: OutfitCardProps) {
  const { isOutfitLiked, toggleOutfitLike } = useLikes();
  const { isLoggedIn, login } = useAuth();
  const { formatPrice } = useCurrency();
  const liked = isOutfitLiked(outfit.id);
  const pieceCount = outfit.items.length;

  const handleLike = () => {
    if (!isLoggedIn) { login(); return; }
    toggleOutfitLike(outfit.id);
  };

  return (
    <motion.div
      className="group relative flex flex-col overflow-hidden rounded-2xl md:border md:border-[var(--border)] bg-[var(--surface)] max-md:h-full"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link href={`/outfit/${outfit.id}`} className="block relative">
        <div className="img-zoom relative bg-[var(--surface)] overflow-hidden aspect-[3/4]">
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

          {/* Community badge — perfect circle, expands to pill on hover. Below md
              it is light, like every control on the photo (DESIGN_SYSTEM.md §12.6). */}
          {outfit.source === "community" && (
            <div className="absolute top-2.5 left-2.5 md:top-3 md:left-3 z-10">
              <div className="group/cm inline-flex items-center md:border md:border-[var(--border-strong)] bg-white/80 text-black md:bg-[var(--bg-overlay-90)] md:text-[var(--foreground)] backdrop-blur-sm rounded-full overflow-hidden h-7">
                <span className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                  <PeopleIcon />
                </span>
                <span className="max-w-0 overflow-hidden group-hover/cm:max-w-[80px] transition-[max-width] duration-300 ease-out">
                  <span className="pr-2.5 text-[9px] tracking-[0.14em] uppercase font-bold whitespace-nowrap">
                    Community
                  </span>
                </span>
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--fg-overlay-08)] transition-colors duration-500 z-10" />
        </div>
      </Link>

      {/* Like button. Below md: a 44px target around a small light circle, as on
          the product card (DESIGN_SYSTEM.md §12.6); the circle's box dissolves on desktop. */}
      <button
        onClick={handleLike}
        aria-label={!isLoggedIn ? "Sign in to save outfit" : liked ? "Unlike outfit" : "Like outfit"}
        className="absolute top-0.5 right-0.5 md:top-3 md:right-3 z-20 w-11 h-11 md:w-8 md:h-8 flex items-center justify-center md:bg-[var(--bg-overlay-90)] md:backdrop-blur-sm md:rounded-full transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100"
      >
        <span className="w-7 h-7 rounded-full bg-white/80 flex items-center justify-center md:contents">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="md:hidden text-black" aria-hidden="true">
            <path
              d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
              fill={liked ? "currentColor" : "none"}
            />
          </svg>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="hidden md:block">
            <path
              d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
              stroke="currentColor"
              strokeWidth="1.3"
              fill={liked ? "currentColor" : "none"}
              className="text-[var(--foreground)]"
            />
          </svg>
        </span>
      </button>

      {/* Info. Phones put the piece count beside the price, as on the product card. */}
      <Link href={`/outfit/${outfit.id}`} className="block px-3 pt-2.5 pb-3 md:px-5 md:pt-4 md:pb-5">
        <h3 className="text-[13px] md:text-[15px] font-semibold text-[var(--foreground)] truncate leading-snug">
          {outfit.name}
        </h3>
        <p className="mt-1.5 md:mt-1 flex max-md:flex-wrap items-baseline justify-between gap-x-1.5 max-md:gap-y-0.5 md:block text-[13px] font-medium md:font-normal text-[var(--foreground)] md:text-[var(--foreground-muted)]">
          <span className="max-md:min-w-0 max-md:truncate">
            {formatPrice(outfit.totalPriceMin, outfit.currency)}–{formatPrice(outfit.totalPriceMax, outfit.currency)}
          </span>
          <span className="md:hidden shrink-0 text-[11px] font-normal text-[var(--foreground-muted)]">
            {pieceCount} {pieceCount === 1 ? "piece" : "pieces"}
          </span>
        </p>
      </Link>
    </motion.div>
  );
}
