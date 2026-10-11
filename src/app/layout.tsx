import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
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
import CookieConsentBanner from "@/components/consent/CookieConsentBanner";
import BugReportButton from "@/components/internal/BugReportButton";
import { Suspense } from "react";

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
  // Pages give their title without the brand; the template adds it. The default
  // only shows on pages that set no title (404, error).
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  applicationName: SITE_NAME,
  // No canonical, og:url, og:title or description here: each page states its
  // own (lib/seo `pageMetadata`). Inherited from this layout they made every
  // page without its own claim to be the homepage.
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
  },
  // Only the card type: with no twitter:title/description of its own, Next fills
  // them from each page's Open Graph tags. Setting them here made every page
  // that doesn't repeat a twitter block (products, outfits, the journal) share
  // the homepage's title on X.
  twitter: {
    card: "summary_large_image",
  },
  verification: siteVerification(),
};

/**
 * Ownership tags for Google Search Console and Bing Webmaster Tools, when the
 * codes are set. Verifying by DNS record instead needs neither (.env.example).
 */
function siteVerification(): Metadata["verification"] {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.BING_SITE_VERIFICATION?.trim();
  if (!google && !bing) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

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
              __html: `(function(){try{var t=localStorage.getItem('goo-theme');var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)||(t!=='light'&&t!=='system');if(dark){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){document.documentElement.classList.add('dark')}})()`,
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
                    <BugReportButton />
                    <CookieConsentBanner />
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
