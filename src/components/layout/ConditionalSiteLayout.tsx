"use client";

import { usePathname } from "next/navigation";
import Navigation from "@/components/layout/Navigation";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { FloatingStylist } from "@/components/stylist/FloatingStylist";

interface ConditionalSiteLayoutProps {
  children: React.ReactNode;
}

export default function ConditionalSiteLayout({ children }: ConditionalSiteLayoutProps) {
  const pathname = usePathname();

  const isBarePage =
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/coming-soon";

  const isBuilder = pathname === "/builder";

  if (isBarePage) {
    return <>{children}</>;
  }

  return (
    <>
      <Navigation />
      <main className={!isBuilder ? "md:pb-0 pb-14" : ""}>{children}</main>
      {/* Footer visible on all screen sizes; on mobile add bottom padding for the tab bar */}
      <div className={!isBuilder ? "pb-14 md:pb-0" : "hidden md:block"}>
        <Footer />
      </div>
      <FloatingStylist />
      <MobileBottomNav />
    </>
  );
}
