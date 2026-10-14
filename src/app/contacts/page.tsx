import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import ContactsContent from "./ContactsContent";

export const metadata: Metadata = pageMetadata({
  title: "Contacts",
  description: "How to reach GOO, and the details of the sole trader who operates goo-fashion.com.",
  path: "/contacts",
});

export default function ContactsPage() {
  return <ContactsContent />;
}
