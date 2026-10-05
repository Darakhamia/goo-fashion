import type { Metadata } from "next";
import type { ReactNode } from "react";

// The tab title: "AI check · GOO Admin" (GS4-7).
export const metadata: Metadata = { title: "AI check" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
