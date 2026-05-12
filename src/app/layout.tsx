import type { Metadata } from "next";
import "./globals.css";
import { Inter_Tight } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { LikesProvider } from "@/lib/context/likes-context";
import { AuthProvider } from "@/lib/context/auth-context";
import { ThemeProvider } from "@/lib/context/theme-context";
import { CartProvider } from "@/lib/context/cart-context";
import { CurrencyProvider } from "@/lib/context/currency-context";
import ConditionalSiteLayout from "@/components/layout/ConditionalSiteLayout";
import AnalyticsTracker from "@/components/analytics/AnalyticsTracker";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
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

// Fallback key satisfies Clerk's base64 format check (pk_test_ + base64("clerk.example.com$"))
// so the build succeeds when the real key isn't present in the build environment.
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider publishableKey={clerkKey}>
      <html
        lang="en"
        suppressHydrationWarning
        className={`dark ${interTight.variable}`}
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
                  <CurrencyProvider>
                    <ConditionalSiteLayout>{children}</ConditionalSiteLayout>
                    <AnalyticsTracker />
                  </CurrencyProvider>
                </CartProvider>
              </LikesProvider>
            </AuthProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
