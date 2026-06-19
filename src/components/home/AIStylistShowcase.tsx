"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import type { Product } from "@/lib/types";
import type { StylistChatLook } from "@/lib/data/db";
import { useStylist } from "@/lib/context/stylist-context";

interface AIStylistShowcaseProps {
  chatLooks: StylistChatLook[];
  featuredProduct: Product | null;
  /** Lower-cased brand/store name → logo URL. */
  retailerLogos?: Record<string, string>;
}

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

function money(value: number, currency = "USD") {
  const symbol = currency === "USD" || !currency ? "$" : `${currency} `;
  return `${symbol}${Math.round(value).toLocaleString()}`;
}

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
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// ── Left intro: headline + feature tiles ─────────────────────────────────────

const FEATURES = [
  {
    title: "Smart chat",
    sub: "Ask anything",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v7A1.5 1.5 0 0 1 15.5 14H8l-3.5 3v-3H4.5A1.5 1.5 0 0 1 3 12.5v-7Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "AI picks",
    sub: "Personalized looks",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2.5l1.6 4.3 4.6.2-3.6 2.9 1.2 4.4L10 11.9l-3.8 2.4 1.2-4.4-3.6-2.9 4.6-.2L10 2.5Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Top stores",
    sub: "Find and buy",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M4 7h12l-.8 8.2a1 1 0 0 1-1 .8H5.8a1 1 0 0 1-1-.9L4 7Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path d="M7 7V5.5a3 3 0 0 1 6 0V7" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
];

function Intro() {
  return (
    <div className="flex flex-col justify-center p-8 md:p-10 lg:p-12">
      <p className="flex items-center gap-2 text-[11px] tracking-[0.22em] uppercase font-medium text-white/40 mb-6">
        <span className="text-white/70">✦</span> AI Stylist
      </p>
      <h2 className="text-4xl md:text-5xl lg:text-[56px] font-bold tracking-[-0.04em] leading-[1.02] text-white">
        Your style.
        <br />
        Found by AI.
      </h2>
      <p className="text-[15px] text-white/55 leading-relaxed mt-5 max-w-sm">
        AI looks at what&apos;s trending and creates outfit ideas just for you.
      </p>

      <div className="grid grid-cols-3 gap-3 mt-9 max-w-md">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3"
          >
            <span className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white">
              {f.icon}
            </span>
            <div>
              <p className="text-[13px] font-semibold text-white leading-tight">{f.title}</p>
              <p className="text-[11px] text-white/45 mt-0.5">{f.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Chat preview ─────────────────────────────────────────────────────────────

function LookCard({ look, onOpen }: { look: StylistChatLook; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left hover:bg-white/[0.07] transition-colors"
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/[0.06] shrink-0">
        {look.imageUrl && (
          <Image
            src={look.imageUrl}
            alt={look.name}
            width={56}
            height={56}
            className="object-cover w-full h-full"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-white truncate leading-snug">{look.name}</p>
        {look.price > 0 && (
          <p className="text-[13px] text-white/50 mt-0.5">{money(look.price, look.currency)}</p>
        )}
      </div>
      <span className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/70 group-hover:bg-white/10 transition-colors shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

function ChatPreview({ looks }: { looks: StylistChatLook[] }) {
  const { open } = useStylist();
  return (
    <div className="flex flex-col rounded-3xl border border-white/10 bg-[#0F0F0F] overflow-hidden m-3 md:m-4 min-h-[420px]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="text-white/80">✦</span>
          <span className="text-[14px] font-semibold text-white">AI Stylist</span>
          <span className="flex items-center gap-1.5 ml-1 text-[11px] text-white/45">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Online
          </span>
        </div>
        <button
          type="button"
          onClick={open}
          aria-label="Open the AI Stylist"
          className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3H3.5A1.5 1.5 0 0 0 2 4.5v6A1.5 1.5 0 0 0 3.5 12h6A1.5 1.5 0 0 0 11 10.5V9M8 2h4m0 0v4m0-4L6 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 flex flex-col gap-4 px-5 py-5">
        {/* User bubble */}
        <div className="flex justify-end items-end gap-2">
          <div className="max-w-[78%] rounded-2xl rounded-br-md bg-white/[0.09] px-4 py-2.5">
            <p className="text-[13px] text-white leading-snug">
              What&apos;s trending right now? I need something for a summer evening.
            </p>
          </div>
        </div>
        <p className="text-[10px] text-white/30 text-right -mt-2">Just now</p>

        {/* Bot bubble */}
        <div className="flex">
          <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-white/[0.05] border border-white/10 px-4 py-2.5">
            <p className="text-[13px] text-white/85 leading-snug">
              Here are a couple of looks that are trending right now.
            </p>
          </div>
        </div>

        {/* Look cards */}
        {looks.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-3">
            {looks.map((look) => (
              <LookCard key={look.id} look={look} onOpen={open} />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={open}
          aria-label="Ask your stylist"
          className="group w-full h-12 rounded-2xl border border-white/10 bg-white/[0.04] pl-4 pr-1.5 flex items-center text-left hover:border-white/20 transition-colors"
        >
          <span className="flex-1 text-[13px] text-white/40">Ask your stylist…</span>
          <span className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center group-hover:opacity-90 transition-opacity">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}

// ── Featured product + where to buy ──────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1 text-white/70">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-amber-300">
        <path d="M6 1l1.5 3.2 3.5.3-2.7 2.3.9 3.4L6 8.7 2.8 10.2l.9-3.4L1 4.5l3.5-.3L6 1Z" />
      </svg>
      <span className="text-[12px] tabular-nums">{rating.toFixed(1)}</span>
    </span>
  );
}

function FeaturedProduct({
  product,
  retailerLogos = {},
}: {
  product: Product;
  retailerLogos?: Record<string, string>;
}) {
  const { open } = useStylist();
  const [liked, setLiked] = useState(false);
  const retailers = (product.retailers ?? []).slice(0, 5);

  return (
    <div className="grid lg:grid-cols-[0.82fr_1.18fr] gap-3 md:gap-4 p-3 md:p-4 items-stretch">
      {/* Image — frame hugs the product so it doesn't float in empty space */}
      <div className="relative rounded-3xl overflow-hidden bg-[#0F0F0F] border border-white/10 aspect-[4/5] lg:aspect-auto lg:min-h-[340px]">
        {product.imageUrl && (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-contain p-3 md:p-4"
            sizes="(max-width: 1024px) 100vw, 34vw"
          />
        )}
        <button
          type="button"
          onClick={() => setLiked((v) => !v)}
          aria-label={liked ? "Remove from favorites" : "Add to favorites"}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill={liked ? "currentColor" : "none"}>
            <path
              d="M9 15.5S2.5 11.4 2.5 6.9A3.4 3.4 0 0 1 9 5.3a3.4 3.4 0 0 1 6.5 1.6c0 4.5-6.5 8.6-6.5 8.6Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Where to buy */}
      <div className="flex flex-col p-5 md:p-7">
        <p className="text-[11px] tracking-[0.18em] uppercase text-white/40">{product.brand}</p>
        <h3 className="text-2xl md:text-3xl font-bold text-white tracking-[-0.02em] mt-1.5">
          {product.name}
        </h3>
        <p className="text-xl text-white mt-2">{money(product.priceMin, product.currency)}</p>

        <div className="flex items-baseline justify-between mt-7 mb-3">
          <p className="text-[13px] font-semibold text-white">Where to buy</p>
          <p className="text-[11px] text-white/35">Prices may vary by retailer.</p>
        </div>

        {retailers.length > 0 ? (
          <div className="flex flex-col">
            {retailers.map((r, i) => (
              <a
                key={`${r.name}-${i}`}
                href={r.url || undefined}
                target={r.url ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!r.url) {
                    e.preventDefault();
                    open();
                  }
                }}
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3 border-t border-white/[0.07] first:border-t-0 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {(() => {
                    const logo = retailerLogos[r.name.trim().toLowerCase()];
                    return logo ? (
                      <span className="w-9 h-9 rounded-full bg-white border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                        <Image
                          src={logo}
                          alt={r.name}
                          width={36}
                          height={36}
                          className="object-contain w-full h-full p-1"
                        />
                      </span>
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-[12px] font-semibold text-white shrink-0">
                        {r.name.slice(0, 2).toUpperCase()}
                      </span>
                    );
                  })()}
                  <div className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-white truncate">{r.name}</span>
                      {r.isOfficial && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/70 shrink-0">
                          Official Store
                        </span>
                      )}
                    </span>
                    {r.rating ? (
                      <span className="mt-0.5 flex items-center gap-2">
                        <StarRating rating={r.rating} />
                        {r.reviewCount ? (
                          <span className="text-[11px] text-white/35">
                            {r.reviewCount.toLocaleString()} reviews
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </div>

                <span className="hidden sm:block text-[12px] text-white/40 justify-self-start">
                  {r.isOfficial ? "Fast delivery" : "Worldwide shipping"}
                </span>

                <div className="flex items-center gap-3 justify-self-end">
                  <div className="text-right">
                    <p className="text-[14px] font-semibold text-white">
                      {money(r.price, r.currency)}
                    </p>
                    <p
                      className={`text-[11px] ${
                        r.availability === "sold out" ? "text-white/30" : "text-emerald-400"
                      }`}
                    >
                      {r.availability === "sold out"
                        ? "Sold out"
                        : r.availability === "low stock"
                          ? "Low stock"
                          : "In stock"}
                    </p>
                  </div>
                  <span className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/60 group-hover:bg-white/10 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-white/40 py-6">
            No retailers listed yet for this item.
          </p>
        )}

        <p className="text-[11px] text-white/30 mt-5">
          Prices updated regularly. Additional fees may apply.
        </p>
      </div>
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

export default function AIStylistShowcase({
  chatLooks,
  featuredProduct,
  retailerLogos = {},
}: AIStylistShowcaseProps) {
  return (
    <section className="bg-[var(--background)] py-20 md:py-28">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 flex flex-col gap-5 md:gap-6">
        {/* Top: intro + chat */}
        <FadeCard className="rounded-[28px] bg-[#0A0A0A] border border-white/10 overflow-hidden shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
          <div className="grid lg:grid-cols-2">
            <Intro />
            <ChatPreview looks={chatLooks} />
          </div>
        </FadeCard>

        {/* Bottom: featured product + where to buy */}
        {featuredProduct && (
          <FadeCard
            delay={0.08}
            className="rounded-[28px] bg-[#0A0A0A] border border-white/10 overflow-hidden shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]"
          >
            <FeaturedProduct product={featuredProduct} retailerLogos={retailerLogos} />
          </FadeCard>
        )}
      </div>
    </section>
  );
}
