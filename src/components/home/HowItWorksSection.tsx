import Link from "next/link";
import Image from "next/image";
import FadeInView from "@/components/ui/FadeInView";
import FloatLoop from "@/components/ui/FloatLoop";

// ── PRODUCT CUTOUTS ──────────────────────────────────────────────────────────
const HOODIE = "/cs/hoodie-card-black.png";
const JEANS = "/cs/jeans-card.png";
const SNEAKERS = "/cs/sneakers-card.png";
const OUTFIT = "/cs/outfit-card.png";

// White product card — mirrors the real ProductCard image area.
function PCard({
  src,
  alt,
  className = "",
  pad = "p-2.5",
  radius = "rounded-xl",
}: {
  src: string;
  alt: string;
  className?: string;
  pad?: string;
  radius?: string;
}) {
  return (
    <div
      className={`absolute ${radius} bg-white ring-1 ring-black/5 shadow-[0_20px_44px_-18px_rgba(0,0,0,0.75)] ${className}`}
    >
      <Image src={src} alt={alt} fill sizes="220px" className={`object-contain ${pad}`} />
    </div>
  );
}

// Wishlist button identical to the real card's like button.
function HeartButton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute z-30 w-8 h-8 rounded-full bg-black/85 backdrop-blur-sm flex items-center justify-center ${className}`}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-white">
        <path
          d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
          stroke="currentColor"
          strokeWidth="1.3"
          fill="none"
        />
      </svg>
    </div>
  );
}

// White pointing-hand cursor (rotation passed via className).
function HandCursor({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="26"
      className={`absolute z-30 drop-shadow-[0_3px_5px_rgba(0,0,0,0.6)] ${className}`}
    >
      <path
        fill="#fff"
        stroke="#0a0a0a"
        strokeWidth="1"
        d="M9 2.6c-.8 0-1.4.6-1.4 1.4v6l-1-1c-.6-.6-1.5-.6-2.1 0-.6.6-.6 1.4 0 2l3.4 4.1c.8 1 2 1.6 3.4 1.6h2.6c2.1 0 3.8-1.7 3.8-3.8V9.9c0-.8-.6-1.4-1.4-1.4-.3 0-.5.1-.8.2-.2-.6-.7-1-1.4-1-.3 0-.6.1-.8.2-.2-.5-.7-.9-1.4-.9-.3 0-.5.1-.7.2V4c0-.8-.6-1.4-1.5-1.4z"
      />
    </svg>
  );
}

// Circular connector arrow — small, thin, low opacity.
function StepArrow() {
  return (
    <div className="hidden lg:flex absolute bottom-[130px] right-0 translate-x-[calc(50%+24px)] z-40 w-7 h-7 items-center justify-center rounded-full border border-white/12 text-white/35">
      <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
        <path d="M1 6.5H11M11 6.5L6.5 2M11 6.5L6.5 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── SHOPPING-CART ICON ───────────────────────────────────────────────────────

// White line-art shopping cart, printed on the front face of the box.
function CartMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 33 33"
      width="48"
      height="48"
      className={`text-white ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 1.5 H6.5 L11 23 H27.5 L31.5 7 H8.5" />
      <circle cx="13.5" cy="29" r="2.6" />
      <circle cx="25" cy="29" r="2.6" />
    </svg>
  );
}


// ── SCENES ───────────────────────────────────────────────────────────────────

// Shared reference frame — every scene fills exactly this box. Its width is
// tied to the text column (description max-w-[210px]), so each block runs from
// the left edge of the title to the end of the description and no further.
// All four scenes are left-aligned with the text, never centered.
//   Reference = Step 01's product card: 210 × 280.

// 01 — one large product card with a wishlist heart and a cursor on it.
// This card is the size reference for every other step.
function ChooseScene() {
  return (
    <div className="relative w-[210px] h-[280px]">
      <PCard src={HOODIE} alt="Hoodie" pad="p-4" radius="rounded-2xl" className="z-10 inset-0" />
      <HeartButton className="top-[14px] right-[14px]" />
      <HandCursor className="top-[38px] right-[6px] -rotate-[18deg]" />
    </div>
  );
}

// 02 — three draggable cards scattered to fill the same area as Step 01/03.
// Cards stay fully inside the reference frame (rotation included, no overflow).
function BuildScene() {
  return (
    <div className="relative w-[210px] h-[280px]">
      <div className="absolute inset-0 rounded-2xl border border-dashed border-white/12" />
      <PCard src={HOODIE} alt="Hoodie" className="z-10 left-[14px] top-[42px] w-[104px] h-[140px] -rotate-[8deg]" />
      <PCard src={JEANS} alt="Jeans" className="z-10 left-[95px] top-[42px] w-[94px] h-[140px] rotate-[6deg]" />
      <PCard src={SNEAKERS} alt="Sneakers" className="z-20 left-[43px] top-[190px] w-[124px] h-[84px] -rotate-[4deg]" />
      <HandCursor className="top-[232px] right-[36px] rotate-[14deg]" />
    </div>
  );
}

// 03 — the hero: AI-generated full-body look on one clean card (reference size).
function PreviewScene() {
  return (
    <div className="relative w-[210px] h-[280px]">
      <div className="absolute inset-0 rounded-2xl bg-white shadow-[0_28px_56px_-20px_rgba(0,0,0,0.8)] ring-1 ring-black/5">
        <Image src={OUTFIT} alt="AI-generated full-body look" fill sizes="220px" className="object-contain p-4" />
      </div>
    </div>
  );
}

// 04 — three product cards standing inside an open matte-black box, with a cart
// mark on the front face. Recreates the reference packshot one-to-one.
function ShopScene() {
  return (
    <div className="relative w-[210px] h-[280px]">
      {/* Raised back wall / opened lid, sitting behind the cards. */}
      <div className="absolute z-0 left-1/2 -translate-x-1/2 top-[24px] w-[150px] h-[152px] rounded-t-[7px] bg-[#0d0d0d]">
        <div className="absolute inset-x-0 top-0 h-[11px] rounded-t-[7px] bg-[#191919]" />
      </div>

      {/* Product cards standing upright in the box (bottoms tucked behind front). */}
      <PCard src={JEANS} alt="Jeans" radius="rounded-[10px]" pad="p-2" className="z-20 left-[24px] top-[58px] w-[66px] h-[152px] -rotate-[3deg]" />
      <PCard src={HOODIE} alt="Hoodie" radius="rounded-[10px]" pad="p-2" className="z-20 right-[24px] top-[58px] w-[66px] h-[152px] rotate-[3deg]" />
      <PCard src={SNEAKERS} alt="Sneakers" radius="rounded-[10px]" pad="p-2" className="z-10 left-1/2 -translate-x-1/2 top-[64px] w-[66px] h-[152px]" />

      {/* Front face of the box, covering the lower part of the cards. */}
      <div className="absolute z-30 bottom-0 left-1/2 -translate-x-1/2 w-[198px] h-[118px] rounded-[9px] bg-[#070707] shadow-[0_26px_52px_-18px_rgba(0,0,0,0.9)]">
        <div className="absolute inset-x-0 top-0 h-px bg-white/[0.08]" />
        <CartMark className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
}

// ── STEPS ────────────────────────────────────────────────────────────────────

const STEPS = [
  { n: "01", title: "Choose items", body: "Pick your favorite pieces from top brands.", scene: <ChooseScene /> },
  { n: "02", title: "Build your look", body: "Drag and drop to create the perfect outfit.", scene: <BuildScene /> },
  { n: "03", title: "Generate preview", body: "See your look come to life with AI visualization.", scene: <PreviewScene /> },
  { n: "04", title: "Shop the look", body: "Buy each item directly from the original store.", scene: <ShopScene /> },
];

// ── SECTION ──────────────────────────────────────────────────────────────────

export default function HowItWorksSection() {
  return (
    <section className="py-28 md:py-36 bg-[#050505]">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <FadeInView className="text-center mb-20 md:mb-28">
          <h2 className="text-4xl md:text-5xl lg:text-[56px] font-bold tracking-[-0.04em] leading-[1.04] text-white">
            Everything you need
            <br className="hidden sm:block" /> to create better outfits.
          </h2>
          <p className="mt-5 text-lg md:text-xl text-white/45">
            Visualize. Get inspired. Shop the look.
          </p>
        </FadeInView>

        {/* Soft gray panel sitting only behind the step cards and their labels. */}
        <div className="rounded-[28px] bg-[#161616] px-6 py-12 md:px-10 md:py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-20">
          {STEPS.map((step, i) => (
            <FadeInView key={step.n} delay={i * 0.08} className="flex flex-col">
              <div className="lg:min-h-[108px]">
                <span className="text-[13px] text-white/40 tabular-nums">{step.n}</span>
                <h3 className="mt-2 text-[19px] font-semibold text-white leading-snug">{step.title}</h3>
                <p className="mt-2 text-[14px] text-white/50 leading-relaxed max-w-[210px]">{step.body}</p>
              </div>

              <div className="relative mt-10 h-[280px] flex items-end justify-start">
                <FloatLoop delay={i * 0.7} duration={5 + i * 0.4}>
                  {step.scene}
                </FloatLoop>
                {i < STEPS.length - 1 && <StepArrow />}
              </div>
            </FadeInView>
          ))}
          </div>
        </div>

        <FadeInView delay={0.1} className="mt-20 md:mt-24 flex justify-center">
          <Link
            href="/builder"
            className="group inline-flex items-center gap-3 text-[15px] font-semibold text-white border-b border-white/20 pb-1.5 hover:gap-4 hover:border-white/50 transition-all duration-300"
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
