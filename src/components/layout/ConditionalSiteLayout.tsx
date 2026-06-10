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

  const isBarePage =
    pathname.startsWith("/goo-studio") ||
    pathname === "/login" ||
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
      <main className={!isBuilder ? "md:pb-0 pb-14" : ""}>
        <PageTransition>{children}</PageTransition>
      </main>
      {/* Footer: hidden entirely on builder */}
      {!isBuilder && (
        <div className="pb-14 md:pb-0">
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
