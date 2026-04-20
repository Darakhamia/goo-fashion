import type { Metadata } from "next";
import "./globals.css";
import { Fraunces, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { LikesProvider } from "@/lib/context/likes-context";
import { AuthProvider } from "@/lib/context/auth-context";
import { ThemeProvider } from "@/lib/context/theme-context";
import { CartProvider } from "@/lib/context/cart-context";
import ConditionalSiteLayout from "@/components/layout/ConditionalSiteLayout";
import AnalyticsTracker from "@/components/analytics/AnalyticsTracker";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

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
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`dark ${fraunces.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
      >
        <head>
          {/* Inline script prevents flash of wrong theme on load */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('goo-theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}})()`,
            }}
          />
        </head>
        <body className="antialiased">
          <ThemeProvider>
            <AuthProvider>
              <LikesProvider>
                <CartProvider>
                  <ConditionalSiteLayout>{children}</ConditionalSiteLayout>
                  <AnalyticsTracker />
                </CartProvider>
              </LikesProvider>
            </AuthProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
