import Link from "next/link";
import Image from "next/image";
import FadeInView from "@/components/ui/FadeInView";

// ── PRODUCT CUTOUTS ──────────────────────────────────────────────────────────
const HOODIE = "/cs/hoodie-card.png";
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
    <div className="hidden lg:flex absolute bottom-[150px] right-0 translate-x-[calc(50%+24px)] z-40 w-7 h-7 items-center justify-center rounded-full border border-white/12 text-white/35">
      <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
        <path d="M1 6.5H11M11 6.5L6.5 2M11 6.5L6.5 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── SVG ART (flat matte, no gradients) ───────────────────────────────────────

// Open gift box — back half: opened lid + inner wall + tissue.
function BoxBackArt() {
  return (
    <svg viewBox="0 0 270 196" className="w-full h-auto block">
      <path d="M70 116 L82 14 L212 14 L200 116 Z" fill="#121212" />
      <path d="M82 14 L212 14 L208 26 L86 26 Z" fill="#1d1d1d" />
      <path d="M56 120 L214 120 L200 138 L70 138 Z" fill="#0c0c0c" />
      <path d="M74 126 L130 122 L165 130 L205 124 L202 140 L74 142 Z" fill="#181818" />
    </svg>
  );
}

// Open gift box — front half: base, tissue lip and cart mark.
function BoxFrontArt() {
  return (
    <svg viewBox="0 0 270 116" className="w-full h-auto block">
      <ellipse cx="135" cy="110" rx="104" ry="7" fill="#000000" opacity="0.55" />
      <path d="M52 6 L66 24 L66 92 L46 84 Z" fill="#0e0e0e" />
      <path d="M66 24 L218 24 L218 92 L66 92 Z" fill="#171717" />
      <path d="M218 24 L232 10 L232 78 L218 92 Z" fill="#0b0b0b" />
      <path d="M66 24 L130 20 L165 26 L218 22 L218 32 L66 34 Z" fill="#1c1c1c" />
      <g stroke="#e8e8e8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(126,50)">
        <path d="M0 0 L6 0 L11 22 L27 22 L31 6 L9 6" />
        <circle cx="13" cy="28" r="2.6" />
        <circle cx="25" cy="28" r="2.6" />
      </g>
    </svg>
  );
}

// ── SCENES ───────────────────────────────────────────────────────────────────

// Shared reference frame — every scene fills exactly this box so all four
// blocks occupy an identical visual area and stay perfectly centered.
//   Reference = Step 01's product card: 224 × 300.

// 01 — one large product card with a wishlist heart and a cursor on it.
// This card is the size reference for every other step.
function ChooseScene() {
  return (
    <div className="relative w-[224px] h-[300px]">
      <PCard src={HOODIE} alt="Hoodie" pad="p-4" radius="rounded-2xl" className="z-10 inset-0" />
      <HeartButton className="top-[16px] right-[16px]" />
      <HandCursor className="top-[42px] right-[6px] -rotate-[18deg]" />
    </div>
  );
}

// 02 — three draggable cards scattered to fill the same area as Step 01/03.
// Cards stay fully inside the reference frame (rotation included, no overflow).
function BuildScene() {
  return (
    <div className="relative w-[224px] h-[300px]">
      <div className="absolute inset-0 rounded-2xl border border-dashed border-white/12" />
      <PCard src={HOODIE} alt="Hoodie" className="z-10 left-[15px] top-[46px] w-[110px] h-[148px] -rotate-[8deg]" />
      <PCard src={JEANS} alt="Jeans" className="z-10 left-[100px] top-[45px] w-[100px] h-[150px] rotate-[6deg]" />
      <PCard src={SNEAKERS} alt="Sneakers" className="z-20 left-[46px] top-[205px] w-[132px] h-[90px] -rotate-[4deg]" />
      <HandCursor className="top-[250px] right-[40px] rotate-[14deg]" />
    </div>
  );
}

// 03 — the hero: AI-generated full-body look on one clean card (reference size).
function PreviewScene() {
  return (
    <div className="relative w-[224px] h-[300px]">
      <div className="absolute inset-0 rounded-2xl bg-white shadow-[0_28px_56px_-20px_rgba(0,0,0,0.8)] ring-1 ring-black/5">
        <Image src={OUTFIT} alt="AI-generated full-body look" fill sizes="240px" className="object-contain p-4" />
      </div>
    </div>
  );
}

// 04 — cards standing inside an open gift box. The whole composition is scaled
// uniformly to fit the reference frame and centered on the same baseline.
function ShopScene() {
  return (
    <div className="relative w-[224px] h-[300px]">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 origin-bottom scale-[0.862]">
        <div className="relative w-[260px] h-[300px]">
          <div className="absolute z-0 bottom-[53px] left-1/2 -translate-x-1/2 w-[252px]">
            <BoxBackArt />
          </div>

          <PCard src={JEANS} alt="Jeans" className="z-10 left-[45px] bottom-[74px] w-[54px] h-[156px] -rotate-[4deg]" pad="p-1.5" />
          <PCard src={SNEAKERS} alt="Sneakers" className="z-10 left-1/2 -translate-x-1/2 bottom-[78px] w-[60px] h-[108px] rotate-[3deg]" pad="p-1.5" />
          <PCard src={HOODIE} alt="Hoodie" className="z-10 right-[50px] bottom-[76px] w-[52px] h-[150px] rotate-[4deg]" pad="p-1.5" />

          <div className="absolute z-20 bottom-0 left-1/2 -translate-x-1/2 w-[252px]">
            <BoxFrontArt />
          </div>
        </div>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-20">
          {STEPS.map((step, i) => (
            <FadeInView key={step.n} delay={i * 0.08} className="flex flex-col">
              <div className="lg:min-h-[108px]">
                <span className="text-[13px] text-white/40 tabular-nums">{step.n}</span>
                <h3 className="mt-2 text-[19px] font-semibold text-white leading-snug">{step.title}</h3>
                <p className="mt-2 text-[14px] text-white/50 leading-relaxed max-w-[210px]">{step.body}</p>
              </div>

              <div className="relative mt-10 h-[320px] flex items-end justify-center">
                {step.scene}
                {i < STEPS.length - 1 && <StepArrow />}
              </div>
            </FadeInView>
          ))}
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
