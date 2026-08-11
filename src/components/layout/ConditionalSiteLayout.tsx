"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Navigation from "@/components/layout/Navigation";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { StylistProvider, useStylist } from "@/lib/context/stylist-context";
import PageTransition from "@/components/ui/PageTransition";
import type { Product } from "@/lib/types";

// The drawer is ~800 lines and only needed once the user opens the stylist —
// keep it out of the initial bundle of every page.
const StylistDrawer = dynamic(
  () => import("@/components/stylist/StylistDrawer").then((m) => m.StylistDrawer),
  { ssr: false }
);

interface ConditionalSiteLayoutProps {
  children: React.ReactNode;
}

function SiteLayout({ children }: ConditionalSiteLayoutProps) {
  const pathname = usePathname();
  const { isOpen, close } = useStylist();
  const [products, setProducts] = useState<Product[]>([]);

  // Both auth routes are Clerk catch-alls, so a single sign-in walks through
  // /login, /login/factor-one, /login/reset-password-… . Matching only the exact
  // path put the site header, footer and bottom nav back on top of the
  // full-screen auth layout from the second step onwards — and on /register from
  // the very first, since it was never listed here at all.
  const isAuthPage =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/");

  const isBarePage =
    pathname.startsWith("/goo-studio") ||
    isAuthPage ||
    pathname === "/coming-soon" ||
    pathname === "/report";

  const isBuilder = pathname === "/builder";

  useEffect(() => {
    if (isOpen && products.length === 0) {
      fetch("/api/products")
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setProducts(d); })
        .catch(() => {});
    }
  }, [isOpen, products.length]);

  if (isBarePage) {
    return <>{children}</>;
  }

  return (
    <>
      <Navigation />
      <main className={!isBuilder ? "md:pb-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : ""}>
        <PageTransition>{children}</PageTransition>
      </main>
      {/* Footer: hidden entirely on builder */}
      {!isBuilder && (
        <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <Footer />
        </div>
      )}
      {/* Stylist drawer — skip on builder page (builder manages its own with outfit context) */}
      {!isBuilder && (
        <StylistDrawer
          isOpen={isOpen}
          onClose={close}
          surface="browse"
          products={products}
          position="fixed"
        />
      )}

      <MobileBottomNav />
    </>
  );
}

export default function ConditionalSiteLayout({ children }: ConditionalSiteLayoutProps) {
  return (
    <StylistProvider>
      <SiteLayout>{children}</SiteLayout>
    </StylistProvider>
  );
}
