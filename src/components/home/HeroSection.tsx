"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GooeyText } from "@/components/ui/gooey-text-morphing";
import { EtherealShadow } from "@/components/ui/etheral-shadow";

export function HeroSection() {
  return (
    // The nav sits above the hero in the flow, so the hero takes the rest of the
    // first screen — putting the next section exactly one screen down. On phones
    // the floating bottom nav claims the last strip, so the content centres in
    // what's left rather than behind it.
    <section
      data-home-section
      // scroll-mt: the hero sits below the nav's own place in the flow, so
      // anything scrolling to it has to reach back up over the nav for it to
      // rest at the very top of the page instead of 66px into it.
      className="bg-[var(--background)] min-h-[calc(100svh-var(--home-nav-h))] scroll-mt-[var(--home-nav-h)] pb-[var(--home-bottom-nav-h)] md:pb-0 flex flex-col items-center justify-center relative overflow-hidden"
    >
      {/* Background — CSS blobs only, no SVG filter */}
      <div className="absolute inset-0 z-0">
        <EtherealShadow />
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-7 md:gap-8 px-6 text-center">
        <div className="flex flex-col items-center gap-3 w-full">
          <GooeyText
            texts={["GOO", "Outfits", "Looks", "Style", "Fits"]}
            morphTime={1}
            cooldownTime={0.35}
            firstTextCooldown={2.2}
            className="h-[86px] md:h-[120px] lg:h-[148px] w-full"
            textClassName="text-[72px] md:text-[100px] lg:text-[128px]"
          />

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-[15px] md:text-base tracking-[-0.01em] text-[var(--foreground-muted)]"
          >
            Build your look
          </motion.p>
        </div>

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

      {/* Scroll indicator — also a shortcut to the next section */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("home-fullpage:next"))}
        aria-label="Go to the next section"
        className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 z-10 cursor-pointer hover:opacity-70 transition-opacity"
      >
        <span className="text-[10px] tracking-[0.14em] text-[var(--foreground-subtle)]">
          Scroll to explore
        </span>
        <div className="animate-scroll-hint text-[var(--foreground-subtle)]">
          <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
            <line x1="7" y1="0" x2="7" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M2 10L7 16L12 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
    </section>
  );
}
