import type { Metadata } from "next";
import "./globals.css";
import { LikesProvider } from "@/lib/context/likes-context";
import { AuthProvider } from "@/lib/context/auth-context";
import ConditionalSiteLayout from "@/components/layout/ConditionalSiteLayout";

export const metadata: Metadata = {
  title: "GOO — AI Stylist",
  description: "Your personal AI stylist. Curated outfits, premium fashion, one platform.",
  keywords: ["fashion", "AI stylist", "outfits", "luxury fashion", "personal stylist"],
  openGraph: {
    title: "GOO — AI Stylist",
    description: "Your personal AI stylist. Curated outfits, premium fashion, one platform.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <AuthProvider>
          <LikesProvider>
            <ConditionalSiteLayout>{children}</ConditionalSiteLayout>
          </LikesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
