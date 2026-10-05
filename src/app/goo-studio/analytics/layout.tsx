import type { Metadata } from "next";
import type { ReactNode } from "react";

// The tab title: "Analytics · GOO Admin" (GS4-7).
export const metadata: Metadata = { title: "Analytics" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
