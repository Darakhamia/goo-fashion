import type { Metadata } from "next";

// The page itself is a client component, so its metadata lives here. /report is
// an internal tool for the team — keep it out of search results.
export const metadata: Metadata = {
  title: "Bug Report — GOO",
  robots: { index: false, follow: false },
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
