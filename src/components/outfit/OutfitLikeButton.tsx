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
    if (!isLoggedIn) { login("", ""); return; }
    toggleOutfitLike(outfitId);
  };

  return (
    <button
      onClick={handleLike}
      aria-label={!isLoggedIn ? "Sign in to save outfit" : liked ? "Unlike outfit" : "Like outfit"}
      aria-pressed={liked}
      className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-full"
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="text-white">
        <path
          d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
          stroke="currentColor"
          strokeWidth="1.3"
          fill={liked ? "currentColor" : "none"}
        />
      </svg>
    </button>
  );
}
