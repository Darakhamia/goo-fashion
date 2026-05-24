"use client";

import { motion } from "motion/react";
import Image from "next/image";
import type { Product, Outfit } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeaturesBentoProps {
  products: Product[];
  outfit: Outfit | null;
}

// ── Shared animation config ───────────────────────────────────────────────────

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

const cardVariants = (delay: number) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.45, delay, ease: EASE },
});

const lightHover = {
  whileHover: { scale: 1.012 },
  transition: { duration: 0.22, ease: EASE },
};

// ── Arrow right SVG ───────────────────────────────────────────────────────────

function ArrowRightSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 7H12M8 3L12 7L8 11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FeaturesBento({ products, outfit }: FeaturesBentoProps) {
  const p = (i: number): Product | null => products[i] ?? null;

  // Chat messages for AI Stylist card
  const chatMessages = [
    { text: "Something minimal for a gallery opening — black & cream.", isUser: true },
    { text: "Longline wool coat + cream wide-leg trousers. Want shoes too?", isUser: false },
    { text: "Yes — and a bag.", isUser: true },
    { text: "Square-toe mule + mini structured leather bag. Total: ~$580.", isUser: false },
  ];

  return (
    <div className="mt-14 grid grid-cols-12 gap-4 md:gap-5">

      {/* ── 1. AI Outfit Preview (dark, col-span-8) ── */}
      <motion.div
        className="col-span-12 md:col-span-8 bg-[var(--foreground)] rounded-3xl p-8 flex flex-col min-h-[440px] overflow-hidden transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        {...cardVariants(0)}
      >
        {/* Header */}
        <div className="mb-5">
          <p className="text-[10px] tracking-[0.22em] uppercase font-semibold text-white/40 mb-3">
            Signature feature
          </p>
          <h3 className="text-2xl md:text-[30px] font-bold text-white leading-tight mb-2">
            AI Outfit Preview
          </h3>
          <p className="text-sm text-white/55 max-w-sm leading-relaxed">
            Generate realistic visuals of how your selected items look together — before you spend a cent.
          </p>
        </div>

        {/* Content row */}
        <div className="flex-1 flex items-center gap-5">

          {/* Left panel — Selected Items */}
          <div className="flex-1 bg-white/[0.06] rounded-2xl p-4 border border-white/[0.08] self-stretch flex flex-col">
            <p className="text-[9px] tracking-[0.15em] uppercase text-white/35 mb-3 shrink-0">
              Selected items
            </p>
            <div className="flex-1 grid grid-cols-3 gap-2 content-start">
              {[p(0), p(1), p(2), p(3), p(4), p(5)].map((prod, i) => (
                <motion.div
                  key={i}
                  className="aspect-square rounded-lg bg-white/[0.07] overflow-hidden"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.35, delay: i * 0.04, ease: EASE }}
                >
                  {prod?.imageUrl ? (
                    <Image
                      src={prod.imageUrl}
                      alt={prod.name ?? ""}
                      width={60}
                      height={60}
                      className="object-cover w-full h-full opacity-75"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/10" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <motion.div
            className="flex flex-col items-center gap-1.5 shrink-0"
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8H13M9 4L13 8L9 12"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-[8px] text-white/25 uppercase tracking-widest">AI</p>
          </motion.div>

          {/* Right panel — Outfit image */}
          <div className="flex-1 bg-[var(--surface)] rounded-2xl overflow-hidden relative self-stretch">
            <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-[var(--background)] border border-[var(--border)] text-[9px] font-semibold text-[var(--foreground)]">
              <span className="animate-pulse">✦</span> AI Preview
            </span>
            {outfit?.imageUrl ? (
              <Image
                src={outfit.imageUrl}
                alt={outfit.name ?? ""}
                fill
                className="object-cover"
                sizes="20vw"
              />
            ) : p(0)?.imageUrl ? (
              <Image
                src={p(0)!.imageUrl}
                alt={p(0)!.name ?? ""}
                fill
                className="object-cover opacity-70"
                sizes="20vw"
              />
            ) : (
              <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#D4CEC2_0px,#D4CEC2_7px,rgba(10,10,10,0.06)_7px,rgba(10,10,10,0.06)_8px)]" />
            )}
            {outfit && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
                <p className="text-white text-[11px] font-semibold truncate">{outfit.name}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── 2. AI Stylist (light, col-span-4) ── */}
      <motion.div
        className="col-span-12 md:col-span-4 bg-[var(--surface)] rounded-3xl p-7 flex flex-col min-h-[440px] border border-[var(--border)] overflow-hidden cursor-pointer"
        {...cardVariants(0.07)}
        {...lightHover}
      >
        <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--foreground-subtle)] mb-3">
          Chat-powered
        </p>
        <h3 className="text-xl font-bold text-[var(--foreground)] mb-1">AI Stylist</h3>
        <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed mb-5">
          Ask for outfit ideas, combinations and styling advice.
        </p>

        {/* Chat messages */}
        <div className="flex-1 flex flex-col justify-end gap-2.5">
          {chatMessages.map((msg, i) => (
            <motion.div
              key={i}
              className={
                msg.isUser
                  ? "self-end bg-[var(--foreground)] text-[var(--background)] px-4 py-2.5 rounded-2xl rounded-tr-sm text-[13px] max-w-[88%] leading-snug"
                  : "self-start bg-[var(--background)] px-4 py-2.5 rounded-2xl rounded-tl-sm text-[13px] max-w-[90%] text-[var(--foreground)] leading-snug"
              }
              initial={{ opacity: 0, x: msg.isUser ? 10 : -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.07, ease: EASE }}
            >
              {msg.text}
            </motion.div>
          ))}

          {/* Tags */}
          <div className="flex gap-2 mt-1 flex-wrap">
            {["Warmer", "Sharper", "Try a heel"].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 rounded-full bg-[var(--background)] border border-[var(--border)] text-[11px] text-[var(--foreground-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Input bar */}
          <div className="h-10 border border-[var(--border)] rounded-full px-4 flex items-center justify-between mt-1">
            <span className="text-[12px] text-[var(--foreground-subtle)]">Message AI Stylist…</span>
            <span className="text-[11px] text-[var(--foreground-subtle)]">⏎</span>
          </div>
        </div>
      </motion.div>

      {/* ── 3. Outfit Builder (light, col-span-4) ── */}
      <motion.div
        className="col-span-12 md:col-span-4 bg-[var(--surface)] rounded-3xl p-7 flex flex-col border border-[var(--border)] min-h-[340px] overflow-hidden cursor-pointer"
        {...cardVariants(0.13)}
        {...lightHover}
      >
        <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--foreground-subtle)] mb-3">
          Manual control
        </p>
        <h3 className="text-xl font-bold text-[var(--foreground)] mb-1">Outfit Builder</h3>
        <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed">
          Create complete looks using real items from real brands.
        </p>

        {/* Image area */}
        <div className="flex-1 mt-5 bg-[var(--background)] rounded-2xl relative overflow-hidden min-h-[140px]">
          {p(1)?.imageUrl ? (
            <Image
              src={p(1)!.imageUrl}
              alt={p(1)!.name ?? ""}
              fill
              className="object-cover opacity-65"
              sizes="33vw"
            />
          ) : (
            <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#D4CEC2_0px,#D4CEC2_7px,rgba(10,10,10,0.06)_7px,rgba(10,10,10,0.06)_8px)] opacity-50" />
          )}
          <div className="absolute bottom-3 left-3 right-3 bg-[var(--bg-overlay-90)] backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-[var(--foreground)] flex items-center justify-center shrink-0">
              <span className="text-[var(--background)] text-[11px] font-bold leading-none">+</span>
            </div>
            <span className="text-[12px] text-[var(--foreground)]">Add to outfit</span>
          </div>
        </div>
      </motion.div>

      {/* ── 4. Product Catalog (light, col-span-4) ── */}
      <motion.div
        className="col-span-12 md:col-span-4 bg-[var(--surface)] rounded-3xl p-7 flex flex-col border border-[var(--border)] min-h-[340px] overflow-hidden cursor-pointer"
        {...cardVariants(0.18)}
        {...lightHover}
      >
        <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--foreground-subtle)] mb-3">
          Multi-brand
        </p>
        <h3 className="text-xl font-bold text-[var(--foreground)] mb-1">Product Catalog</h3>
        <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed">
          Explore items from hundreds of brands and online stores.
        </p>

        {/* 3×2 product grid */}
        <div className="flex-1 mt-5 bg-[var(--background)] rounded-2xl p-3">
          <div className="grid grid-cols-3 gap-2">
            {[p(0), p(1), p(2), p(3), p(4), p(5)].map((prod, i) => (
              <motion.div
                key={i}
                className="aspect-square rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: i * 0.04, ease: EASE }}
              >
                {prod?.imageUrl && (
                  <Image
                    src={prod.imageUrl}
                    alt={prod.name ?? ""}
                    width={60}
                    height={60}
                    className="object-cover w-full h-full"
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── 5. Shop the Look (dark, col-span-4) ── */}
      <motion.div
        className="col-span-12 md:col-span-4 bg-[var(--foreground)] rounded-3xl p-7 flex flex-col min-h-[340px] overflow-hidden transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        {...cardVariants(0.24)}
      >
        <p className="text-[10px] tracking-[0.22em] uppercase font-semibold text-white/40 mb-3">
          One-click shopping
        </p>
        <h3 className="text-xl font-bold text-white mb-1">Shop the Look</h3>
        <p className="text-[13px] text-white/55 leading-relaxed">
          Save outfits or open every product link in one clean flow.
        </p>

        {/* Product rows */}
        <div className="flex-1 mt-5 flex flex-col justify-end gap-2">
          {[p(0), p(1), p(2)].map(
            (prod, i) =>
              prod && (
                <motion.div
                  key={i}
                  className="bg-white/[0.08] rounded-xl px-4 py-3 flex justify-between items-center border border-white/[0.08]"
                  initial={{ opacity: 0, x: 8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.35, delay: 0.1 + i * 0.07, ease: EASE }}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-white truncate max-w-[130px]">
                      {prod.name}
                    </p>
                    <p className="text-[11px] text-white/45">{prod.brand}</p>
                  </div>
                  <p className="text-[13px] font-bold text-white shrink-0 ml-2">
                    ${prod.priceMin.toLocaleString()}
                  </p>
                </motion.div>
              )
          )}

          {/* Open all button */}
          <div className="bg-white text-[var(--foreground)] rounded-xl px-4 py-3 flex justify-between items-center mt-1">
            <span className="text-[13px] font-bold">Open all products →</span>
            <ArrowRightSvg />
          </div>
        </div>
      </motion.div>

    </div>
  );
}
