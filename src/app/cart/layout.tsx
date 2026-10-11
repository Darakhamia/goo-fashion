import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component, so its metadata lives here. It is one
// visitor's own bag with nothing worth a search result, so it stays out of the index.
export const metadata: Metadata = pageMetadata({
  title: "Your Bag",
  description: "The pieces you picked, with a link to buy each one from its store.",
  path: "/cart",
  noindex: true,
});

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
