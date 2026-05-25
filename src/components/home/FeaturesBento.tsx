"use client";

import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { Outfit } from "@/lib/types";

interface FeaturesBentoProps {
  outfits: Outfit[];
}

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

const STYLIST_CHIPS = [
  { label: "Smart casual looks", icon: "✦" },
  { label: "Summer outfits", icon: "✦" },
  { label: "Date night", icon: "♡" },
];

function FadeCard({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function StepLabel({ n, label, light }: { n: string; label: string; light?: boolean }) {
  return (
    <p
      className={`text-[10px] tracking-[0.22em] uppercase font-medium flex items-center gap-3 mb-4 ${
        light ? "text-white/40" : "text-[var(--foreground-subtle)]"
      }`}
    >
      <span className={light ? "text-white/40" : "text-[var(--foreground-muted)]"}>{n}</span>
      {label}
    </p>
  );
}

export default function FeaturesBento({ outfits }: FeaturesBentoProps) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (outfits.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % outfits.length), 5000);
    return () => clearInterval(t);
  }, [outfits.length]);

  const outfit = outfits[idx] ?? null;
  const items = outfit?.items ?? [];
  const thumbItems = items.slice(0, 4);
  const shopItems = items.slice(0, 4);
  const total = outfit?.totalPriceMin ?? 0;

  return (
    <div className="mt-14 grid grid-cols-12 gap-4 md:gap-5 md:h-[700px] md:items-stretch">

      {/* ── PANEL 1: AI Outfit Preview ── */}
      <FadeCard
        delay={0}
        className="col-span-12 md:col-span-7 bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-7 flex flex-col min-h-[560px] md:min-h-0 overflow-hidden"
      >
        <StepLabel n="01" label="AI Outfit Preview" />

        <h3 className="text-2xl md:text-[28px] font-bold text-[var(--foreground)] leading-tight mb-2">
          See your look<br />come to life.
        </h3>
        <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed max-w-xs mb-6">
          Generate photoreal previews of your selected items on a realistic model.
        </p>

        {/* Content row: item thumbs | outfit image */}
        <div className="flex-1 flex gap-4 min-h-0">

          {/* Left column: item thumbnails — fixed height prevents layout jumps */}
          <div className="flex flex-col gap-2 shrink-0 w-[80px]">
            {Array.from({ length: 4 }, (_, i) => {
              const item = thumbItems[i];
              return (
                <motion.div
                  key={`${idx}-${i}`}
                  className="w-[80px] h-[80px] rounded-2xl bg-[var(--background)] border border-[var(--border)] overflow-hidden shrink-0"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.04, ease: EASE }}
                >
                  {item?.product.imageUrl ? (
                    <Image
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      width={80}
                      height={80}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full bg-[var(--border)]" />
                  )}
                </motion.div>
              );
            })}

            <motion.div
              className="w-[80px] h-[80px] rounded-2xl border border-dashed border-[var(--border-strong)] flex items-center justify-center shrink-0"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="text-[20px] font-light text-[var(--foreground-subtle)] leading-none">+</span>
            </motion.div>
          </div>

          {/* Right: outfit image */}
          <div className="flex-1 rounded-2xl overflow-hidden relative bg-[var(--background)] border border-[var(--border)]">
            <AnimatePresence mode="wait">
              {outfit?.imageUrl ? (
                <motion.div
                  key={idx}
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <Image
                    src={outfit.imageUrl}
                    alt={outfit.name}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 70vw, 38vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </motion.div>
              ) : (
                <div
                  key="empty"
                  className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#e8e3da_0px,#e8e3da_7px,rgba(0,0,0,0.04)_7px,rgba(0,0,0,0.04)_8px)]"
                />
              )}
            </AnimatePresence>

            {/* AI Preview badge */}
            <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-[var(--background)]/90 border border-[var(--border)] text-[9px] font-semibold text-[var(--foreground)] backdrop-blur-sm">
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ✦
              </motion.span>
              {" "}AI Preview
            </span>

            {/* Navigation dots */}
            {outfits.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {outfits.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    className="rounded-full bg-white transition-all"
                    style={{ width: i === idx ? 20 : 6, height: 6, opacity: i === idx ? 1 : 0.4 }}
                  />
                ))}
              </div>
            )}

            {/* Prev / Next arrows */}
            {outfits.length > 1 && (
              <div className="absolute bottom-3 right-3 flex gap-1.5 z-10">
                <button
                  onClick={() => setIdx((i) => (i - 1 + outfits.length) % outfits.length)}
                  className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M6 2L3 5L6 8" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={() => setIdx((i) => (i + 1) % outfits.length)}
                  className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M4 2L7 5L4 8" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Generate Preview button */}
        <Link
          href="/builder"
          className="mt-5 flex items-center justify-center gap-2 bg-[var(--foreground)] text-[var(--background)] rounded-2xl py-3.5 text-[13px] font-bold hover:opacity-90 transition-opacity shrink-0"
        >
          <motion.span
            animate={{ rotate: [0, 20, -20, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            ✦
          </motion.span>
          Generate Preview
        </Link>
      </FadeCard>

      {/* ── Right column ── */}
      <div className="col-span-12 md:col-span-5 flex flex-col gap-5 md:gap-6">

        {/* ── PANEL 2: AI Stylist ── */}
        <FadeCard
          delay={0.07}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-7 flex flex-col flex-[4] min-h-[260px] md:min-h-0"
        >
          <StepLabel n="02" label="AI Stylist" />

          <h3 className="text-xl md:text-2xl font-bold text-[var(--foreground)] leading-tight mb-2">
            Ask for ideas.<br />Get styled instantly.
          </h3>
          <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed mb-5">
            Chat with your AI stylist to get outfit ideas, combinations, and personalized advice.
          </p>

          {/* Input */}
          <div className="relative mb-3">
            <input
              readOnly
              value=""
              placeholder="Ask your AI stylist…"
              className="w-full h-11 rounded-2xl border border-[var(--border)] bg-[var(--background)] pl-4 pr-12 text-[13px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none"
            />
            <Link
              href="/stylist"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--foreground)] flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 10L10 2M10 2H4M10 2V8" stroke="var(--background)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          {/* Chips — nowrap, guaranteed single row */}
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {STYLIST_CHIPS.map((chip) => (
              <Link
                key={chip.label}
                href="/stylist"
                className="inline-flex items-center gap-1 shrink-0 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--background)] text-[11px] whitespace-nowrap text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <span className="text-[9px]">{chip.icon}</span>
                {chip.label}
              </Link>
            ))}
          </div>
        </FadeCard>

        {/* ── PANEL 3: Build & Shop — always-dark bg, no theme inversion ── */}
        <FadeCard
          delay={0.13}
          className="bg-[#111] rounded-3xl p-7 flex flex-col flex-[6] min-h-[320px] md:min-h-0"
        >
          <StepLabel n="03" label="Build & Shop" light />

          <h3 className="text-xl font-bold text-white leading-tight mb-2">
            Everything in one place.<br />
            <span className="font-normal text-white/60">Build, save, and shop your look.</span>
          </h3>

          {/* Items list — stable height via flex-1 container */}
          <div className="flex-1 mt-4 flex flex-col gap-2 min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
              {shopItems.length > 0 ? (
                shopItems.map((item, i) => (
                  <motion.div
                    key={`${idx}-${i}`}
                    className="flex items-center gap-3 bg-white/[0.07] rounded-xl px-3 py-2.5 border border-white/[0.07]"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.28, delay: i * 0.05, ease: EASE }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden shrink-0">
                      {item.product.imageUrl && (
                        <Image
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          width={36}
                          height={36}
                          className="object-cover w-full h-full"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-white truncate leading-snug">
                        {item.product.name}
                      </p>
                      <p className="text-[10px] text-white/45">{item.product.brand}</p>
                    </div>
                    <p className="text-[13px] font-bold text-white shrink-0">
                      ${item.product.priceMin.toLocaleString()}
                    </p>
                  </motion.div>
                ))
              ) : (
                Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="h-[52px] rounded-xl bg-white/[0.06] border border-white/[0.06]" />
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Shop this look button */}
          <Link
            href="/builder"
            className="mt-4 flex items-center justify-between bg-white text-[#111] rounded-2xl px-4 py-3.5 hover:opacity-90 transition-opacity shrink-0"
          >
            <div className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2.5H3.5L5.5 10H11L12.5 5H4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="6" cy="12.5" r="0.8" fill="currentColor" />
                <circle cx="10.5" cy="12.5" r="0.8" fill="currentColor" />
              </svg>
              <span className="text-[13px] font-bold">Shop this look</span>
            </div>
            <div className="flex items-center gap-2">
              {total > 0 && (
                <AnimatePresence mode="wait">
                  <motion.span
                    key={idx}
                    className="text-[12px] font-semibold text-[#111]/50"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.22 }}
                  >
                    from ${total.toLocaleString()}
                  </motion.span>
                </AnimatePresence>
              )}
              <motion.span
                animate={{ x: [0, 3, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.span>
            </div>
          </Link>
        </FadeCard>

      </div>
    </div>
  );
}
