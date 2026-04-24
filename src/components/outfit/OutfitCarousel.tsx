"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Outfit } from "@/lib/types";
import OutfitCollage from "./OutfitCollage";
import Price from "@/components/ui/Price";

interface Props {
  outfits: Outfit[];
}

function getTypeLabel(outfit: Outfit): string {
  return outfit.isAIGenerated ? "AI GENERATED" : "CURATED PICK";
}

function getTags(outfit: Outfit): string {
  const keywords = outfit.styleKeywords.slice(0, 3).map((k) => k.toUpperCase());
  return [...keywords, `${outfit.items.length} ITEMS`].join(" · ");
}

interface CardProps {
  outfit: Outfit;
  peek?: boolean;
  onNext?: () => void;
}

function CarouselCard({ outfit, peek = false, onNext }: CardProps) {
  return (
    <div className="flex flex-col">
      {/* Image */}
      <Link
        href={peek ? "#" : `/outfit/${outfit.id}`}
        tabIndex={peek ? -1 : 0}
        className="block relative bg-[var(--surface)] overflow-hidden aspect-[3/4]"
        onClick={peek ? (e) => e.preventDefault() : undefined}
      >
        {outfit.imageUrl ? (
          <>
            {outfit.isAIGenerated && (
              <div className="absolute top-3 left-3 z-10">
                <span className="text-[8px] tracking-[0.16em] uppercase font-medium bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)] px-2 py-1 block">
                  AI · FLAT LAY
                </span>
              </div>
            )}
            <Image
              src={outfit.imageUrl}
              alt={outfit.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 45vw, 33vw"
            />
          </>
        ) : (
          <OutfitCollage
            outfit={outfit}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 45vw, 33vw"
          />
        )}
      </Link>

      {/* Info */}
      <div className="mt-4 space-y-1.5">
        <p className="text-2xl font-light text-[var(--foreground)] tracking-tight">
          <Price amount={outfit.totalPriceMin} prefix="$" />
        </p>
        <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] leading-relaxed">
          {getTags(outfit)}
        </p>
        {!peek && (
          <div className="flex items-center gap-2 pt-1">
            <Link
              href={`/outfit/${outfit.id}`}
              className="text-[10px] tracking-[0.14em] uppercase font-medium px-5 py-2.5 bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity"
            >
              EDIT
            </Link>
            <button
              onClick={onNext}
              aria-label="Next outfit"
              className="w-9 h-9 flex items-center justify-center border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}
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
        <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-[var(--foreground)]">
          AI · FLAT LAY
        </h2>
        <p className="mt-3 text-sm text-[var(--foreground-muted)]">
          Discover AI-generated looks and curated picks.
        </p>
      </div>

      {/* Category nav */}
      <div className="flex items-center justify-center gap-10 md:gap-20 mb-8 px-6">
        <button
          onClick={prev}
          className="text-[10px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors duration-200"
        >
          {getTypeLabel(prevOutfit)}
        </button>
        <div className="flex flex-col items-center gap-1 min-w-[120px]">
          <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--foreground)]">
            {getTypeLabel(current)}
          </span>
          <div className="h-px w-full bg-[var(--foreground)]" />
        </div>
        <button
          onClick={next}
          className="text-[10px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors duration-200"
        >
          {getTypeLabel(nextOutfit)}
        </button>
      </div>

      {/* Carousel track */}
      <div className="flex items-start justify-center overflow-hidden">
        {/* Prev — peek */}
        <div
          className="hidden lg:block shrink-0 w-64 xl:w-72 opacity-50 hover:opacity-70 transition-opacity duration-300 cursor-pointer"
          onClick={prev}
          aria-hidden="true"
        >
          <CarouselCard outfit={prevOutfit} peek />
        </div>

        {/* Center — active */}
        <div className="w-full max-w-[440px] lg:max-w-[500px] shrink-0 px-6 lg:px-10">
          <CarouselCard outfit={current} onNext={next} />
        </div>

        {/* Next — peek */}
        <div
          className="hidden lg:block shrink-0 w-64 xl:w-72 opacity-50 hover:opacity-70 transition-opacity duration-300 cursor-pointer"
          onClick={next}
          aria-hidden="true"
        >
          <CarouselCard outfit={nextOutfit} peek />
        </div>
      </div>

      {/* Mobile arrow nav */}
      <div className="flex items-center justify-center gap-6 mt-8 lg:hidden">
        <button
          onClick={prev}
          className="w-10 h-10 flex items-center justify-center border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors duration-200"
          aria-label="Previous outfit"
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
          className="w-10 h-10 flex items-center justify-center border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors duration-200"
          aria-label="Next outfit"
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
