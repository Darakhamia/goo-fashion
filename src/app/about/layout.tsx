import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "GOO is an AI-powered fashion platform: one catalog of pieces from many stores, an outfit builder and an AI stylist that takes you from idea to outfit.",
  path: "/about",
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
