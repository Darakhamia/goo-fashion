import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component, so its metadata lives here. It is a
// checkout step with nothing worth a search result, so it stays out of the index.
export const metadata: Metadata = pageMetadata({
  title: "Subscribe",
  description: "Choose a GOO plan and pay for it.",
  path: "/subscribe",
  noindex: true,
});

export default function SubscribeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
