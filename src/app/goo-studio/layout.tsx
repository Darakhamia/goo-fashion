import type { Metadata } from "next";
import type { ReactNode } from "react";
import AdminShell from "./_ui/AdminShell";

// Tab titles (GS4-7): each section's layout.tsx names its page and the
// template adds the admin's name — "Products · GOO Admin". The pages are
// client components and cannot export metadata themselves. The shell sets the
// same title in the admin's language once the page runs.
export const metadata: Metadata = {
  title: { template: "%s · GOO Admin", default: "Dashboard · GOO Admin" },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
