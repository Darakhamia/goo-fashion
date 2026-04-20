"use client";

import { useEffect, useState } from "react";
import { useLikes } from "@/lib/context/likes-context";
import { useAuth } from "@/lib/context/auth-context";
import { track } from "@/lib/analytics/track";

interface OutfitActionsProps {
  outfitId: string;
}

export default function OutfitActions({ outfitId }: OutfitActionsProps) {
  const { isOutfitLiked, toggleOutfitLike } = useLikes();
  const { isLoggedIn, login } = useAuth();
  const [copied, setCopied] = useState(false);

  const liked = isOutfitLiked(outfitId);

  useEffect(() => {
    track("outfit_view", { targetId: outfitId });
  }, [outfitId]);

  const handleLike = () => {
    if (!isLoggedIn) {
      login("", "");
      return;
    }
    toggleOutfitLike(outfitId);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        // User cancelled or error — do nothing
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-12">
      <button
        onClick={handleLike}
        className={`text-xs tracking-[0.14em] uppercase font-medium px-8 py-4 transition-opacity duration-200 flex items-center justify-center gap-2 ${
          liked
            ? "text-[var(--foreground)] bg-transparent border border-[var(--foreground)] hover:opacity-70"
            : "text-[var(--background)] bg-[var(--foreground)] hover:opacity-80"
        }`}
      >
        {!isLoggedIn ? (
          "Sign in to save"
        ) : liked ? (
          <>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z" />
            </svg>
            Saved
          </>
        ) : (
          "Save Outfit"
        )}
      </button>
      <button
        onClick={handleShare}
        className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] border border-[var(--border)] px-8 py-4 hover:border-[var(--border-strong)] transition-colors duration-200"
      >
        {copied ? "Link Copied!" : "Share"}
      </button>
    </div>
  );
}
