"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    step: "01",
    title: "Set your profile",
    body: "Body type, color preferences, occasions, budget. Done once, refined over time.",
  },
  {
    step: "02",
    title: "AI builds your outfit",
    body: "Our model selects pieces that fit together — aesthetically and proportionally.",
  },
  {
    step: "03",
    title: "Buy at the best price",
    body: "Each item is price-compared across 50+ retailers. You choose where to buy.",
  },
];

export default function HowItWorksGrid() {
  return (
    <motion.div
      className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
    >
      {STEPS.map((item) => (
        <motion.div
          key={item.step}
          variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="bg-[var(--surface)] rounded-2xl p-8 md:p-10 flex flex-col gap-5 border border-[var(--border)] hover:border-[var(--foreground-muted)] transition-colors duration-200"
        >
          <div className="w-10 h-10 rounded-full bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-[11px] font-bold tracking-[0.1em] text-[var(--foreground-subtle)]">
            {item.step}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">{item.title}</h3>
            <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">{item.body}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
