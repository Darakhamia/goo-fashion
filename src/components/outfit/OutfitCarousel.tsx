"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Outfit } from "@/lib/types";
import OutfitCollage from "./OutfitCollage";
import Price from "@/components/ui/Price";

interface Props {
  outfits: Outfit[];
}


function getTags(outfit: Outfit): string {
  return [
    ...outfit.styleKeywords.slice(0, 3).map((k) => k.toUpperCase()),
    `${outfit.items.length} ITEMS`,
  ].join(" · ");
}

/** Fades + slides up on mount; remount via `key` to replay */
function AnimatedCard({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className="transition-all duration-300 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      {children}
    </div>
  );
}

interface CardProps {
  outfit: Outfit;
  variant: "center" | "peek";
}

function CarouselCard({ outfit, variant }: CardProps) {
  const isPeek = variant === "peek";

  return (
    <div className="flex flex-col">
      {/* Image */}
      <Link
        href={`/outfit/${outfit.id}`}
        tabIndex={isPeek ? -1 : 0}
        className={`block relative overflow-hidden aspect-[3/4] bg-[var(--surface)] ${
          !isPeek ? "ring-1 ring-[var(--border-strong)]" : ""
        }`}
      >
        {outfit.imageUrl ? (
          <>
            {outfit.isAIGenerated && (
              <div className="absolute top-3 left-3 z-10">
                <span className="font-mono text-[8px] tracking-[0.14em] uppercase font-medium bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)] px-2 py-1 block">
                  AI · FLAT LAY
                </span>
              </div>
            )}
            <Image
              src={outfit.imageUrl}
              alt={outfit.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 45vw, 35vw"
            />
          </>
        ) : (
          <OutfitCollage
            outfit={outfit}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 45vw, 35vw"
          />
        )}
      </Link>

      {/* Info */}
      <div className="mt-4 space-y-1.5">
        <p className={`font-light text-[var(--foreground)] tracking-tight ${isPeek ? "text-xl" : "text-2xl"}`}>
          <Price amount={outfit.totalPriceMin} />
        </p>
        <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] leading-relaxed truncate">
          {getTags(outfit)}
        </p>
        <div className="pt-1">
          <Link
            href={`/outfit/${outfit.id}`}
            tabIndex={isPeek ? -1 : 0}
            className="block w-full text-center text-[10px] tracking-[0.14em] uppercase font-medium py-2.5 border border-white/30 text-white/60 bg-black/60 hover:border-white/60 hover:text-white/90 transition-all duration-200"
          >
            VIEW OUTFIT
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OutfitCarousel({ outfits }: Props) {
  const [index, setIndex] = useState(0);

  if (!outfits.length) return null;

  const n = outfits.length;
  const prevIndex = (index - 1 + n) % n;
  const nextIndex = (index + 1) % n;

  const current = outfits[index];
  const prevOutfit = outfits[prevIndex];
  const nextOutfit = outfits[nextIndex];

  const prev = () => setIndex(prevIndex);
  const next = () => setIndex(nextIndex);

  return (
    <section className="py-24 md:py-32">
      {/* Title */}
      <div className="text-center px-6 mb-10">
        <h2 className="font-mono text-4xl md:text-5xl lg:text-[3.75rem] font-bold tracking-[0.08em] uppercase text-[var(--foreground)]">
          OUTFITS
        </h2>
      </div>

      {/*
        Carousel track — arrows are absolutely positioned on the outer relative
        wrapper so they are never clipped by overflow:hidden on the inner track.
        The inner track uses px-24 xl:px-32 to leave room for the arrows.
      */}
      <div className="relative">
        {/* Left arrow — outside overflow, always visible */}
        <button
          onClick={prev}
          aria-label="Previous outfit"
          className="hidden md:flex absolute left-4 xl:left-8 z-20 w-11 h-11 items-center justify-center border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] transition-all duration-200"
          style={{ top: "37%" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Right arrow — outside overflow, always visible */}
        <button
          onClick={next}
          aria-label="Next outfit"
          className="hidden md:flex absolute right-4 xl:right-8 z-20 w-11 h-11 items-center justify-center border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] transition-all duration-200"
          style={{ top: "37%" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Card track — overflow:hidden to clip peek cards at edges */}
        <div className="overflow-hidden px-6 md:px-24 xl:px-32">
          <div className="flex items-center gap-5 xl:gap-6">
            {/* Left peek */}
            <div
              className="hidden lg:block shrink-0 opacity-40 hover:opacity-60 transition-opacity duration-300 cursor-pointer"
              style={{ width: "27%" }}
              onClick={prev}
              aria-hidden="true"
            >
              <CarouselCard outfit={prevOutfit} variant="peek" />
            </div>

            {/* Center */}
            <div className="flex-1 min-w-0">
              <AnimatedCard key={index}>
                <CarouselCard outfit={current} variant="center" />
              </AnimatedCard>
            </div>

            {/* Right peek */}
            <div
              className="hidden lg:block shrink-0 opacity-40 hover:opacity-60 transition-opacity duration-300 cursor-pointer"
              style={{ width: "27%" }}
              onClick={next}
              aria-hidden="true"
            >
              <CarouselCard outfit={nextOutfit} variant="peek" />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile arrows */}
      <div className="flex items-center justify-center gap-6 mt-8 md:hidden">
        <button
          onClick={prev}
          aria-label="Previous outfit"
          className="w-10 h-10 flex items-center justify-center border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="font-mono text-[10px] text-[var(--foreground-subtle)] tabular-nums">
          {index + 1} / {n}
        </span>
        <button
          onClick={next}
          aria-label="Next outfit"
          className="w-10 h-10 flex items-center justify-center border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Explore link */}
      <div className="text-center mt-12 px-6">
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
        >
          EXPLORE MORE LOOKS
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
