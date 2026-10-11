import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = pageMetadata({
  title: "Browse Clothing, Shoes & Outfits",
  description:
    "Clothing, shoes and accessories from leading brands in one catalog, plus ready-made outfits. Compare prices across stores and buy from the original retailer.",
  path: "/browse",
});

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
