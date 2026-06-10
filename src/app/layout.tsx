import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/seo";
import { Inter_Tight, Poppins } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { LikesProvider } from "@/lib/context/likes-context";
import { AuthProvider } from "@/lib/context/auth-context";
import { ThemeProvider } from "@/lib/context/theme-context";
import { CartProvider } from "@/lib/context/cart-context";
import { CurrencyProvider } from "@/lib/context/currency-context";
import ConditionalSiteLayout from "@/components/layout/ConditionalSiteLayout";
import AnalyticsTracker from "@/components/analytics/AnalyticsTracker";
import PostHogTracker from "@/components/analytics/PostHogTracker";
import BugReportButton from "@/components/internal/BugReportButton";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves all relative canonical/og URLs against the canonical non-www origin.
  metadataBase: new URL(SITE_URL),
  title: "GOO — AI Stylist",
  description: "Your personal AI stylist. Curated outfits, premium fashion, one platform.",
  keywords: ["fashion", "AI stylist", "outfits", "luxury fashion", "personal stylist"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "GOO — AI Stylist",
    description: "Your personal AI stylist. Curated outfits, premium fashion, one platform.",
    type: "website",
    url: SITE_URL,
    siteName: "GOO",
  },
  twitter: {
    card: "summary_large_image",
    title: "GOO — AI Stylist",
    description: "Your personal AI stylist. Curated outfits, premium fashion, one platform.",
  },
};

// viewportFit: "cover" lets the page extend under the iPhone notch/home-indicator
// so `env(safe-area-inset-*)` returns real values for our fixed bottom nav & sheets.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
        className={`dark ${interTight.variable} ${poppins.variable}`}
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
                    {/* useSearchParams requires a Suspense boundary */}
                    <Suspense fallback={null}>
                      <PostHogTracker />
                    </Suspense>
                    <Analytics />
                    <SpeedInsights />
                    <BugReportButton />
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
