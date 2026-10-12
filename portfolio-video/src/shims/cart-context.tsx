// Shim for src/lib/context/cart-context.tsx: an empty bag. The two types are
// copied from the app so the vendored cart-item.ts keeps compiling.
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
  retailerUrl: string | null;
  retailers?: CartRetailer[];
}

const value = {
  items: [] as CartItem[],
  addToCart: (_item: CartItem) => {},
  addManyToCart: (_items: CartItem[]) => {},
  removeFromCart: (_id: string) => {},
  isInCart: (_id: string) => false,
};

export const useCart = () => value;
