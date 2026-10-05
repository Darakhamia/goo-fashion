import type { Metadata } from "next";
import type { ReactNode } from "react";

// The tab title: "Duplicates · GOO Admin" (GS4-7).
export const metadata: Metadata = { title: "Duplicates" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
