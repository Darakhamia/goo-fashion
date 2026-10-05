import type { Metadata } from "next";
import type { ReactNode } from "react";

// The tab title (GS4-7). Absolute: the admin's template does not reach past
// the Parser layout, which sets a title of its own.
export const metadata: Metadata = { title: { absolute: "Collect · Parser · GOO Admin" } };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
