import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = pageMetadata({
  title: "Outfit Builder",
  description:
    "Put an outfit together from pieces across stores, see the total price and preview the look with AI before you buy.",
  path: "/builder",
});

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
