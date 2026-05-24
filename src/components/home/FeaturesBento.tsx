"use client";

import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { useState, useEffect } from "react";
import type { Product, Outfit } from "@/lib/types";

interface FeaturesBentoProps {
  products: Product[];
  outfits: Outfit[];
}

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

const cardV = (delay: number) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.45, delay, ease: EASE },
});

// ── Chat conversations for AI Stylist ─────────────────────────────────────────

const CHAT_CONVOS = [
  [
    { isUser: true,  text: "Something minimal for a gallery opening." },
    { isUser: false, text: "Longline coat + cream trousers. Shoes too?" },
    { isUser: true,  text: "Yes — and a bag." },
    { isUser: false, text: "Square-toe mule + leather tote. ~$620." },
  ],
  [
    { isUser: true,  text: "Smart casual dinner, autumn vibes." },
    { isUser: false, text: "Tailored blazer + dark jeans + white shirt." },
    { isUser: true,  text: "Any shoe options?" },
    { isUser: false, text: "Chelsea boots. Clean and versatile. ~$480." },
  ],
  [
    { isUser: true,  text: "Weekend look — comfy but stylish." },
    { isUser: false, text: "Oversized knit + straight trousers + sneakers." },
    { isUser: true,  text: "Colour palette?" },
    { isUser: false, text: "Cream, camel and white. Effortless. ~$390." },
  ],
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-2.5 bg-[var(--background)] rounded-2xl rounded-tl-sm self-start">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[var(--foreground-muted)] block"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

function AIStylistChatLoop() {
  const [convIdx, setConvIdx] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [typing, setTyping] = useState(false);

  const conv = CHAT_CONVOS[convIdx];

  useEffect(() => {
    if (typing) {
      const isNextUser = conv[visibleCount]?.isUser ?? false;
      const t = setTimeout(() => {
        setVisibleCount((n) => n + 1);
        setTyping(false);
      }, isNextUser ? 350 : 950);
      return () => clearTimeout(t);
    }

    if (visibleCount < conv.length) {
      const prevIsUser = visibleCount > 0 ? conv[visibleCount - 1].isUser : null;
      const delay = visibleCount === 0 ? 1000 : prevIsUser ? 550 : 750;
      const t = setTimeout(() => setTyping(true), delay);
      return () => clearTimeout(t);
    }

    // All shown — pause then next conversation
    const t = setTimeout(() => {
      setVisibleCount(0);
      setTyping(false);
      setConvIdx((i) => (i + 1) % CHAT_CONVOS.length);
    }, 2600);
    return () => clearTimeout(t);
  }, [typing, visibleCount, conv]);

  const messages = conv.slice(0, visibleCount);
  const showTyping = typing && visibleCount < conv.length && !(conv[visibleCount]?.isUser);

  return (
    <div className="flex-1 flex flex-col justify-end gap-2 overflow-hidden">
      <AnimatePresence mode="popLayout">
        {messages.map((msg, i) => (
          <motion.div
            key={`${convIdx}-${i}`}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.25, ease: EASE }}
            className={
              msg.isUser
                ? "self-end bg-[var(--foreground)] text-[var(--background)] px-4 py-2.5 rounded-2xl rounded-tr-sm text-[13px] max-w-[88%] leading-snug"
                : "self-start bg-[var(--background)] px-4 py-2.5 rounded-2xl rounded-tl-sm text-[13px] max-w-[90%] text-[var(--foreground)] leading-snug"
            }
          >
            {msg.text}
          </motion.div>
        ))}

        {showTyping && (
          <motion.div
            key="typing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TypingDots />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="h-10 border border-[var(--border)] rounded-full px-4 flex items-center justify-between mt-2 shrink-0">
        <span className="text-[12px] text-[var(--foreground-subtle)]">Message AI Stylist…</span>
        <span className="text-[11px] text-[var(--foreground-subtle)]">⏎</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FeaturesBento({ products, outfits }: FeaturesBentoProps) {
  const [outfitIdx, setOutfitIdx] = useState(0);
  const [catalogPage, setCatalogPage] = useState(0);

  // Cycle outfits in Preview + Shop the Look
  useEffect(() => {
    if (outfits.length < 2) return;
    const t = setInterval(() => setOutfitIdx((i) => (i + 1) % outfits.length), 5000);
    return () => clearInterval(t);
  }, [outfits.length]);

  // Cycle product catalog pages
  useEffect(() => {
    if (products.length <= 6) return;
    const pages = Math.ceil(products.length / 6);
    const t = setInterval(() => setCatalogPage((p) => (p + 1) % pages), 3500);
    return () => clearInterval(t);
  }, [products.length]);

  const currentOutfit = outfits[outfitIdx] ?? null;
  const outfitProds = currentOutfit?.items.map((it) => it.product) ?? [];
  // Fill preview grid to 6, using fallback products for empty slots
  const previewGrid = Array.from({ length: 6 }, (_, i) => outfitProds[i] ?? products[i] ?? null);

  const catalogProds = products.slice(catalogPage * 6, catalogPage * 6 + 6);

  // Builder: use a different outfit to vary from preview
  const builderOutfit = outfits[1] ?? outfits[0] ?? null;
  const builderItems = builderOutfit?.items.slice(0, 3) ?? [];
  const builderFallback = products.slice(3, 6);

  // Shop: real products from current outfit
  const shopItems = currentOutfit?.items.slice(0, 3) ?? [];
  const shopProds = shopItems.length > 0
    ? shopItems.map((it) => it.product)
    : products.slice(0, 3);
  const shopTotal = currentOutfit?.totalPriceMin
    ?? shopProds.reduce((s, p) => s + (p?.priceMin ?? 0), 0);

  return (
    <div className="mt-14 grid grid-cols-12 gap-4 md:gap-5">

      {/* ── 1. AI Outfit Preview (dark, col-span-8) ── */}
      <motion.div
        className="col-span-12 md:col-span-8 bg-[var(--foreground)] rounded-3xl p-8 flex flex-col min-h-[440px] overflow-hidden transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        {...cardV(0)}
      >
        {/* Header */}
        <div className="mb-5">
          <p className="text-[10px] tracking-[0.22em] uppercase font-semibold text-white/40 mb-3">
            Signature feature
          </p>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl md:text-[30px] font-bold text-white leading-tight mb-2">
                AI Outfit Preview
              </h3>
              <p className="text-sm text-white/55 max-w-sm leading-relaxed">
                Generate realistic visuals of how your selected items look together — before you spend a cent.
              </p>
            </div>
            {/* Cycling outfit name */}
            <AnimatePresence mode="wait">
              <motion.span
                key={outfitIdx}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.28 }}
                className="hidden md:block shrink-0 mt-1 px-3 py-1.5 rounded-full border border-white/15 text-[10px] text-white/45 font-medium"
              >
                {currentOutfit?.name ?? "–"}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Content row */}
        <div className="flex-1 flex items-center gap-5">
          {/* Left panel — real outfit products */}
          <div className="flex-1 bg-white/[0.06] rounded-2xl p-4 border border-white/[0.08] self-stretch flex flex-col">
            <p className="text-[9px] tracking-[0.15em] uppercase text-white/35 mb-3 shrink-0">
              Selected items
            </p>
            <div className="flex-1 grid grid-cols-3 gap-2 content-start">
              <AnimatePresence mode="wait">
                {previewGrid.map((prod, i) => (
                  <motion.div
                    key={`${outfitIdx}-${i}`}
                    className="aspect-square rounded-lg bg-white/[0.07] overflow-hidden"
                    initial={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.3, delay: i * 0.03, ease: EASE }}
                  >
                    {prod?.imageUrl ? (
                      <Image
                        src={prod.imageUrl}
                        alt={prod.name ?? ""}
                        width={60}
                        height={60}
                        className="object-cover w-full h-full opacity-80"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/10" />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Animated arrow */}
          <motion.div
            className="flex flex-col items-center gap-1.5 shrink-0"
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M9 4L13 8L9 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[8px] text-white/25 uppercase tracking-widest">AI</p>
          </motion.div>

          {/* Right panel — cycling outfit image */}
          <div className="flex-1 rounded-2xl overflow-hidden relative self-stretch bg-[var(--surface)]">
            <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-[var(--background)] border border-[var(--border)] text-[9px] font-semibold text-[var(--foreground)]">
              <span className="animate-pulse">✦</span> AI Preview
            </span>
            <AnimatePresence mode="wait">
              {currentOutfit?.imageUrl ? (
                <motion.div
                  key={outfitIdx}
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <Image
                    src={currentOutfit.imageUrl}
                    alt={currentOutfit.name ?? ""}
                    fill
                    className="object-cover"
                    sizes="20vw"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
                    <p className="text-white text-[11px] font-semibold truncate">{currentOutfit.name}</p>
                  </div>
                </motion.div>
              ) : (
                <div key="empty" className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#D4CEC2_0px,#D4CEC2_7px,rgba(10,10,10,0.06)_7px,rgba(10,10,10,0.06)_8px)]" />
              )}
            </AnimatePresence>
            {/* Progress dots */}
            {outfits.length > 1 && (
              <div className="absolute bottom-3 right-3 flex gap-1 z-10">
                {outfits.map((_, i) => (
                  <motion.div
                    key={i}
                    className="rounded-full bg-white"
                    animate={{ width: i === outfitIdx ? 12 : 6, opacity: i === outfitIdx ? 1 : 0.3 }}
                    style={{ height: 6 }}
                    transition={{ duration: 0.3 }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── 2. AI Stylist (light, animated chat) ── */}
      <motion.div
        className="col-span-12 md:col-span-4 bg-[var(--surface)] rounded-3xl p-7 flex flex-col min-h-[440px] border border-[var(--border)] overflow-hidden cursor-pointer"
        {...cardV(0.07)}
        whileHover={{ scale: 1.012 }}
        transition={{ duration: 0.22, ease: EASE }}
      >
        <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--foreground-subtle)] mb-3">
          Chat-powered
        </p>
        <h3 className="text-xl font-bold text-[var(--foreground)] mb-1">AI Stylist</h3>
        <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed mb-5">
          Ask for outfit ideas, combinations and styling advice.
        </p>
        <AIStylistChatLoop />
      </motion.div>

      {/* ── 3. Outfit Builder — item list ── */}
      <motion.div
        className="col-span-12 md:col-span-4 bg-[var(--surface)] rounded-3xl p-7 flex flex-col border border-[var(--border)] min-h-[340px] overflow-hidden cursor-pointer"
        {...cardV(0.13)}
        whileHover={{ scale: 1.012 }}
        transition={{ duration: 0.22, ease: EASE }}
      >
        <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--foreground-subtle)] mb-3">
          Manual control
        </p>
        <h3 className="text-xl font-bold text-[var(--foreground)] mb-1">Outfit Builder</h3>
        <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed">
          Create complete looks using real items from real brands.
        </p>

        <div className="flex-1 mt-5 flex flex-col gap-2">
          {(builderItems.length > 0 ? builderItems.map((it) => it.product) : builderFallback).map(
            (prod, i) =>
              prod && (
                <motion.div
                  key={prod.id ?? i}
                  className="flex items-center gap-3 bg-[var(--background)] rounded-xl px-3 py-2.5 border border-[var(--border)]"
                  initial={{ opacity: 0, x: -14 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.35, delay: 0.08 + i * 0.1, ease: EASE }}
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--surface)] overflow-hidden shrink-0 border border-[var(--border)]">
                    {prod.imageUrl && (
                      <Image
                        src={prod.imageUrl}
                        alt={prod.name}
                        width={40}
                        height={40}
                        className="object-cover w-full h-full"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wide mb-0.5">
                      {prod.category}
                    </p>
                    <p className="text-[12px] font-medium text-[var(--foreground)] truncate">{prod.name}</p>
                  </div>
                  <p className="text-[12px] font-semibold text-[var(--foreground)] shrink-0">
                    ${prod.priceMin.toLocaleString()}
                  </p>
                </motion.div>
              )
          )}

          {/* Add item pulse */}
          <motion.div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--border-strong)] text-[var(--foreground-subtle)]"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: 0.45 }}
          >
            <motion.div
              className="w-5 h-5 rounded-full border border-dashed border-[var(--foreground-subtle)] flex items-center justify-center shrink-0"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="text-[10px] font-bold leading-none">+</span>
            </motion.div>
            <span className="text-[12px]">Add another item…</span>
          </motion.div>
        </div>
      </motion.div>

      {/* ── 4. Product Catalog — cycling grid ── */}
      <motion.div
        className="col-span-12 md:col-span-4 bg-[var(--surface)] rounded-3xl p-7 flex flex-col border border-[var(--border)] min-h-[340px] overflow-hidden cursor-pointer"
        {...cardV(0.18)}
        whileHover={{ scale: 1.012 }}
        transition={{ duration: 0.22, ease: EASE }}
      >
        <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--foreground-subtle)] mb-3">
          Multi-brand
        </p>
        <h3 className="text-xl font-bold text-[var(--foreground)] mb-1">Product Catalog</h3>
        <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed">
          Explore items from hundreds of brands and online stores.
        </p>

        <div className="flex-1 mt-5 bg-[var(--background)] rounded-2xl p-3 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={catalogPage}
              className="grid grid-cols-3 gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              {Array.from({ length: 6 }, (_, i) => catalogProds[i] ?? null).map((prod, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="aspect-square rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                    {prod?.imageUrl && (
                      <Image
                        src={prod.imageUrl}
                        alt={prod.name ?? ""}
                        width={60}
                        height={60}
                        className="object-cover w-full h-full"
                      />
                    )}
                  </div>
                  {prod?.brand && (
                    <p className="text-[9px] text-[var(--foreground-subtle)] truncate px-0.5 leading-none">
                      {prod.brand}
                    </p>
                  )}
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── 5. Shop the Look (dark) — with thumbnails ── */}
      <motion.div
        className="col-span-12 md:col-span-4 bg-[var(--foreground)] rounded-3xl p-7 flex flex-col min-h-[340px] overflow-hidden transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        {...cardV(0.24)}
      >
        <p className="text-[10px] tracking-[0.22em] uppercase font-semibold text-white/40 mb-3">
          One-click shopping
        </p>
        <h3 className="text-xl font-bold text-white mb-1">Shop the Look</h3>
        <p className="text-[13px] text-white/55 leading-relaxed">
          Open every product link in one clean flow.
        </p>

        <div className="flex-1 mt-5 flex flex-col justify-end gap-2">
          <AnimatePresence mode="wait">
            {shopProds.map((prod, i) =>
              prod ? (
                <motion.div
                  key={`${outfitIdx}-${i}`}
                  className="flex items-center gap-3 bg-white/[0.07] rounded-xl px-3 py-2.5 border border-white/[0.07]"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.3, delay: i * 0.06, ease: EASE }}
                >
                  <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden shrink-0">
                    {prod.imageUrl && (
                      <Image
                        src={prod.imageUrl}
                        alt={prod.name}
                        width={36}
                        height={36}
                        className="object-cover w-full h-full"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-white truncate">{prod.name}</p>
                    <p className="text-[10px] text-white/40">{prod.brand}</p>
                  </div>
                  <p className="text-[13px] font-bold text-white shrink-0">${prod.priceMin.toLocaleString()}</p>
                </motion.div>
              ) : null
            )}
          </AnimatePresence>

          {/* Total */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.05] rounded-xl border border-white/[0.06]">
            <div>
              <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">Total from</p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={outfitIdx}
                  className="text-[15px] font-bold text-white"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                >
                  ${shopTotal.toLocaleString()}
                </motion.p>
              </AnimatePresence>
            </div>
            <div className="flex gap-1">
              {outfits.length > 1 && outfits.map((_, i) => (
                <motion.div
                  key={i}
                  className="rounded-full bg-white"
                  animate={{ width: i === outfitIdx ? 12 : 6, opacity: i === outfitIdx ? 0.8 : 0.2 }}
                  style={{ height: 6 }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
          </div>

          {/* Open all button */}
          <motion.div
            className="bg-white text-[var(--foreground)] rounded-xl px-4 py-3 flex justify-between items-center"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.18 }}
          >
            <span className="text-[13px] font-bold">Open all products</span>
            <motion.span animate={{ x: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.span>
          </motion.div>
        </div>
      </motion.div>

    </div>
  );
}
