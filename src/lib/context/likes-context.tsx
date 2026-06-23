"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";

interface LikesContextValue {
  likedOutfits: string[];
  likedProducts: string[];
  toggleOutfitLike: (id: string) => void;
  toggleProductLike: (id: string) => void;
  isOutfitLiked: (id: string) => boolean;
  isProductLiked: (id: string) => boolean;
  /** Wishlist items added since the user last opened their wishlist. */
  unseenCount: number;
  /** Mark every saved item as seen — clears the wishlist badge. */
  markWishlistSeen: () => void;
}

const LikesContext = createContext<LikesContextValue>({
  likedOutfits: [],
  likedProducts: [],
  toggleOutfitLike: () => {},
  toggleProductLike: () => {},
  isOutfitLiked: () => false,
  isProductLiked: () => false,
  unseenCount: 0,
  markWishlistSeen: () => {},
});

// Stable, collision-free keys for the "seen" set (outfit vs product ids could
// otherwise overlap).
function keysFrom(outfits: string[], products: string[]): string[] {
  return [...outfits.map((o) => `o:${o}`), ...products.map((p) => `p:${p}`)];
}

export function LikesProvider({ children }: { children: React.ReactNode }) {
  const [likedOutfits, setLikedOutfits] = useState<string[]>([]);
  const [likedProducts, setLikedProducts] = useState<string[]>([]);
  // null until the seen-set has been loaded/initialised for the current user.
  // While null we report 0 unseen so the badge never flashes during load.
  const [seenKeys, setSeenKeys] = useState<string[] | null>(null);
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? null;
  const prevUserIdRef = useRef<string | null>(null);

  // localStorage key is namespaced per user so one account's "new" badge
  // doesn't bleed into another on a shared browser.
  const seenStorageKey = (uid: string | null) => `goo-wishlist-seen:${uid ?? "guest"}`;

  // Establish the baseline of "already seen" items. The first time we ever see
  // a user we treat their existing wishlist as seen, so introducing this badge
  // (or simply loading a long-standing wishlist) doesn't light it up.
  const initSeen = (uid: string | null, outfits: string[], products: string[]) => {
    try {
      const raw = localStorage.getItem(seenStorageKey(uid));
      if (raw != null) {
        setSeenKeys(JSON.parse(raw));
      } else {
        const keys = keysFrom(outfits, products);
        localStorage.setItem(seenStorageKey(uid), JSON.stringify(keys));
        setSeenKeys(keys);
      }
    } catch {
      setSeenKeys([]);
    }
  };

  // Load likes — from API when logged in, else from localStorage
  useEffect(() => {
    if (!isLoaded) return;

    if (userId) {
      if (prevUserIdRef.current === userId) return;
      prevUserIdRef.current = userId;

      fetch("/api/user/likes")
        .then((r) => r.json())
        .then((d) => {
          const outfits = Array.isArray(d.outfits) ? d.outfits : [];
          const products = Array.isArray(d.products) ? d.products : [];
          setLikedOutfits(outfits);
          setLikedProducts(products);
          initSeen(userId, outfits, products);
        })
        .catch(() => {
          // fallback to localStorage on network error
          try {
            const o = localStorage.getItem("goo-liked-outfits");
            const p = localStorage.getItem("goo-liked-products");
            const outfits = o ? JSON.parse(o) : [];
            const products = p ? JSON.parse(p) : [];
            setLikedOutfits(outfits);
            setLikedProducts(products);
            initSeen(userId, outfits, products);
          } catch {}
        });
    } else {
      prevUserIdRef.current = null;
      try {
        const o = localStorage.getItem("goo-liked-outfits");
        const p = localStorage.getItem("goo-liked-products");
        const outfits = o ? JSON.parse(o) : [];
        const products = p ? JSON.parse(p) : [];
        setLikedOutfits(outfits);
        setLikedProducts(products);
        initSeen(null, outfits, products);
      } catch {}
    }
    // initSeen is recreated each render but only reads stable refs/localStorage;
    // re-running this effect on every render is neither wanted nor needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId]);

  const toggleOutfitLike = (id: string) => {
    setLikedOutfits((prev) => {
      const liked = !prev.includes(id);
      const next = liked ? [...prev, id] : prev.filter((x) => x !== id);
      try { localStorage.setItem("goo-liked-outfits", JSON.stringify(next)); } catch {}
      if (userId) {
        fetch("/api/user/likes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: "outfit", entityId: id, liked }),
        }).catch(() => {});
      }
      return next;
    });
  };

  const toggleProductLike = (id: string) => {
    setLikedProducts((prev) => {
      const liked = !prev.includes(id);
      const next = liked ? [...prev, id] : prev.filter((x) => x !== id);
      try { localStorage.setItem("goo-liked-products", JSON.stringify(next)); } catch {}
      if (userId) {
        fetch("/api/user/likes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: "product", entityId: id, liked }),
        }).catch(() => {});
      }
      return next;
    });
  };

  const markWishlistSeen = () => {
    const keys = keysFrom(likedOutfits, likedProducts);
    try { localStorage.setItem(seenStorageKey(userId), JSON.stringify(keys)); } catch {}
    setSeenKeys(keys);
  };

  const unseenCount = (() => {
    if (seenKeys === null) return 0;
    const seen = new Set(seenKeys);
    return keysFrom(likedOutfits, likedProducts).filter((k) => !seen.has(k)).length;
  })();

  return (
    <LikesContext.Provider
      value={{
        likedOutfits,
        likedProducts,
        toggleOutfitLike,
        toggleProductLike,
        isOutfitLiked: (id) => likedOutfits.includes(id),
        isProductLiked: (id) => likedProducts.includes(id),
        unseenCount,
        markWishlistSeen,
      }}
    >
      {children}
    </LikesContext.Provider>
  );
}

export const useLikes = () => useContext(LikesContext);
