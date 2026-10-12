// Copied from src/app/builder/page.tsx:111-137 (SlotIcon), unchanged.
import React from "react";
import type { SlotId } from "../../fixtures/story";

export function SlotIcon({ id, size = 15 }: { id: SlotId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {id === "outerwear" && (
        <path d="M5 2L2 5V7.5L4 6.5V14H12V6.5L14 7.5V5L11 2C11 2 10.2 3.5 8 3.5C5.8 3.5 5 2 5 2ZM6 2.5V7M10 2.5V7"
          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {id === "top" && (
        <path d="M6 2L2 5V7L4 6V14H12V6L14 7V5L10 2C10 2 9.5 4 8 4C6.5 4 6 2 6 2Z"
          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      )}
      {id === "bottom" && (
        <path d="M4 2H12L13 8H9L8 14H8L7 8H3L4 2Z"
          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      )}
      {id === "shoes" && (<>
        <path d="M2 11.5C2 11.5 4 10 7 10C9 10 10 11 11 11H13.5C13.5 11 14 11 14 12V13H2V11.5Z"
          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M7 10V7.5C7 7.5 7.5 5 10 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </>)}
      {(id === "accessories" || id === "accessories2") && (<>
        <rect x="3" y="6" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <path d="M6 6V4.5C6 3.7 6.7 3 7.5 3H8.5C9.3 3 10 3.7 10 4.5V6" stroke="currentColor" strokeWidth="1.1" />
      </>)}
    </svg>
  );
}
