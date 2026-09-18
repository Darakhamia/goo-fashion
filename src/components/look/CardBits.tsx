"use client";

// Two marks shared by every card that shows a saved thing — the look cards in
// the profile's My Looks panel and the liked-outfit cards on /saved. They live
// here so neither page owns the other's punctuation.

/** Small coloured dot in front of a status line (availability, publication). */
export function StatusDot({ className }: { className: string }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${className}`} />;
}

/** Shopping bag glyph used by the "add to bag" action on cards. */
export function BagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M6 8h12l-1 12H7L6 8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
