import type { Metadata } from "next";
import type { ReactNode } from "react";

// The tab title: "Email · GOO Admin" (GS4-7).
export const metadata: Metadata = { title: "Email" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
