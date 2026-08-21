"use client";

import { createContext, useContext, useEffect, useState } from "react";

/** One place a piece can be bought, as the cart keeps it. */
export interface CartRetailer {
  name: string;
  url: string;
  price?: number;
  currency?: string;
  isOfficial?: boolean;
}

export interface CartItem {
  id: string;
  name: string;
  brand: string;
  imageUrl: string;
  price: number;
  currency?: string;
  /** The store opened by default. Kept for carts saved before `retailers` existed. */
  retailerUrl: string | null;
  /** Every store carrying the piece, so the row can offer a choice. */
  retailers?: CartRetailer[];
}

interface CartContextValue {
  cartItems: CartItem[];
  /** False until the stored cart has been read, so a page can wait instead of flashing "empty". */
  hydrated: boolean;
  addToCart: (item: CartItem) => void;
  addManyToCart: (items: CartItem[]) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  isInCart: (id: string) => boolean;
}

const CartContext = createContext<CartContextValue>({
  cartItems: [],
  hydrated: false,
  addToCart: () => {},
  addManyToCart: () => {},
  removeFromCart: () => {},
  clearCart: () => {},
  isInCart: () => false,
});

const STORAGE_KEY = "goo-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setCartItems(JSON.parse(stored));
    } catch {}
    // Set in the same effect as the read, so a consumer never sees a rendered
    // frame where the cart is both "hydrated" and still empty.
    setHydrated(true);
  }, []);

  const persist = (items: CartItem[]) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  };

  const addToCart = (item: CartItem) => {
    setCartItems(prev => {
      if (prev.some(x => x.id === item.id)) return prev;
      const next = [...prev, item];
      persist(next);
      return next;
    });
  };

  const addManyToCart = (items: CartItem[]) => {
    setCartItems(prev => {
      const existingIds = new Set(prev.map(x => x.id));
      const newItems = items.filter(i => !existingIds.has(i.id));
      if (newItems.length === 0) return prev;
      const next = [...prev, ...newItems];
      persist(next);
      return next;
    });
  };

  const removeFromCart = (id: string) => {
    setCartItems(prev => {
      const next = prev.filter(x => x.id !== id);
      persist(next);
      return next;
    });
  };

  const clearCart = () => {
    setCartItems([]);
    persist([]);
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      hydrated,
      addToCart,
      addManyToCart,
      removeFromCart,
      clearCart,
      isInCart: (id) => cartItems.some(x => x.id === id),
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
