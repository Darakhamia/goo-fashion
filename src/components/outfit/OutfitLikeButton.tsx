"use client";

import { useLikes } from "@/lib/context/likes-context";
import { useAuth } from "@/lib/context/auth-context";

/**
 * The heart that sits on the outfit photo, same corner and same shape as the
 * one on a product page (`ProductClient`) — an outfit is saved the way a piece
 * is saved, from the image, not from a labelled button below it.
 */
export default function OutfitLikeButton({ outfitId }: { outfitId: string }) {
  const { isOutfitLiked, toggleOutfitLike } = useLikes();
  const { isLoggedIn, login } = useAuth();
  const liked = isOutfitLiked(outfitId);

  const handleLike = () => {
    if (!isLoggedIn) { login(); return; }
    toggleOutfitLike(outfitId);
  };

  return (
    <button
      onClick={handleLike}
      aria-label={!isLoggedIn ? "Sign in to save outfit" : liked ? "Unlike outfit" : "Like outfit"}
      aria-pressed={liked}
      className="absolute top-1 right-1 md:top-4 md:right-4 w-12 h-12 md:w-9 md:h-9 flex items-center justify-center md:bg-black/80 md:backdrop-blur-sm md:rounded-full"
    >
      {/* Phones: a light circle in a 48px target (DESIGN_SYSTEM.md §12.6); the
          circle's box dissolves on desktop. */}
      <span className="w-[34px] h-[34px] rounded-full bg-white/80 flex items-center justify-center md:contents">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="md:hidden text-black" aria-hidden="true">
          <path
            d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
            fill={liked ? "currentColor" : "none"}
          />
        </svg>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="hidden md:block text-white">
          <path
            d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
            stroke="currentColor"
            strokeWidth="1.3"
            fill={liked ? "currentColor" : "none"}
          />
        </svg>
      </span>
    </button>
  );
}
