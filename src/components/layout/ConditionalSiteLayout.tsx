"use client";

import { usePathname } from "next/navigation";
import Navigation from "@/components/layout/Navigation";
import Footer from "@/components/layout/Footer";
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

  if (isBarePage) {
    return <>{children}</>;
  }

  return (
    <>
      <Navigation />
      <main>{children}</main>
      <Footer />
      <FloatingStylist />
    </>
  );
}
