"use client";

import { useLocale } from "@/lib/context/locale-context";

/**
 * Shows the version of a block for the current language. For long texts kept
 * as whole documents (the legal pages): both versions are rendered on the
 * server and passed in, this only picks one.
 */
export default function ByLocale({ en, uk }: { en: React.ReactNode; uk: React.ReactNode }) {
  return <>{useLocale().locale === "uk" ? uk : en}</>;
}
