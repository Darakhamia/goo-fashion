"use client";

import { useState, useRef, useCallback } from "react";

const SLIDES = [
  { id: "01", label: "ITEMS" },
  { id: "02", label: "OUTFIT" },
  { id: "03", label: "BRANDS" },
];

const BRANDS = [
  "AMIRI", "BALENCIAGA", "RICK OWENS", "CELINE",
  "SAINT LAURENT", "PRADA", "ACNE STUDIOS", "OFF-WHITE",
  "BOTTEGA VENETA", "GIVENCHY", "LOEWE", "MAISON MARGIELA",
];

const ITEMS = [
  { n: "01", cat: "HOODIE", brand: "ENFANTS RICHES DÉPRIMÉS", img: "/cs/hoodie.png" },
  { n: "02", cat: "JEANS", brand: "STRIPE BAGGY DENIM", img: "/cs/jeans.png" },
  { n: "03", cat: "SNEAKERS", brand: "BALENCIAGA", img: "/cs/sneakers.png" },
];

function EmailForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (state === "loading" || state === "done") return;
    setState("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="border border-white/10 bg-white/[0.02] p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
      <div className="shrink-0">
        <p className="text-[9px] tracking-[0.22em] uppercase text-white/30 mb-1">Be the first to know</p>
        <p className="text-[15px] md:text-[18px] font-black text-white uppercase tracking-tight leading-tight">
          Get notified<br className="hidden md:block" /> when we launch.
        </p>
      </div>
      <form onSubmit={submit} className="flex-1 flex items-center border border-white/15 bg-black">
        {state === "done" ? (
          <p className="flex-1 px-5 py-4 text-[12px] text-white/60 tracking-[0.1em] uppercase">You&apos;re on the list ✓</p>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="flex-1 bg-transparent px-5 py-4 text-[12px] text-white placeholder:text-white/25 tracking-[0.06em] outline-none"
            />
            <button
              type="submit"
              disabled={state === "loading"}
              className="px-5 py-4 text-white/60 hover:text-white transition-colors disabled:opacity-40"
            >
              {state === "loading" ? (
                <svg width="16" height="16" viewBox="0 0 16 16" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                  <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 8h12M9 3l5 5-5 5" />
                </svg>
              )}
            </button>
          </>
        )}
      </form>
      {state === "error" && <p className="text-[10px] text-red-400/80 tracking-wide">Something went wrong. Try again.</p>}
    </div>
  );
}

function Slide01() {
  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
      <div className="grid grid-cols-3 gap-3 flex-1">
        {ITEMS.map((item) => (
          <div key={item.n} className="relative border border-white/8 bg-white/[0.02] overflow-hidden flex flex-col">
            <div className="absolute top-3 left-3 z-10">
              <span className="text-[9px] tracking-[0.18em] text-white/30 font-mono">{item.n}</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.img} alt={item.cat} className="flex-1 w-full object-cover object-center min-h-0" />
            <div className="p-3 shrink-0">
              <p className="text-[11px] font-black text-white tracking-wide uppercase">{item.cat}</p>
              <p className="text-[9px] text-white/35 tracking-[0.1em] uppercase mt-0.5">{item.brand}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide02() {
  return (
    <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden min-h-0">
      {/* Item list */}
      <div className="flex flex-col gap-2">
        <p className="text-[9px] tracking-[0.2em] uppercase text-white/25 mb-1">01 / ITEMS</p>
        {ITEMS.map((item) => (
          <div key={item.n} className="border border-white/8 bg-white/[0.02] flex items-center gap-3 p-3 flex-1 min-h-0">
            <span className="text-[9px] font-mono text-white/25 shrink-0">{item.n}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.img} alt={item.cat} className="h-full max-h-16 w-12 object-cover object-center shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-black text-white uppercase tracking-wide leading-tight">{item.cat}</p>
              <p className="text-[9px] text-white/35 uppercase tracking-[0.08em] mt-0.5 leading-tight">{item.brand}</p>
            </div>
            <div className="ml-auto shrink-0 w-6 h-6 border border-white/20 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-white/40">
                <path d="M5 2v6M2 5h6" />
              </svg>
            </div>
          </div>
        ))}
      </div>

      {/* Complete look */}
      <div className="border border-white/8 bg-white/[0.02] flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-white/6 flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] tracking-[0.18em] uppercase text-white/40 font-black">Complete Look</span>
          <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
        </div>
        <div className="flex-1 relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cs/outfit.png" alt="Complete look" className="absolute inset-0 w-full h-full object-contain object-center" />
        </div>
      </div>
    </div>
  );
}

function Slide03() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex items-end justify-between mb-4 shrink-0">
        <div>
          <p className="text-[9px] tracking-[0.2em] uppercase text-white/25 mb-1">Premium Brands</p>
          <p className="text-[20px] md:text-[24px] font-black text-white uppercase tracking-tight leading-none">
            50+ Premium Brands.<br />One Place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 border border-white/15 flex items-center justify-center text-white/40 hover:text-white hover:border-white/40 transition-colors">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 5l3 3" />
            </svg>
          </button>
          <button className="w-8 h-8 border border-white/40 flex items-center justify-center text-white hover:border-white transition-colors">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 2l3 3-3 3" />
            </svg>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 flex-1 content-start">
        {BRANDS.map((brand) => (
          <div key={brand} className="border border-white/8 bg-white/[0.02] flex items-center justify-center p-3 aspect-[4/3]">
            <span className="text-[9px] md:text-[10px] font-black tracking-[0.1em] text-white/55 text-center uppercase leading-tight">
              {brand}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FeatureCarousel({ onSlideChange }: { onSlideChange?: (idx: number) => void }) {
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [animating, setAnimating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback((idx: number) => {
    if (idx === active || animating) return;
    setDir(idx > active ? 1 : -1);
    setAnimating(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setActive(idx);
      onSlideChange?.(idx);
      setAnimating(false);
    }, 320);
  }, [active, animating, onSlideChange]);

  const slideStyle = {
    opacity: animating ? 0 : 1,
    transform: animating ? `translateX(${dir * 40}px)` : "translateX(0)",
    transition: "opacity 0.32s ease, transform 0.32s ease",
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Slide content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={slideStyle}>
        {active === 0 && <Slide01 />}
        {active === 1 && <Slide02 />}
        {active === 2 && <Slide03 />}
      </div>

      {/* Email form */}
      <div className="shrink-0">
        <EmailForm />
      </div>

      {/* Tab nav */}
      <div className="shrink-0 flex items-center gap-0 border-t border-white/[0.06] pt-4">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            onClick={() => go(i)}
            className="flex items-center gap-3 group pr-6"
          >
            <div
              className="h-px transition-all duration-400 shrink-0"
              style={{
                width: i === active ? 28 : 18,
                background: i === active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.12)",
              }}
            />
            <span
              className="text-[9px] tracking-[0.18em] uppercase font-medium transition-colors duration-300"
              style={{ color: i === active ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)" }}
            >
              {slide.id} / {slide.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
