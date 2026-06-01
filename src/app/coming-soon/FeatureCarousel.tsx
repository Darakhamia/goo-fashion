"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const SLIDES = [
  { id: "01", short: "ITEMS",         label: "AI STYLIST" },
  { id: "02", short: "OUTFIT",        label: "SMART WARDROBE" },
  { id: "03", short: "BRANDS",        label: "BEST PRICE" },
];

const BRANDS = [
  "AMIRI", "BALENCIAGA", "RICK OWENS", "CELINE",
  "SAINT LAURENT", "PRADA", "ACNE STUDIOS", "OFF-WHITE",
];

const ITEMS = [
  { n: "01", cat: "HOODIE",   brand: "ENFANTS RICHES DÉPRIMÉS", img: "/cs/hoodie.png" },
  { n: "02", cat: "JEANS",    brand: "STRIPE BAGGY DENIM",      img: "/cs/jeans.png" },
  { n: "03", cat: "SNEAKERS", brand: "BALENCIAGA",              img: "/cs/sneakers.png" },
];

const AUTOPLAY_MS = 4800;

/* ─────────────────────────────────────────────────────── */

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
    } catch { setState("error"); }
  };

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8 px-6 py-5 sm:px-8 sm:py-6"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        boxShadow: "0 0 40px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div className="shrink-0">
        <p className="text-[8px] tracking-[0.28em] uppercase text-white/30 mb-1.5">Be the first to know</p>
        <p className="text-[15px] sm:text-[17px] font-black text-white uppercase tracking-tight leading-tight">
          Get notified when<br className="hidden sm:block" /> we launch.
        </p>
      </div>
      <form onSubmit={submit} className="flex-1 flex items-center"
        style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, background: "rgba(0,0,0,0.5)", overflow: "hidden" }}>
        {state === "done" ? (
          <p className="flex-1 px-5 py-3.5 text-[11px] text-white/45 tracking-[0.14em] uppercase">You&apos;re on the list ✓</p>
        ) : (
          <>
            <input
              type="email" value={email} onChange={(e: { target: { value: string } }) => setEmail(e.target.value)}
              placeholder="ENTER YOUR EMAIL" required
              className="flex-1 bg-transparent px-5 py-3.5 text-[11px] text-white placeholder:text-white/20 tracking-[0.1em] outline-none"
            />
            <button type="submit" disabled={state === "loading"}
              className="px-5 py-3.5 text-white/40 hover:text-white transition-colors disabled:opacity-30 shrink-0">
              {state === "loading" ? (
                <svg width="14" height="14" viewBox="0 0 14 14" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="7" cy="7" r="5" strokeOpacity="0.2"/><path d="M7 2a5 5 0 0 1 5 5" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 8h12M9 3.5l5 4.5-5 4.5"/>
                </svg>
              )}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

/* ── Slide 01: Items ───────────────────────────────────── */
function Slide01() {
  return (
    <div className="flex-1 grid grid-cols-3 gap-3 min-h-0">
      {ITEMS.map((item, i) => (
        <div
          key={item.n}
          className="flex flex-col overflow-hidden"
          style={{
            borderRadius: 18,
            background: "rgba(255,255,255,0.028)",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 0 0 0 transparent",
            transition: "box-shadow 0.4s ease, border-color 0.4s ease",
            animation: `cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) both ${i * 0.1}s`,
          }}
          onMouseEnter={(e: { currentTarget: HTMLDivElement }) => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.boxShadow = "0 0 35px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.1)";
            el.style.borderColor = "rgba(255,255,255,0.16)";
          }}
          onMouseLeave={(e: { currentTarget: HTMLDivElement }) => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.boxShadow = "0 0 0 0 transparent";
            el.style.borderColor = "rgba(255,255,255,0.09)";
          }}
        >
          <div className="relative flex-1 min-h-0 overflow-hidden">
            <span className="absolute top-3.5 left-3.5 z-10 text-[9px] tracking-[0.18em] text-white/35 font-mono"
              style={{ textShadow: "0 0 10px rgba(255,255,255,0.5)" }}>
              {item.n}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.img} alt={item.cat}
              className="w-full h-full object-cover object-center"
              style={{ animation: `imgReveal 0.8s cubic-bezier(0.16,1,0.3,1) both ${0.1 + i * 0.08}s` }}
            />
          </div>
          <div className="px-4 py-3.5 shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[12px] font-black text-white tracking-[0.08em] uppercase leading-tight">{item.cat}</p>
            <p className="text-[9px] text-white/35 tracking-[0.1em] uppercase mt-1 leading-tight truncate">{item.brand}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Slide 02: Outfit ──────────────────────────────────── */
function Slide02() {
  return (
    <div className="flex-1 grid grid-cols-[1fr_1.1fr] gap-3 min-h-0">
      {/* Left: item list */}
      <div className="flex flex-col gap-2 min-h-0">
        {ITEMS.map((item, i) => (
          <div
            key={item.n}
            className="flex-1 min-h-0 overflow-hidden relative"
            style={{
              borderRadius: 16,
              background: "#080808",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
              animation: `cardReveal 0.55s cubic-bezier(0.16,1,0.3,1) both ${i * 0.1}s`,
            }}
          >
            <span className="absolute top-3 left-3.5 z-10 text-[8px] font-mono text-white/25">{item.n}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.img}
              alt={item.cat}
              className="w-full object-contain object-center"
              style={{
                height: "calc(100% - 44px)",
                animation: `imgReveal 0.6s cubic-bezier(0.16,1,0.3,1) both ${0.05 + i * 0.08}s`,
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 px-3.5 py-2.5"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[11px] font-black text-white uppercase tracking-[0.07em] leading-tight">{item.cat}</p>
              <p className="text-[8px] text-white/30 uppercase tracking-[0.08em] mt-0.5 leading-tight truncate">{item.brand}</p>
            </div>
            <div className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center shrink-0"
              style={{ borderRadius: "50%", border: "1px solid rgba(255,255,255,0.18)" }}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="text-white/38">
                <path d="M4.5 1.5v6M1.5 4.5h6"/>
              </svg>
            </div>
          </div>
        ))}
      </div>

      {/* Right: complete look */}
      <div
        className="flex flex-col overflow-hidden"
        style={{
          borderRadius: 18,
          background: "#080808",
          border: "1px solid rgba(255,255,255,0.09)",
          animation: "cardReveal 0.65s cubic-bezier(0.16,1,0.3,1) both 0.15s",
        }}
      >
        <div className="px-4 py-2.5 flex items-center gap-2 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-[9px] tracking-[0.2em] uppercase text-white/50 font-black">Complete Look</span>
          <span className="w-1.5 h-1.5 rounded-full bg-white/55"
            style={{ boxShadow: "0 0 7px 1px rgba(255,255,255,0.65)", animation: "dotPulse 2.4s ease-in-out infinite" }}/>
        </div>
        <div className="flex-1 relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cs/outfit.png" alt="Complete look"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: "center top", animation: "imgReveal 0.9s cubic-bezier(0.16,1,0.3,1) both 0.2s" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Slide 03: Brands ──────────────────────────────────── */
function Slide03() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-end justify-between mb-5 shrink-0">
        <div>
          <p className="text-[8px] tracking-[0.26em] uppercase text-white/25 mb-2">Premium Brands</p>
          <p className="text-[20px] md:text-[24px] font-black text-white uppercase tracking-[-0.01em] leading-[1.05]">
            50+ Premium Brands.<br />One Place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 flex items-center justify-center text-white/30 hover:text-white transition-colors"
            style={{ borderRadius: "50%", border: "1px solid rgba(255,255,255,0.14)" }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.5 2L3.5 5l3 3"/>
            </svg>
          </button>
          <button className="w-8 h-8 flex items-center justify-center text-white hover:opacity-70 transition-opacity"
            style={{ borderRadius: "50%", border: "1px solid rgba(255,255,255,0.5)" }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 2l3 3-3 3"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2.5 content-start">
        {BRANDS.map((brand, i) => (
          <div
            key={brand}
            className="flex items-center justify-center px-2 py-5 transition-all duration-400"
            style={{
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
              aspectRatio: "1.15",
              animation: `cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) both ${i * 0.05}s`,
            }}
            onMouseEnter={(e: { currentTarget: HTMLDivElement }) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.background = "rgba(255,255,255,0.055)";
              el.style.borderColor = "rgba(255,255,255,0.18)";
              el.style.boxShadow = "0 0 30px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1)";
            }}
            onMouseLeave={(e: { currentTarget: HTMLDivElement }) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.background = "rgba(255,255,255,0.03)";
              el.style.borderColor = "rgba(255,255,255,0.09)";
              el.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.05)";
            }}
          >
            <span className="text-[9px] md:text-[10px] font-black tracking-[0.1em] text-white/55 text-center uppercase leading-tight">
              {brand}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SLIDE_COMPONENTS = [Slide01, Slide02, Slide03];

/* ── Animated slide wrapper ────────────────────────────── */
function SlideTransition({ active, prev }: { active: number; prev: number | null }) {
  const [exiting, setExiting] = useState<number | null>(null);
  const [entering, setEntering] = useState<number>(active);
  const [phase, setPhase] = useState<"idle" | "animating">("idle");

  useEffect(() => {
    if (prev === null || prev === active) {
      setEntering(active);
      return;
    }
    setExiting(prev);
    setEntering(active);
    setPhase("animating");
    const t = setTimeout(() => {
      setExiting(null);
      setPhase("idle");
    }, 520);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const ExitingComponent = exiting !== null ? SLIDE_COMPONENTS[exiting] : null;
  const EnteringComponent = SLIDE_COMPONENTS[entering];

  return (
    <div className="absolute inset-0 flex flex-col min-h-0 overflow-hidden">
      {/* Exiting slide — slides out to the left */}
      {ExitingComponent && phase === "animating" && (
        <div
          key={`exit-${exiting}`}
          className="absolute inset-0 flex flex-col min-h-0"
          style={{ animation: "slideOutLeft 0.52s cubic-bezier(0.4,0,0.2,1) both" }}
        >
          <ExitingComponent />
        </div>
      )}
      {/* Entering slide — slides in from the right */}
      <div
        key={`enter-${entering}`}
        className="absolute inset-0 flex flex-col min-h-0"
        style={{
          animation: phase === "animating"
            ? "slideInRight 0.52s cubic-bezier(0.16,1,0.3,1) both"
            : undefined,
        }}
      >
        <EnteringComponent />
      </div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────── */
export default function FeatureCarousel({ onSlideChange }: { onSlideChange?: (idx: number) => void }) {
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (progRef.current)  clearInterval(progRef.current);
    setProgress(0);
    const step = 100 / (AUTOPLAY_MS / 50);
    progRef.current = setInterval(() => setProgress(p => Math.min(p + step, 100)), 50);
    timerRef.current = setInterval(() => {
      setActive(curr => {
        const next = (curr + 1) % SLIDES.length;
        setPrev(curr);
        onSlideChange?.(next);
        return next;
      });
      setProgress(0);
    }, AUTOPLAY_MS);
  }, [onSlideChange]);

  useEffect(() => {
    startTimers();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progRef.current)  clearInterval(progRef.current);
    };
  }, [startTimers]);

  const goTo = (idx: number) => {
    if (idx === active) return;
    setPrev(active);
    setActive(idx);
    onSlideChange?.(idx);
    startTimers();
  };

  return (
    <>
      <style>{`
        @keyframes cardReveal {
          from { opacity:0; transform:translateY(14px) scale(0.98); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
        @keyframes imgReveal {
          from { opacity:0; transform:scale(1.06); }
          to   { opacity:1; transform:scale(1);    }
        }
        @keyframes slideInRight {
          from { opacity:0; transform:translateX(48px) scale(0.98); }
          to   { opacity:1; transform:translateX(0)    scale(1);    }
        }
        @keyframes slideOutLeft {
          from { opacity:1; transform:translateX(0)     scale(1);    }
          to   { opacity:0; transform:translateX(-48px) scale(0.98); }
        }
        @keyframes dotPulse {
          0%,100% { opacity:0.4; transform:scale(1);   }
          50%      { opacity:1;  transform:scale(1.5); }
        }
      `}</style>

      <div className="h-full flex flex-col gap-4">

        {/* ── Top tab nav ── */}
        <div className="flex items-center gap-0 shrink-0 pb-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {SLIDES.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => goTo(i)}
              className="relative flex items-center gap-2 pb-3 pr-8 transition-all duration-300"
            >
              <span
                className="text-[10px] tracking-[0.14em] uppercase transition-all duration-300"
                style={{
                  color: i === active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.22)",
                  fontWeight: i === active ? 700 : 400,
                  textShadow: i === active ? "0 0 14px rgba(255,255,255,0.3)" : "none",
                }}
              >
                {slide.id} / {slide.short}
              </span>
              {/* Active underline with progress */}
              {i === active && (
                <span className="absolute bottom-0 left-0 h-[1.5px]"
                  style={{
                    width: `${progress}%`,
                    background: "rgba(255,255,255,0.8)",
                    boxShadow: "0 0 8px rgba(255,255,255,0.5)",
                    transition: "width 0.05s linear",
                  }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ── Slide content — 3-D perspective tilt ── */}
        <div
          className="flex-1 min-h-0 relative"
          style={{
            perspective: "900px",
            maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: "rotateX(16deg) skewX(1.2deg)",
              transformOrigin: "top center",
              transformStyle: "preserve-3d",
            }}
          >
            <SlideTransition active={active} prev={prev} />
          </div>
        </div>

        {/* ── Email form ── */}
        <div className="shrink-0">
          <EmailForm />
        </div>

        {/* ── Bottom nav ── */}
        <div className="shrink-0 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
          <div className="flex items-center gap-0">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => goTo(i)}
                className="flex items-center gap-2.5 group"
              >
                {i > 0 && (
                  <span className="text-[8px] text-white/18 tracking-widest mx-1">—</span>
                )}
                {i === 0 && (
                  <span className="text-[8px] text-white/18 tracking-widest mr-1">—</span>
                )}
                <span
                  className="text-[8px] tracking-[0.18em] uppercase transition-all duration-300"
                  style={{
                    color: i === active ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.2)",
                    fontWeight: i === active ? 700 : 400,
                    textShadow: i === active ? "0 0 10px rgba(255,255,255,0.25)" : "none",
                  }}
                >
                  {slide.label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[8px] tracking-[0.14em] uppercase text-white/15">
            AI · Fashion · Personal Style
          </p>
        </div>
      </div>
    </>
  );
}
