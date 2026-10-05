import type { Metadata } from "next";
import type { ReactNode } from "react";

// The tab title: "Parser · GOO Admin" (GS4-7).
export const metadata: Metadata = { title: "Parser" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
