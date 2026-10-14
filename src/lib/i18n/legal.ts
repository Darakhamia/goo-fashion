import type { ReactNode } from "react";

/**
 * One numbered section of a legal page (terms, refund, privacy, cookie). Each
 * page keeps its English sections in page.tsx and the Ukrainian ones in uk.tsx
 * next to it; the page renders whichever the visitor's language picks.
 */
export interface LegalSection {
  number: string;
  title: string;
  content: ReactNode;
}
