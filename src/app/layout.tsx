import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/layout/Navigation";
import Footer from "@/components/layout/Footer";
import { LikesProvider } from "@/lib/context/likes-context";

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
        <LikesProvider>
          <Navigation />
          <main>{children}</main>
          <Footer />
        </LikesProvider>
      </body>
    </html>
  );
}
