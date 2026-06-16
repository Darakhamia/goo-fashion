import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart, MousePointer2 } from "lucide-react";
import FadeInView from "@/components/ui/FadeInView";

// ── PRODUCT CUTOUTS ──────────────────────────────────────────────────────────
// Transparent PNG cutouts of the catalog hero pieces, placed on white "product
// cards" so the black garments pop against the dark section background.
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
      className={`relative rounded-[13px] bg-white shadow-[0_14px_34px_-10px_rgba(0,0,0,0.55)] ring-1 ring-black/5 ${className}`}
    >
      <Image src={src} alt={alt} fill sizes="180px" className={`object-contain ${pad}`} />
    </div>
  );
}

// Circular outlined arrow shown between steps on large screens.
function StepArrow() {
  return (
    <div className="hidden lg:flex absolute top-1/2 right-0 translate-x-[calc(50%+20px)] -translate-y-1/2 z-30 w-9 h-9 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--foreground-muted)]">
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

// ── ILLUSTRATIONS ────────────────────────────────────────────────────────────

// 01 — Choose items: a GOO shopping bag with two cards peeking out and a
// "saved" heart badge.
function BagScene() {
  return (
    <div className="relative w-[200px] h-[280px]">
      <Card
        src={HOODIE}
        alt="Hoodie"
        className="absolute left-[14px] bottom-[118px] w-[82px] h-[110px] -rotate-[9deg] z-10"
      />
      <Card
        src={JEANS}
        alt="Jeans"
        className="absolute right-[14px] bottom-[126px] w-[80px] h-[110px] rotate-[10deg] z-10"
      />

      {/* Bag */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[160px] z-20">
        <svg viewBox="0 0 160 168" fill="none" className="w-full">
          {/* handle */}
          <path
            d="M54 48C54 22 106 22 106 48"
            stroke="#4A4A48"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* body */}
          <rect
            x="10"
            y="46"
            width="140"
            height="120"
            rx="15"
            fill="#191919"
            stroke="#34342F"
            strokeWidth="1.5"
          />
          <line x1="10" y1="63" x2="150" y2="63" stroke="#2B2B28" strokeWidth="1.5" />
        </svg>
        <span className="absolute inset-x-0 top-[58%] text-center text-[15px] font-bold tracking-[0.35em] text-[#EDEDED] pl-[0.35em] select-none">
          GOO
        </span>
      </div>

      {/* Saved badge */}
      <div className="absolute right-[2px] top-[92px] z-30 w-9 h-9 rounded-full bg-white shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)] ring-1 ring-black/5 flex items-center justify-center">
        <Heart size={15} className="text-[#111]" fill="#111" />
      </div>
    </div>
  );
}

// 02 — Build your look: a dashed drop zone with fanned cards and a cursor.
function DropZoneScene() {
  return (
    <div className="relative w-[220px] h-[280px] flex items-center justify-center">
      <div className="absolute w-[210px] h-[248px] rounded-[20px] border-2 border-dashed border-[var(--border-strong)]" />
      <Card
        src={HOODIE}
        alt="Hoodie"
        className="absolute left-[20px] top-[58px] w-[98px] h-[128px] -rotate-[10deg] z-10"
      />
      <Card
        src={JEANS}
        alt="Jeans"
        className="absolute right-[18px] top-[66px] w-[92px] h-[128px] rotate-[11deg] z-10"
      />
      <Card
        src={SNEAKERS}
        alt="Sneakers"
        className="absolute left-1/2 -translate-x-1/2 bottom-[40px] w-[126px] h-[84px] -rotate-[3deg] z-20"
      />
      <div className="absolute right-[26px] bottom-[20px] z-30 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
        <MousePointer2 size={26} className="fill-white text-[#111]" />
      </div>
    </div>
  );
}

// 03 — Generate preview: the assembled full-body look on a single card.
function PreviewScene() {
  return (
    <div className="relative w-[200px] h-[280px] flex items-center justify-center">
      <Card
        src={OUTFIT}
        alt="Generated full-body look"
        pad="p-3.5"
        className="w-[184px] h-[280px] rounded-[18px]"
      />
    </div>
  );
}

// 04 — Shop the look: an open shipping box with cards inside and a cart mark.
function BoxScene() {
  return (
    <div className="relative w-[210px] h-[280px]">
      <Card
        src={JEANS}
        alt="Jeans"
        className="absolute left-[28px] bottom-[104px] w-[78px] h-[108px] -rotate-[8deg] z-10"
      />
      <Card
        src={SNEAKERS}
        alt="Sneakers"
        className="absolute left-1/2 -translate-x-1/2 bottom-[112px] w-[86px] h-[96px] rotate-[5deg] z-10"
      />
      <Card
        src={HOODIE}
        alt="Hoodie"
        className="absolute right-[26px] bottom-[100px] w-[74px] h-[104px] rotate-[12deg] z-10"
      />

      {/* Box */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[196px] z-20">
        <svg viewBox="0 0 196 150" fill="none" className="w-full">
          {/* open flaps */}
          <path
            d="M18 44L46 6L46 36L26 56Z"
            fill="#161616"
            stroke="#34342F"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M178 44L150 6L150 36L170 56Z"
            fill="#161616"
            stroke="#34342F"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* front face */}
          <rect
            x="22"
            y="42"
            width="152"
            height="104"
            rx="14"
            fill="#191919"
            stroke="#34342F"
            strokeWidth="1.5"
          />
        </svg>
        <div className="absolute inset-x-0 top-[64%] flex items-center justify-center text-white">
          <ShoppingCart size={26} strokeWidth={1.6} />
        </div>
      </div>
    </div>
  );
}

// ── STEPS ────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    title: "Choose items",
    body: "Pick your favorite pieces from top brands.",
    scene: <BagScene />,
  },
  {
    n: "02",
    title: "Build your look",
    body: "Drag and drop to create the perfect outfit.",
    scene: <DropZoneScene />,
  },
  {
    n: "03",
    title: "Generate preview",
    body: "See your look come to life with AI visualization.",
    scene: <PreviewScene />,
  },
  {
    n: "04",
    title: "Shop the look",
    body: "Buy each item directly from the original store.",
    scene: <BoxScene />,
  },
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
              <div className="lg:min-h-[116px]">
                <span className="text-[13px] text-[var(--foreground-subtle)] tabular-nums">
                  {step.n}
                </span>
                <h3 className="mt-2 text-[19px] font-semibold text-[var(--foreground)] leading-snug">
                  {step.title}
                </h3>
                <p className="mt-2 text-[14px] text-[var(--foreground-muted)] leading-relaxed max-w-[220px]">
                  {step.body}
                </p>
              </div>

              <div className="relative mt-6 h-[300px] flex items-center justify-center">
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
              <path
                d="M1 6H17M17 6L12 1M17 6L12 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </FadeInView>
      </div>
    </section>
  );
}
