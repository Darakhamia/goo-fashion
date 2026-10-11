import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = pageMetadata({
  title: "Plans & Pricing",
  description:
    "Compare GOO plans. Every plan includes the full catalog, the outfit builder and the AI stylist; paid plans raise the stylist limits and add AI outfit images.",
  path: "/plans",
});

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return children;
}
