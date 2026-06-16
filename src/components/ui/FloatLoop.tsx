"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

interface FloatLoopProps {
  children: ReactNode;
  className?: string;
  /** Phase offset so neighbouring elements don't bob in sync. */
  delay?: number;
  /** Vertical travel in px. */
  distance?: number;
  /** Seconds for one full up-and-down cycle. */
  duration?: number;
}

// Gentle, never-ending float — the same easing language as the rest of the
// page, just looped. Respects reduced-motion preferences.
export default function FloatLoop({
  children,
  className,
  delay = 0,
  distance = 8,
  duration = 5,
}: FloatLoopProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      animate={reduce ? undefined : { y: [0, -distance, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
