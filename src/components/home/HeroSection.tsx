"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { GooeyText } from "@/components/ui/gooey-text-morphing";
import { EtherealShadow } from "@/components/ui/etheral-shadow";

export function HeroSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <section className="bg-[var(--background)] min-h-[100svh] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ethereal shadow background */}
      {mounted && (
        <div className="absolute inset-0 z-0">
          <EtherealShadow
            color="rgba(0, 0, 0, 0.13)"
            animation={{ scale: 55, speed: 65 }}
            noise={{ opacity: 0.5, scale: 1.1 }}
            sizing="fill"
          />
        </div>
      )}

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        <GooeyText
          texts={["Outfits", "Looks", "Style", "Fits"]}
          morphTime={1}
          cooldownTime={0.35}
          className="h-[76px] md:h-[120px] lg:h-[148px] w-full"
          textClassName="text-[64px] md:text-[100px] lg:text-[128px]"
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
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 z-10">
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
