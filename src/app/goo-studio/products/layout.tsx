import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ListViewMemory } from "./_view";

// The tab title: "Products · GOO Admin" (GS4-7).
export const metadata: Metadata = { title: "Products" };

// Around the list and the product pages: back from a product, or after a
// reload, the list opens where it was left (_view.tsx).
export default function Layout({ children }: { children: ReactNode }) {
  return <ListViewMemory>{children}</ListViewMemory>;
}
