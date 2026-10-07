"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// Marks shared by every card that shows a saved thing — the look cards in
// the profile's My Looks panel and the liked-outfit cards on /saved — and the
// phone empty state of their tabs. They live here so neither page owns the
// other's punctuation.

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

/** Heart glyph of an empty likes tab. */
export function HeartIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z" />
    </svg>
  );
}

/** A blank look frame with a plus — the empty My looks tab. */
export function NewLookIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="3.5" width="15" height="17" rx="3" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  );
}

/**
 * Empty tab on a phone (DESIGN_SYSTEM.md §12.12, mockup v2 «Б · Лайки — пусто»):
 * one plaque, a soft icon circle, a line of what to do, and one primary pill.
 * Desktop keeps its own block, so this one hides from md up.
 */
export function PhoneEmpty({ icon, title, text, href, action }: {
  icon: ReactNode;
  title: string;
  text: string;
  href: string;
  action: string;
}) {
  return (
    <div className="md:hidden rounded-2xl bg-[var(--surface)] px-7 py-[52px] text-center">
      <span className="mx-auto w-16 h-16 rounded-full bg-[var(--fg-overlay-08)] flex items-center justify-center text-[var(--foreground-muted)]">
        {icon}
      </span>
      <h2 className="mt-[18px] text-[19px] font-semibold text-[var(--foreground)]">{title}</h2>
      <p className="mt-1.5 text-[14px] leading-normal text-[var(--foreground-muted)]">{text}</p>
      <Link href={href}
        className="mx-auto mt-[22px] w-fit h-[46px] px-[22px] rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center text-[15px] font-semibold">
        {action}
      </Link>
    </div>
  );
}
