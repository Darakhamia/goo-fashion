"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import Floating, { FloatingElement } from "@/components/ui/parallax-floating";
import { GooeyText } from "@/components/ui/gooey-text-morphing";
import type { Outfit } from "@/lib/types";

interface HeroSectionProps {
  outfits: Outfit[];
}

const SLOTS = [
  { depth: 0.6,  className: "top-[5%]    left-[6%]",   w: 260, h: 340 },
  { depth: 1.2,  className: "top-[8%]    right-[6%]",  w: 240, h: 316 },
  { depth: 0.8,  className: "top-[36%]   left-[4%]",   w: 280, h: 360 },
  { depth: 1.5,  className: "top-[33%]   right-[4%]",  w: 248, h: 320 },
  { depth: 1.0,  className: "top-[64%]   left-[8%]",   w: 256, h: 328 },
  { depth: 0.7,  className: "top-[60%]   right-[6%]",  w: 264, h: 340 },
  { depth: 1.8,  className: "top-[2%]    left-[34%]",  w: 168, h: 216 },
  { depth: 1.3,  className: "bottom-[2%] left-[38%]",  w: 180, h: 232 },
];

export function HeroSection({ outfits }: HeroSectionProps) {
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setEpoch((e) => e + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const getOutfit = (slotIndex: number) => {
    if (!outfits.length) return null;
    return outfits[(slotIndex + epoch * SLOTS.length) % outfits.length];
  };

  return (
    <section className="bg-[var(--background)] min-h-[100svh] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Parallax floating outfit images */}
      <Floating sensitivity={-0.8} easingFactor={0.04}>
        {SLOTS.map((slot, i) => {
          const outfit = getOutfit(i);
          return (
            <FloatingElement key={i} depth={slot.depth} className={slot.className}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${i}-${epoch}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="rounded-2xl overflow-hidden"
                  style={{ width: slot.w, height: slot.h }}
                >
                  {outfit?.imageUrl ? (
                    <Image
                      src={outfit.imageUrl}
                      alt={outfit.name ?? ""}
                      width={slot.w}
                      height={slot.h}
                      className="object-cover w-full h-full opacity-70 hover:opacity-90 transition-opacity duration-300"
                    />
                  ) : (
                    <div
                      className="w-full h-full bg-[var(--border)] opacity-40"
                      style={{ width: slot.w, height: slot.h }}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </FloatingElement>
          );
        })}
      </Floating>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6">
        <GooeyText
          texts={["Outfits", "Looks", "Style", "Fits"]}
          morphTime={1}
          cooldownTime={0.35}
          className="h-[64px] md:h-[96px] lg:h-[116px] w-full"
          textClassName="text-[52px] md:text-[80px] lg:text-[96px]"
        />

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <Link
            href="/builder"
            className="group relative inline-flex items-center gap-2.5 bg-[var(--foreground)] text-[var(--background)] rounded-full px-8 py-3.5 text-[15px] font-semibold tracking-[-0.01em] hover:gap-4 transition-all duration-300 hover:opacity-90"
          >
            Build your look
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--background)]/15 group-hover:bg-[var(--background)]/25 transition-colors">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 8L8 2M8 2H3M8 2V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5">
        <span className="text-[9px] tracking-[0.3em] uppercase text-[var(--foreground-subtle)]">
          scroll
        </span>
        <div className="animate-scroll-hint text-[var(--foreground-subtle)]">
          <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
            <line x1="7" y1="0" x2="7" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M2 10L7 16L12 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </section>
  );
}
