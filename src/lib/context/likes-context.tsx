"use client";

import { createContext, useContext, useEffect, useState } from "react";

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

  useEffect(() => {
    try {
      const o = localStorage.getItem("goo-liked-outfits");
      const p = localStorage.getItem("goo-liked-products");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (o) setLikedOutfits(JSON.parse(o));
      if (p) setLikedProducts(JSON.parse(p));
    } catch {}
  }, []);

  const toggleOutfitLike = (id: string) => {
    setLikedOutfits((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem("goo-liked-outfits", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const toggleProductLike = (id: string) => {
    setLikedProducts((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem("goo-liked-products", JSON.stringify(next)); } catch {}
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
