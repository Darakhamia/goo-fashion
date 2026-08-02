"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import OutfitCard from "@/components/outfit/OutfitCard";
import type { Outfit } from "@/lib/types";

const EASE = [0.25, 0.46, 0.45, 0.94] as const;
const PER_PAGE = 3;

interface Props {
  outfits: Outfit[];
}

export default function OutfitExamplesCarousel({ outfits }: Props) {
  const [page, setPage] = useState(0);
  // The rail is swipeable on phones, and a page that turns itself under the
  // finger is worse than one that never turned at all — so the moment the
  // reader takes the wheel, the carousel stops driving.
  const [taken, setTaken] = useState(false);
  const total = Math.ceil(outfits.length / PER_PAGE);

  useEffect(() => {
    if (total <= 1 || taken) return;
    const t = setInterval(() => setPage((p) => (p + 1) % total), 5000);
    return () => clearInterval(t);
  }, [total, taken]);

  const goTo = (next: number) => {
    setTaken(true);
    setPage(next);
  };

  const visible = outfits.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  if (outfits.length === 0) {
    return null;
  }

  return (
    <div>
      <AnimatePresence mode="wait">
        {/* Phones run the page as a swipeable rail that bleeds past the gutter,
            so the third card peeks in and the row reads as "there's more" —
            nudge it across to see that card whole; the dots below turn the page.
            Deliberately unsnapped: three cards at this width leave less than one
            card of travel, so the last card's snap position sits past the end of
            the rail and mandatory snapping would spring every swipe back to the
            start. Wide screens keep the three-up grid. */}
        <motion.div
          key={page}
          onPointerDown={() => setTaken(true)}
          className="flex gap-3 overflow-x-auto overscroll-x-contain -mr-6 pr-6 pb-1 no-scrollbar md:mr-0 md:pr-0 md:pb-0 md:overflow-visible md:grid md:grid-cols-3 md:gap-5"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.38, ease: EASE }}
        >
          {visible.map((outfit) => (
            <div
              key={outfit.id}
              className="shrink-0 w-[43%] min-w-[140px] md:w-auto md:min-w-0"
            >
              <OutfitCard outfit={outfit} />
            </div>
          ))}
        </motion.div>
      </AnimatePresence>

      {total > 1 && (
        <div className="mt-6 md:mt-8 flex flex-col items-center gap-4 md:flex-row md:justify-center">
          <div className="flex gap-2 order-1 md:order-2">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to page ${i + 1} of ${total}`}
                className="rounded-full bg-[var(--foreground)] transition-all"
                style={{
                  width: i === page ? 24 : 8,
                  height: 8,
                  opacity: i === page ? 1 : 0.2,
                }}
              />
            ))}
          </div>

          {/* `md:contents` drops this wrapper at desktop, so the two arrows land
              either side of the dots instead of on a row of their own. */}
          <div className="order-2 flex items-center gap-4 md:contents">
            <button
              onClick={() => goTo((page - 1 + total) % total)}
              aria-label="Previous outfits"
              className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors md:order-1"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M7.5 2L4.5 6L7.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button
              onClick={() => goTo((page + 1) % total)}
              aria-label="Next outfits"
              className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors md:order-3"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4.5 2L7.5 6L4.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
