"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Navigation from "@/components/layout/Navigation";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { FloatingStylist } from "@/components/stylist/FloatingStylist";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import { StylistProvider, useStylist } from "@/lib/context/stylist-context";
import type { Product } from "@/lib/types";

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
    pathname === "/coming-soon";

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
      <main className={!isBuilder ? "md:pb-0 pb-14" : ""}>{children}</main>
      {/* Footer: hidden entirely on builder */}
      {!isBuilder && (
        <div className="pb-14 md:pb-0">
          <Footer />
        </div>
      )}
      <FloatingStylist />

      {/* Mobile stylist drawer — skip on builder page (builder manages its own with outfit context) */}
      {!isBuilder && (
        <div className="md:hidden">
          <StylistDrawer
            isOpen={isOpen}
            onClose={close}
            surface="browse"
            products={products}
            position="fixed"
          />
        </div>
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
