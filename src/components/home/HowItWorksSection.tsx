import Link from "next/link";
import Image from "next/image";
import FadeInView from "@/components/ui/FadeInView";

// ── PRODUCT CUTOUTS ──────────────────────────────────────────────────────────
const HOODIE = "/cs/hoodie-card.png";
const JEANS = "/cs/jeans-card.png";
const SNEAKERS = "/cs/sneakers-card.png";
const OUTFIT = "/cs/outfit-card.png";

// White product card — mirrors the real ProductCard image area (white bg,
// rounded-xl, object-contain, hairline ring + a single soft shadow).
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
      <Image src={src} alt={alt} fill sizes="200px" className={`object-contain ${pad}`} />
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

// White pointing-hand cursor.
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
    <div className="hidden lg:flex absolute bottom-[132px] right-0 translate-x-[calc(50%+24px)] z-40 w-7 h-7 items-center justify-center rounded-full border border-white/12 text-white/35">
      <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
        <path d="M1 6.5H11M11 6.5L6.5 2M11 6.5L6.5 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── SVG ART (flat matte, no gradients) ───────────────────────────────────────

// Rigid matte-black paper shopping bag with thin handles (GOO overlaid).
function BagArt() {
  return (
    <svg viewBox="0 0 190 200" className="w-full h-auto block">
      <ellipse cx="88" cy="193" rx="62" ry="6" fill="#000000" opacity="0.55" />
      <path d="M58 66 C56 38 86 38 86 64" fill="none" stroke="#4a4a4a" strokeWidth="2" />
      <path d="M92 64 C92 38 122 38 120 66" fill="none" stroke="#3d3d3d" strokeWidth="2" />
      <path d="M150 62 L170 72 L170 182 L150 174 Z" fill="#0d0d0d" />
      <path d="M18 62 L150 62 L150 174 L18 182 Z" fill="#161616" />
      <path d="M18 62 L150 62 L170 72 L150 70 L18 70 Z" fill="#1f1f1f" />
      <path d="M18 70 L150 70 L150 76 L18 76 Z" fill="#000000" opacity="0.5" />
    </svg>
  );
}

// Open magnetic gift box — back half: opened lid + inner wall + tissue.
function BoxBackArt() {
  return (
    <svg viewBox="0 0 250 175" className="w-full h-auto block">
      <path d="M58 92 L70 30 L196 30 L184 92 Z" fill="#121212" />
      <path d="M70 30 L196 30 L192 40 L74 40 Z" fill="#1d1d1d" />
      <path d="M52 96 L198 96 L186 112 L64 112 Z" fill="#0c0c0c" />
      <path d="M70 104 L120 100 L150 108 L185 102 L182 116 L70 118 Z" fill="#181818" />
    </svg>
  );
}

// Open magnetic gift box — front half: base, tissue lip and cart mark.
function BoxFrontArt() {
  return (
    <svg viewBox="0 0 250 110" className="w-full h-auto block">
      <ellipse cx="125" cy="104" rx="92" ry="7" fill="#000000" opacity="0.55" />
      <path d="M52 4 L64 20 L64 86 L46 78 Z" fill="#0e0e0e" />
      <path d="M64 20 L198 20 L198 86 L64 86 Z" fill="#171717" />
      <path d="M198 20 L210 8 L210 74 L198 86 Z" fill="#0b0b0b" />
      <path d="M64 20 L120 16 L150 22 L198 18 L198 28 L64 30 Z" fill="#1c1c1c" />
      <g stroke="#e8e8e8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(112,46)">
        <path d="M0 0 L6 0 L11 22 L27 22 L31 6 L9 6" />
        <circle cx="13" cy="28" r="2.6" />
        <circle cx="25" cy="28" r="2.6" />
      </g>
    </svg>
  );
}

// ── SCENES ───────────────────────────────────────────────────────────────────

// 01 — one product card lifted out of a GOO bag; cursor heading to the heart.
function ChooseScene() {
  return (
    <div className="relative w-[230px] h-[286px]">
      <PCard src={HOODIE} alt="Hoodie" className="z-10 left-1/2 -translate-x-1/2 bottom-[80px] w-[122px] h-[164px]" />
      <HeartButton className="top-[36px] right-[44px]" />
      <HandCursor className="top-[58px] right-[30px]" />

      <div className="absolute z-20 bottom-0 left-1/2 -translate-x-1/2 w-[186px]">
        <div className="relative">
          <BagArt />
          <span className="absolute left-[44%] top-[60%] -translate-x-1/2 -translate-y-1/2 text-[15px] font-bold tracking-[0.34em] text-[#ededed] pl-[0.34em] select-none">
            GOO
          </span>
        </div>
      </div>
    </div>
  );
}

// 02 — three draggable cards scattered over a faint drop zone.
function BuildScene() {
  return (
    <div className="relative w-[214px] h-[270px]">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[204px] h-[236px] rounded-[20px] border border-dashed border-white/12" />
      <PCard src={HOODIE} alt="Hoodie" className="z-10 left-[6px] bottom-[70px] w-[94px] h-[126px] -rotate-[8deg]" />
      <PCard src={JEANS} alt="Jeans" className="z-10 right-[6px] bottom-[80px] w-[88px] h-[126px] rotate-[6deg]" />
      <PCard src={SNEAKERS} alt="Sneakers" className="z-20 left-1/2 -translate-x-1/2 bottom-[26px] w-[112px] h-[78px] -rotate-[4deg]" />
      <HandCursor className="bottom-[18px] right-[40px] rotate-[8deg]" />
    </div>
  );
}

// 03 — the hero: AI-generated full-body look on one clean card.
function PreviewScene() {
  return (
    <div className="relative w-[188px] h-[286px]">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[188px] h-[284px] rounded-2xl bg-white shadow-[0_28px_56px_-20px_rgba(0,0,0,0.8)] ring-1 ring-black/5">
        <Image src={OUTFIT} alt="AI-generated full-body look" fill sizes="200px" className="object-contain p-4" />
      </div>
    </div>
  );
}

// 04 — cards standing inside an open magnetic gift box with a cart mark.
function ShopScene() {
  return (
    <div className="relative w-[244px] h-[270px]">
      <div className="absolute z-0 bottom-[52px] left-1/2 -translate-x-1/2 w-[240px]">
        <BoxBackArt />
      </div>

      <PCard src={JEANS} alt="Jeans" className="z-10 left-[58px] bottom-[44px] w-[56px] h-[116px] -rotate-[6deg]" pad="p-1.5" />
      <PCard src={SNEAKERS} alt="Sneakers" className="z-10 left-1/2 -translate-x-1/2 bottom-[48px] w-[64px] h-[92px] rotate-[3deg]" pad="p-1.5" />
      <PCard src={HOODIE} alt="Hoodie" className="z-10 right-[58px] bottom-[46px] w-[54px] h-[112px] rotate-[7deg]" pad="p-1.5" />

      <div className="absolute z-20 bottom-0 left-1/2 -translate-x-1/2 w-[240px]">
        <BoxFrontArt />
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

              <div className="relative mt-10 h-[300px] flex items-end justify-center">
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
