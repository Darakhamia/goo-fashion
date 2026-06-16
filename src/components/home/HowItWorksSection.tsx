import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart, MousePointer2 } from "lucide-react";
import FadeInView from "@/components/ui/FadeInView";

// ── PRODUCT CUTOUTS ──────────────────────────────────────────────────────────
// Transparent PNG cutouts of the catalog hero pieces, shown on white "product
// cards" so the black garments read clearly against the dark section.
const HOODIE = "/cs/hoodie-card.png";
const JEANS = "/cs/jeans-card.png";
const SNEAKERS = "/cs/sneakers-card.png";
const OUTFIT = "/cs/outfit-card.png";

// A floating white product card with the garment cutout centered inside.
function Card({
  src,
  alt,
  className = "",
  pad = "p-2",
}: {
  src: string;
  alt: string;
  className?: string;
  pad?: string;
}) {
  return (
    <div
      className={`absolute rounded-[13px] bg-white shadow-[0_16px_36px_-12px_rgba(0,0,0,0.6)] ring-1 ring-black/5 ${className}`}
    >
      <Image src={src} alt={alt} fill sizes="160px" className={`object-contain ${pad}`} />
    </div>
  );
}

// Circular outlined connector arrow shown between steps on large screens.
function StepArrow() {
  return (
    <div className="hidden lg:flex absolute bottom-[150px] right-0 translate-x-[calc(50%+20px)] z-40 w-9 h-9 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--foreground-muted)]">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path
          d="M1 6.5H11M11 6.5L6.5 2M11 6.5L6.5 11"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ── SVG ART ──────────────────────────────────────────────────────────────────

// Matte-black paper shopping bag with rope handles (GOO printed separately).
function BagArt() {
  return (
    <svg viewBox="0 0 200 210" className="w-full h-auto block">
      <defs>
        <linearGradient id="bagFront" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#242424" />
          <stop offset="0.45" stopColor="#171717" />
          <stop offset="1" stopColor="#0d0d0d" />
        </linearGradient>
        <linearGradient id="bagSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0b0b0b" />
          <stop offset="1" stopColor="#040404" />
        </linearGradient>
        <linearGradient id="bagRim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a3a" />
          <stop offset="1" stopColor="#101010" />
        </linearGradient>
      </defs>
      <path d="M58 72 C54 34 96 34 95 70" fill="none" stroke="#7c7c78" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M105 70 C104 34 146 34 142 72" fill="none" stroke="#5f5f5c" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M150 70 L172 80 L172 198 L150 190 Z" fill="url(#bagSide)" />
      <path d="M34 70 L150 70 L150 190 L34 198 Z" fill="url(#bagFront)" />
      <path d="M34 70 L150 70 L172 80 L150 78 L34 78 Z" fill="url(#bagRim)" />
      <path d="M34 78 L150 78" stroke="#2c2c2c" strokeWidth="1" />
      <path d="M34 78 L150 78 L150 86 L34 86 Z" fill="#000" opacity="0.55" />
    </svg>
  );
}

// Matte-black open shipping box with splayed flaps (cart icon overlaid).
function BoxArt() {
  return (
    <svg viewBox="0 0 240 200" className="w-full h-auto block">
      <defs>
        <linearGradient id="boxFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#222" />
          <stop offset="1" stopColor="#0c0c0c" />
        </linearGradient>
        <linearGradient id="boxLeft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#171717" />
          <stop offset="1" stopColor="#090909" />
        </linearGradient>
        <linearGradient id="boxFlap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1d1d" />
          <stop offset="1" stopColor="#0f0f0f" />
        </linearGradient>
        <linearGradient id="boxFlapIn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#272727" />
          <stop offset="1" stopColor="#151515" />
        </linearGradient>
      </defs>
      <path d="M74 100 L166 100 L158 58 L82 58 Z" fill="url(#boxFlapIn)" stroke="#2c2c2c" strokeWidth="1" strokeLinejoin="round" />
      <path d="M74 100 L36 84 L20 104 L60 118 Z" fill="url(#boxFlap)" stroke="#2a2a2a" strokeWidth="1" strokeLinejoin="round" />
      <path d="M166 100 L204 84 L220 104 L180 118 Z" fill="url(#boxFlap)" stroke="#2a2a2a" strokeWidth="1" strokeLinejoin="round" />
      <path d="M58 104 L182 104 L174 122 L66 122 Z" fill="#040404" />
      <path d="M58 108 L58 180 L46 188 L46 116 Z" fill="url(#boxLeft)" />
      <path d="M58 108 L182 108 L182 180 L58 180 Z" fill="url(#boxFront)" />
      <rect x="57" y="107" width="126" height="74" rx="7" fill="none" stroke="#2f2f2f" strokeWidth="1.2" />
      <path d="M58 108 L182 108 L176 100 L64 100 Z" fill="url(#boxFlapIn)" stroke="#2c2c2c" strokeWidth="0.8" />
    </svg>
  );
}

// ── ILLUSTRATIONS ────────────────────────────────────────────────────────────
// Each scene is bottom-aligned inside the step's stage so it never collides
// with the heading text above it.

// 01 — Choose items: cards tucked into a GOO shopping bag, with a saved heart.
function BagScene() {
  return (
    <div className="relative w-[200px] h-[240px]">
      <Card src={HOODIE} alt="Hoodie" className="z-10 left-[20px] bottom-[84px] w-[80px] h-[106px] -rotate-[11deg]" />
      <Card src={JEANS} alt="Jeans" className="z-10 right-[20px] bottom-[96px] w-[76px] h-[106px] rotate-[9deg]" />

      <div className="absolute z-20 bottom-0 left-1/2 -translate-x-1/2 w-[176px]">
        <div className="relative">
          <BagArt />
          <span className="absolute left-[46%] top-[63%] -translate-x-1/2 -translate-y-1/2 text-[15px] font-bold tracking-[0.32em] text-[#ededed] pl-[0.32em] select-none">
            GOO
          </span>
        </div>
      </div>

      <div className="absolute z-30 right-[8px] bottom-[176px] w-9 h-9 rounded-full bg-white shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)] ring-1 ring-black/5 flex items-center justify-center">
        <Heart size={15} className="text-[#111]" fill="#111" />
      </div>
    </div>
  );
}

// 02 — Build your look: fanned cards inside a dashed drop zone with a cursor.
function DropZoneScene() {
  return (
    <div className="relative w-[208px] h-[240px]">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[200px] h-[228px] rounded-[20px] border-2 border-dashed border-[var(--border-strong)]" />
      <Card src={HOODIE} alt="Hoodie" className="z-10 left-[14px] bottom-[78px] w-[94px] h-[122px] -rotate-[9deg]" />
      <Card src={JEANS} alt="Jeans" className="z-10 right-[14px] bottom-[88px] w-[88px] h-[122px] rotate-[11deg]" />
      <Card src={SNEAKERS} alt="Sneakers" className="z-20 left-1/2 -translate-x-1/2 bottom-[34px] w-[120px] h-[80px] -rotate-[3deg]" />
      <div className="absolute z-30 right-[24px] bottom-[20px] text-[#111] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
        <MousePointer2 size={26} className="fill-white" />
      </div>
    </div>
  );
}

// 03 — Generate preview: the assembled full-body look on a single card.
function PreviewScene() {
  return (
    <div className="relative w-[180px] h-[280px]">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[180px] h-[278px] rounded-[18px] bg-white shadow-[0_24px_50px_-16px_rgba(0,0,0,0.7)] ring-1 ring-black/5">
        <Image src={OUTFIT} alt="Generated full-body look" fill sizes="180px" className="object-contain p-3.5" />
      </div>
    </div>
  );
}

// 04 — Shop the look: cards standing in an open box with a cart mark.
function BoxScene() {
  return (
    <div className="relative w-[210px] h-[240px]">
      <Card src={JEANS} alt="Jeans" className="z-10 left-[28px] bottom-[58px] w-[70px] h-[98px] -rotate-[8deg]" />
      <Card src={SNEAKERS} alt="Sneakers" className="z-10 left-1/2 -translate-x-1/2 bottom-[64px] w-[78px] h-[92px] rotate-[5deg]" />
      <Card src={HOODIE} alt="Hoodie" className="z-10 right-[28px] bottom-[62px] w-[66px] h-[96px] rotate-[12deg]" />

      <div className="absolute z-20 bottom-0 left-1/2 -translate-x-1/2 w-[206px]">
        <div className="relative">
          <BoxArt />
          <div className="absolute left-1/2 top-[72%] -translate-x-1/2 -translate-y-1/2 text-white">
            <ShoppingCart size={24} strokeWidth={1.7} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STEPS ────────────────────────────────────────────────────────────────────

const STEPS = [
  { n: "01", title: "Choose items", body: "Pick your favorite pieces from top brands.", scene: <BagScene /> },
  { n: "02", title: "Build your look", body: "Drag and drop to create the perfect outfit.", scene: <DropZoneScene /> },
  { n: "03", title: "Generate preview", body: "See your look come to life with AI visualization.", scene: <PreviewScene /> },
  { n: "04", title: "Shop the look", body: "Buy each item directly from the original store.", scene: <BoxScene /> },
];

// ── SECTION ──────────────────────────────────────────────────────────────────

export default function HowItWorksSection() {
  return (
    <section className="py-24 md:py-32 bg-[var(--background)]">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <FadeInView className="text-center mb-16 md:mb-20">
          <h2 className="text-4xl md:text-5xl lg:text-[56px] font-bold tracking-[-0.04em] leading-[1.04] text-[var(--foreground)]">
            Everything you need
            <br className="hidden sm:block" /> to create better outfits.
          </h2>
          <p className="mt-5 text-lg md:text-xl text-[var(--foreground-muted)]">
            Visualize. Get inspired. Shop the look.
          </p>
        </FadeInView>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-16">
          {STEPS.map((step, i) => (
            <FadeInView key={step.n} delay={i * 0.08} className="flex flex-col">
              <div className="lg:min-h-[112px]">
                <span className="text-[13px] text-[var(--foreground-subtle)] tabular-nums">{step.n}</span>
                <h3 className="mt-2 text-[19px] font-semibold text-[var(--foreground)] leading-snug">
                  {step.title}
                </h3>
                <p className="mt-2 text-[14px] text-[var(--foreground-muted)] leading-relaxed max-w-[220px]">
                  {step.body}
                </p>
              </div>

              <div className="relative mt-8 h-[290px] flex items-end justify-center">
                {step.scene}
                {i < STEPS.length - 1 && <StepArrow />}
              </div>
            </FadeInView>
          ))}
        </div>

        <FadeInView delay={0.1} className="mt-16 md:mt-20 flex justify-center">
          <Link
            href="/builder"
            className="group inline-flex items-center gap-3 text-[15px] font-semibold text-[var(--foreground)] border-b border-[var(--border-strong)] pb-1.5 hover:gap-4 transition-all duration-300"
          >
            Try the builder
            <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
              <path d="M1 6H17M17 6L12 1M17 6L12 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </FadeInView>
      </div>
    </section>
  );
}
