"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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

const AUTOPLAY_MS = 4500;

/* ── Glow card wrapper ─────────────────────────────────────────── */
function GlowCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden transition-all duration-500 ${className}`}
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 0 0 0 rgba(255,255,255,0)",
        ...style,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 0 40px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.14)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 0 rgba(255,255,255,0)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
      }}
    >
      {children}
    </div>
  );
}

/* ── Email form ────────────────────────────────────────────────── */
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
    <GlowCard>
      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="shrink-0">
          <p className="text-[8px] tracking-[0.26em] uppercase text-white/25 mb-1">Be the first to know</p>
          <p className="text-[14px] font-black text-white uppercase tracking-tight leading-tight">
            Get notified when<br className="hidden sm:block" /> we launch.
          </p>
        </div>
        <form onSubmit={submit} className="flex-1 flex items-center rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.4)" }}>
          {state === "done" ? (
            <p className="flex-1 px-5 py-3.5 text-[11px] text-white/50 tracking-[0.12em] uppercase">
              You&apos;re on the list ✓
            </p>
          ) : (
            <>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="flex-1 bg-transparent px-5 py-3.5 text-[12px] text-white placeholder:text-white/20 tracking-[0.06em] outline-none"
              />
              <button
                type="submit"
                disabled={state === "loading"}
                className="px-5 py-3.5 text-white/50 hover:text-white transition-colors disabled:opacity-30"
              >
                {state === "loading" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="7" cy="7" r="5" strokeOpacity="0.25" />
                    <path d="M7 2a5 5 0 0 1 5 5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1.5 7h11M8 2.5l5 4.5-5 4.5" />
                  </svg>
                )}
              </button>
            </>
          )}
        </form>
        {state === "error" && (
          <p className="text-[10px] text-red-400/70 tracking-wide shrink-0">Try again.</p>
        )}
      </div>
    </GlowCard>
  );
}

/* ── Slide 01: Items ───────────────────────────────────────────── */
function Slide01() {
  return (
    <div className="flex-1 grid grid-cols-3 gap-3 min-h-0">
      {ITEMS.map((item, i) => (
        <GlowCard key={item.n} className="flex flex-col" >
          <div className="relative flex-1 min-h-0 overflow-hidden">
            <span
              className="absolute top-3 left-3 z-10 text-[8px] tracking-[0.2em] text-white/30 font-mono"
              style={{ textShadow: "0 0 8px rgba(255,255,255,0.4)" }}
            >
              {item.n}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.img}
              alt={item.cat}
              className="w-full h-full object-cover object-center"
              style={{
                animation: `imgReveal 0.7s cubic-bezier(0.16,1,0.3,1) both ${i * 0.08}s`,
              }}
            />
          </div>
          <div className="px-3.5 py-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[11px] font-black text-white tracking-[0.08em] uppercase leading-tight">{item.cat}</p>
            <p className="text-[8px] text-white/30 tracking-[0.1em] uppercase mt-0.5 leading-tight truncate">{item.brand}</p>
          </div>
        </GlowCard>
      ))}
    </div>
  );
}

/* ── Slide 02: Outfit ──────────────────────────────────────────── */
function Slide02() {
  return (
    <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
      {/* Item list */}
      <div className="flex flex-col gap-2.5">
        <p className="text-[8px] tracking-[0.24em] uppercase text-white/20 mb-0.5">Selected items</p>
        {ITEMS.map((item, i) => (
          <GlowCard key={item.n} className="flex items-center gap-3 p-3 flex-1 min-h-0">
            <span className="text-[8px] font-mono text-white/20 shrink-0 w-4">{item.n}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.img}
              alt={item.cat}
              className="w-10 shrink-0 object-cover object-center"
              style={{
                height: "52px",
                borderRadius: "6px",
                animation: `imgReveal 0.6s cubic-bezier(0.16,1,0.3,1) both ${i * 0.07}s`,
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black text-white uppercase tracking-wide leading-tight">{item.cat}</p>
              <p className="text-[8px] text-white/30 uppercase tracking-[0.08em] mt-0.5 leading-tight truncate">{item.brand}</p>
            </div>
            <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-white/35">
                <path d="M4 1v6M1 4h6" />
              </svg>
            </div>
          </GlowCard>
        ))}
      </div>

      {/* Complete look */}
      <GlowCard className="flex flex-col">
        <div className="px-3.5 py-2.5 flex items-center gap-2 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-[8px] tracking-[0.2em] uppercase text-white/50 font-black">Complete Look</span>
          <span className="w-1.5 h-1.5 rounded-full bg-white/50"
            style={{ boxShadow: "0 0 6px rgba(255,255,255,0.6)" }} />
        </div>
        <div className="flex-1 relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cs/outfit.png"
            alt="Complete look"
            className="absolute inset-0 w-full h-full object-contain object-center"
            style={{ animation: "imgReveal 0.8s cubic-bezier(0.16,1,0.3,1) both 0.1s" }}
          />
        </div>
      </GlowCard>
    </div>
  );
}

/* ── Slide 03: Brands ──────────────────────────────────────────── */
function Slide03() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-end justify-between mb-4 shrink-0">
        <div>
          <p className="text-[8px] tracking-[0.24em] uppercase text-white/20 mb-1.5">Premium Brands</p>
          <p className="text-[18px] md:text-[22px] font-black text-white uppercase tracking-[-0.01em] leading-tight">
            50+ Premium Brands.<br />One Place.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 flex-1 content-start">
        {BRANDS.map((brand, i) => (
          <GlowCard
            key={brand}
            className="flex items-center justify-center p-3"
            style={{ aspectRatio: "4/3", animation: `fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both ${i * 0.04}s` }}
          >
            <span className="text-[8px] md:text-[9px] font-black tracking-[0.1em] text-white/50 text-center uppercase leading-tight">
              {brand}
            </span>
          </GlowCard>
        ))}
      </div>
    </div>
  );
}

/* ── Main carousel ─────────────────────────────────────────────── */
export default function FeatureCarousel({ onSlideChange }: { onSlideChange?: (idx: number) => void }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback((idx: number, resetTimer = true) => {
    setActive(idx);
    onSlideChange?.(idx);
    if (resetTimer) {
      setProgress(0);
    }
  }, [onSlideChange]);

  // Auto-play + progress bar
  useEffect(() => {
    const startTimers = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressRef.current) clearInterval(progressRef.current);

      setProgress(0);
      const step = 100 / (AUTOPLAY_MS / 50);

      progressRef.current = setInterval(() => {
        setProgress(p => Math.min(p + step, 100));
      }, 50);

      intervalRef.current = setInterval(() => {
        setActive(prev => {
          const next = (prev + 1) % SLIDES.length;
          onSlideChange?.(next);
          return next;
        });
        setProgress(0);
      }, AUTOPLAY_MS);
    };

    startTimers();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [onSlideChange]);

  const handleGo = (idx: number) => {
    go(idx);
    // restart timers by clearing + effect will NOT restart — do it manually
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(0);

    const step = 100 / (AUTOPLAY_MS / 50);
    progressRef.current = setInterval(() => {
      setProgress(p => Math.min(p + step, 100));
    }, 50);
    intervalRef.current = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % SLIDES.length;
        onSlideChange?.(next);
        return next;
      });
      setProgress(0);
    }, AUTOPLAY_MS);
  };

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes imgReveal {
          from { opacity: 0; transform: scale(1.04); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="h-full flex flex-col gap-4">
        {/* Slide content — keyed to re-animate on change */}
        <div
          key={active}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
          style={{ animation: "slideInRight 0.55s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {active === 0 && <Slide01 />}
          {active === 1 && <Slide02 />}
          {active === 2 && <Slide03 />}
        </div>

        {/* Email */}
        <div className="shrink-0">
          <EmailForm />
        </div>

        {/* Tab nav + progress */}
        <div className="shrink-0 flex items-center gap-0 pt-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {SLIDES.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => handleGo(i)}
              className="flex flex-col gap-2 pr-8 group"
            >
              {/* Progress bar */}
              <div className="h-px relative overflow-hidden" style={{ width: i === active ? 36 : 20, background: "rgba(255,255,255,0.1)", transition: "width 0.4s ease" }}>
                {i === active && (
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${progress}%`,
                      background: "rgba(255,255,255,0.7)",
                      boxShadow: "0 0 6px rgba(255,255,255,0.5)",
                      transition: "width 0.05s linear",
                    }}
                  />
                )}
              </div>
              <span
                className="text-[8px] tracking-[0.2em] uppercase font-medium transition-all duration-400"
                style={{
                  color: i === active ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.18)",
                  textShadow: i === active ? "0 0 12px rgba(255,255,255,0.3)" : "none",
                }}
              >
                {slide.id} / {slide.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
