"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import OutfitCard from "@/components/outfit/OutfitCard";
import type { Outfit } from "@/lib/types";

const EASE = [0.25, 0.46, 0.45, 0.94] as const;
const PER_PAGE = 3;

interface Props {
  outfits: Outfit[];
}

export default function OutfitExamplesCarousel({ outfits }: Props) {
  const [page, setPage] = useState(0);
  const total = Math.ceil(outfits.length / PER_PAGE);

  useEffect(() => {
    if (total <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % total), 5000);
    return () => clearInterval(t);
  }, [total]);

  const visible = outfits.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  if (outfits.length === 0) {
    return null;
  }

  return (
    <div>
      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.38, ease: EASE }}
        >
          {visible.map((outfit) => (
            <OutfitCard key={outfit.id} outfit={outfit} />
          ))}
        </motion.div>
      </AnimatePresence>

      {total > 1 && (
        <div className="flex items-center justify-center gap-4 mt-10">
          <button
            onClick={() => setPage((p) => (p - 1 + total) % total)}
            className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2L4.5 6L7.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex gap-2">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className="rounded-full bg-[var(--foreground)] transition-all"
                style={{
                  width: i === page ? 24 : 8,
                  height: 8,
                  opacity: i === page ? 1 : 0.2,
                }}
              />
            ))}
          </div>

          <button
            onClick={() => setPage((p) => (p + 1) % total)}
            className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2L7.5 6L4.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
