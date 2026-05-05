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
}

const LikesContext = createContext<LikesContextValue>({
  likedOutfits: [],
  likedProducts: [],
  toggleOutfitLike: () => {},
  toggleProductLike: () => {},
  isOutfitLiked: () => false,
  isProductLiked: () => false,
});

export function LikesProvider({ children }: { children: React.ReactNode }) {
  const [likedOutfits, setLikedOutfits] = useState<string[]>([]);
  const [likedProducts, setLikedProducts] = useState<string[]>([]);
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? null;
  const prevUserIdRef = useRef<string | null>(null);

  // Load likes — from API when logged in, else from localStorage
  useEffect(() => {
    if (!isLoaded) return;

    if (userId) {
      if (prevUserIdRef.current === userId) return;
      prevUserIdRef.current = userId;

      fetch("/api/user/likes")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.outfits)) setLikedOutfits(d.outfits);
          if (Array.isArray(d.products)) setLikedProducts(d.products);
        })
        .catch(() => {
          // fallback to localStorage on network error
          try {
            const o = localStorage.getItem("goo-liked-outfits");
            const p = localStorage.getItem("goo-liked-products");
            if (o) setLikedOutfits(JSON.parse(o));
            if (p) setLikedProducts(JSON.parse(p));
          } catch {}
        });
    } else {
      prevUserIdRef.current = null;
      try {
        const o = localStorage.getItem("goo-liked-outfits");
        const p = localStorage.getItem("goo-liked-products");
        if (o) setLikedOutfits(JSON.parse(o));
        if (p) setLikedProducts(JSON.parse(p));
      } catch {}
    }
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

  return (
    <LikesContext.Provider
      value={{
        likedOutfits,
        likedProducts,
        toggleOutfitLike,
        toggleProductLike,
        isOutfitLiked: (id) => likedOutfits.includes(id),
        isProductLiked: (id) => likedProducts.includes(id),
      }}
    >
      {children}
    </LikesContext.Provider>
  );
}

export const useLikes = () => useContext(LikesContext);
