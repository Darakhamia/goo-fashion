"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface CartItem {
  id: string;
  name: string;
  brand: string;
  imageUrl: string;
  price: number;
  retailerUrl: string | null;
}

interface CartContextValue {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  addManyToCart: (items: CartItem[]) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  isInCart: (id: string) => boolean;
}

const CartContext = createContext<CartContextValue>({
  cartItems: [],
  addToCart: () => {},
  addManyToCart: () => {},
  removeFromCart: () => {},
  clearCart: () => {},
  isInCart: () => false,
});

const STORAGE_KEY = "goo-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setCartItems(JSON.parse(stored));
    } catch {}
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
