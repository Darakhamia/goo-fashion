"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const SLIDES = [
  { id: "01", short: "ITEMS",  label: "AI STYLIST"      },
  { id: "02", short: "OUTFIT", label: "SMART WARDROBE"  },
  { id: "03", short: "BRANDS", label: "BEST PRICE"      },
];

const AUTOPLAY_MS = 4800;

/* ── product data ────────────────────────────────────────── */
const S1_CARDS = [
  { n:"01", cat:"HOODIE",   brand:"ENFANTS RICHES DÉPRIMÉS", price:"$465", img:"/cs/hoodie.png"   },
  { n:"02", cat:"JEANS",    brand:"ADIDAS ORIGINALS",         price:"$190", img:"/cs/jeans.png"    },
  { n:"03", cat:"SNEAKERS", brand:"BALENCIAGA",               price:"$890", img:"/cs/sneakers.png" },
];
const S2_CARDS = [
  { n:"01", cat:"LOOK",     brand:"COMPLETE OUTFIT",          price:"",     img:"/cs/outfit.png"   },
  { n:"02", cat:"HOODIE",   brand:"ENFANTS RICHES DÉPRIMÉS",  price:"$465", img:"/cs/hoodie.png"   },
  { n:"03", cat:"JEANS",    brand:"STRIPE BAGGY DENIM",       price:"$190", img:"/cs/jeans.png"    },
];
const S3_BRANDS = [
  "AMIRI","BALENCIAGA","RICK OWENS","CELINE",
  "SAINT LAURENT","PRADA","ACNE STUDIOS","OFF-WHITE",
  "BOTTEGA VENETA","LOEWE","MONCLER","GIVENCHY",
];

/* ── card surface style (shared) ───────────────────────────── */
const CARD_BG: React.CSSProperties = {
  width:"100%", height:"100%", position:"relative",
  borderRadius:13, overflow:"hidden",
  background:"rgba(9,9,9,0.97)",
  border:"1px solid rgba(255,255,255,0.08)",
  boxShadow:"inset 0 1px 0 rgba(255,255,255,0.055), 0 0 0 0.5px rgba(255,255,255,0.03)",
};

/* ── EmailForm ───────────────────────────────────────────── */
function EmailForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle"|"loading"|"done"|"error">("idle");

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (state === "loading" || state === "done") return;
    setState("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "done" : "error");
    } catch { setState("error"); }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8 px-6 py-5 sm:px-8 sm:py-6"
      style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:14, boxShadow:"0 0 40px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.06)" }}>
      <div className="shrink-0">
        <p className="text-[8px] tracking-[0.28em] uppercase text-white/30 mb-1.5">Be the first to know</p>
        <p className="text-[15px] sm:text-[17px] font-black text-white uppercase tracking-tight leading-tight">
          Get notified when<br className="hidden sm:block"/> we launch.
        </p>
      </div>
      <form onSubmit={submit} className="flex-1 flex items-center"
        style={{ border:"1px solid rgba(255,255,255,0.12)", borderRadius:10,
          background:"rgba(0,0,0,0.5)", overflow:"hidden" }}>
        {state === "done" ? (
          <p className="flex-1 px-5 py-3.5 text-[11px] text-white/45 tracking-[0.14em] uppercase">You&apos;re on the list ✓</p>
        ) : (
          <>
            <input type="email" value={email}
              onChange={(e:{target:{value:string}}) => setEmail(e.target.value)}
              placeholder="ENTER YOUR EMAIL" required
              className="flex-1 bg-transparent px-5 py-3.5 text-[11px] text-white placeholder:text-white/20 tracking-[0.1em] outline-none"/>
            <button type="submit" disabled={state==="loading"}
              className="px-5 py-3.5 text-white/40 hover:text-white transition-colors disabled:opacity-30 shrink-0">
              {state==="loading"
                ? <svg width="14" height="14" viewBox="0 0 14 14" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5" strokeOpacity="0.2"/><path d="M7 2a5 5 0 0 1 5 5" strokeLinecap="round"/></svg>
                : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8h12M9 3.5l5 4.5-5 4.5"/></svg>
              }
            </button>
          </>
        )}
      </form>
    </div>
  );
}

/* ── Product card ─────────────────────────────────────────── */
interface PCard { n:string; cat:string; brand:string; price:string; img:string }
interface PCardProps extends PCard {
  outerStyle: React.CSSProperties;
  driftIdx: 0|1|2;
  driftDelay: number;
  revealDelay: number;
}

function ProductCard({ n, cat, brand, price, img, outerStyle, driftIdx, driftDelay, revealDelay }: PCardProps) {
  return (
    <div style={{ position:"absolute", ...outerStyle,
      animation:`cReveal 0.55s cubic-bezier(0.16,1,0.3,1) both ${revealDelay}s` }}>
      {/* drift wrapper — translateY only, never conflicts with outer rotateZ */}
      <div style={{ width:"100%", height:"100%",
        animation:`gDrift${driftIdx} ${7+driftIdx*1.5}s ${driftDelay}s ease-in-out infinite` }}>
        <div style={CARD_BG}>

          {/* glass sheen */}
          <div aria-hidden style={{ position:"absolute", inset:0, zIndex:5, pointerEvents:"none",
            background:"linear-gradient(140deg,rgba(255,255,255,0.025) 0%,transparent 40%)" }}/>
          {/* top edge highlight */}
          <div aria-hidden style={{ position:"absolute", top:0, left:"18%", right:"18%",
            height:1, zIndex:6, pointerEvents:"none",
            background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.13),transparent)" }}/>

          {/* index badge */}
          <div style={{ position:"absolute", top:11, left:12, zIndex:10,
            display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ fontSize:7, fontFamily:"monospace", color:"rgba(255,255,255,0.22)", letterSpacing:"0.22em" }}>{n}</span>
            <div style={{ width:10, height:1, background:"rgba(255,255,255,0.12)" }}/>
            <span style={{ fontSize:7, fontWeight:800, color:"rgba(255,255,255,0.28)", letterSpacing:"0.22em", textTransform:"uppercase" }}>{cat}</span>
          </div>

          {/* price badge */}
          {price && (
            <div style={{ position:"absolute", top:11, right:12, zIndex:10 }}>
              <span style={{ fontSize:8, fontWeight:700, color:"rgba(255,255,255,0.45)", letterSpacing:"0.06em" }}>{price}</span>
            </div>
          )}

          {/* product image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt={cat} style={{
            position:"absolute", top:28, bottom:44, left:0, right:0,
            width:"100%", height:"calc(100% - 72px)",
            objectFit:"contain", objectPosition:"center",
            filter:"grayscale(1) contrast(1.12)",
            padding:"8px 14px",
          }}/>

          {/* bottom info */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"10px 12px",
            borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize:10, fontWeight:900, color:"rgba(255,255,255,0.82)", letterSpacing:"0.07em", textTransform:"uppercase", lineHeight:1.2 }}>{cat}</p>
            <p style={{ fontSize:7, color:"rgba(255,255,255,0.28)", letterSpacing:"0.1em", textTransform:"uppercase", marginTop:3 }}>{brand}</p>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── Slide 01: ITEMS ─────────────────────────────────────── */
function Slide01() {
  const layout: PCardProps[] = [
    { ...S1_CARDS[0], outerStyle:{ left:"2%",  top:"4%",  width:"35%", height:"84%", zIndex:3, transform:"rotateZ(-1.5deg)" }, driftIdx:0, driftDelay:0,   revealDelay:0   },
    { ...S1_CARDS[1], outerStyle:{ left:"26%", top:"0%",  width:"35%", height:"79%", zIndex:2, transform:"rotateZ(-0.5deg)" }, driftIdx:1, driftDelay:1.4, revealDelay:0.1 },
    { ...S1_CARDS[2], outerStyle:{ right:"-2%",top:"3%",  width:"35%", height:"76%", zIndex:1, transform:"rotateZ(0.5deg)"  }, driftIdx:2, driftDelay:0.7, revealDelay:0.2 },
  ];
  return (
    <div style={{ position:"relative", width:"100%", height:"100%" }}>
      {layout.map(p => <ProductCard key={p.n} {...p} />)}
    </div>
  );
}

/* ── Slide 02: OUTFIT ─────────────────────────────────────── */
function Slide02() {
  const layout: PCardProps[] = [
    { ...S2_CARDS[0], outerStyle:{ left:"2%",  top:"2%",  width:"37%", height:"88%", zIndex:3, transform:"rotateZ(-1deg)"  }, driftIdx:0, driftDelay:0.3, revealDelay:0   },
    { ...S2_CARDS[1], outerStyle:{ left:"28%", top:"6%",  width:"34%", height:"76%", zIndex:2, transform:"rotateZ(-0.3deg)"}, driftIdx:1, driftDelay:1.1, revealDelay:0.1 },
    { ...S2_CARDS[2], outerStyle:{ right:"-1%",top:"4%",  width:"34%", height:"78%", zIndex:1, transform:"rotateZ(0.8deg)" }, driftIdx:2, driftDelay:0.5, revealDelay:0.2 },
  ];
  return (
    <div style={{ position:"relative", width:"100%", height:"100%" }}>
      {layout.map(p => <ProductCard key={p.n} {...p} />)}
      {/* "Complete Look" watermark on card 1 */}
      <div style={{ position:"absolute", top:"12%", left:"3%", zIndex:10, pointerEvents:"none" }}>
        <span style={{ fontSize:7, fontWeight:700, color:"rgba(255,255,255,0.18)", letterSpacing:"0.24em", textTransform:"uppercase" }}>
          COMPLETE LOOK
        </span>
        <span style={{ display:"inline-block", marginLeft:6, width:5, height:5,
          borderRadius:"50%", background:"rgba(255,255,255,0.5)",
          boxShadow:"0 0 6px 1px rgba(255,255,255,0.6)",
          verticalAlign:"middle" }}/>
      </div>
    </div>
  );
}

/* ── Slide 03: BRANDS ─────────────────────────────────────── */
function Slide03() {
  const COLS = [
    S3_BRANDS.slice(0, 4),
    S3_BRANDS.slice(4, 8),
    S3_BRANDS.slice(8, 12),
  ];
  const positions: React.CSSProperties[] = [
    { left:"2%",  top:"4%",  width:"33%", height:"84%", zIndex:3, transform:"rotateZ(-1.2deg)" },
    { left:"26%", top:"0%",  width:"33%", height:"79%", zIndex:2, transform:"rotateZ(-0.4deg)" },
    { right:"-2%",top:"3%",  width:"33%", height:"76%", zIndex:1, transform:"rotateZ(0.6deg)"  },
  ];
  const drifts: Array<0|1|2> = [0, 1, 2];

  return (
    <div style={{ position:"relative", width:"100%", height:"100%" }}>
      {COLS.map((brands, ci) => (
        <div key={ci} style={{ position:"absolute", ...positions[ci],
          animation:`cReveal 0.55s cubic-bezier(0.16,1,0.3,1) both ${ci*0.1}s` }}>
          <div style={{ width:"100%", height:"100%",
            animation:`gDrift${drifts[ci]} ${7+ci*1.5}s ${ci*0.7}s ease-in-out infinite` }}>
            <div style={CARD_BG}>
              {/* glass sheen */}
              <div aria-hidden style={{ position:"absolute", inset:0, zIndex:5, pointerEvents:"none",
                background:"linear-gradient(140deg,rgba(255,255,255,0.025) 0%,transparent 40%)" }}/>
              <div aria-hidden style={{ position:"absolute", top:0, left:"18%", right:"18%",
                height:1, zIndex:6, pointerEvents:"none",
                background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.13),transparent)" }}/>

              {/* header */}
              <div style={{ position:"absolute", top:11, left:12, zIndex:10,
                display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontSize:7, fontFamily:"monospace", color:"rgba(255,255,255,0.22)", letterSpacing:"0.22em" }}>0{ci+1}</span>
                <div style={{ width:10, height:1, background:"rgba(255,255,255,0.12)" }}/>
                <span style={{ fontSize:7, fontWeight:800, color:"rgba(255,255,255,0.28)", letterSpacing:"0.22em", textTransform:"uppercase" }}>BRANDS</span>
              </div>

              {/* brand list */}
              <div style={{ position:"absolute", top:32, bottom:0, left:0, right:0,
                display:"flex", flexDirection:"column", justifyContent:"space-evenly",
                padding:"8px 12px" }}>
                {brands.map((b, bi) => (
                  <div key={b} style={{ padding:"8px 0",
                    borderBottom: bi < brands.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <span style={{ fontSize:9, fontWeight:900, color:`rgba(255,255,255,${0.7-ci*0.12-bi*0.05})`,
                      letterSpacing:"0.1em", textTransform:"uppercase" }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Slide transition (enter from right / exit to left) ─── */
const SLIDE_COMPONENTS = [Slide01, Slide02, Slide03];

function SlideTransition({ active, prev }: { active:number; prev:number|null }) {
  const [exiting,  setExiting]  = useState<number|null>(null);
  const [entering, setEntering] = useState<number>(active);
  const [phase,    setPhase]    = useState<"idle"|"animating">("idle");

  useEffect(() => {
    if (prev === null || prev === active) { setEntering(active); return; }
    setExiting(prev); setEntering(active); setPhase("animating");
    const t = setTimeout(() => { setExiting(null); setPhase("idle"); }, 540);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const Exit  = exiting  !== null ? SLIDE_COMPONENTS[exiting]  : null;
  const Enter = SLIDE_COMPONENTS[entering];

  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden" }}>
      {Exit && phase === "animating" && (
        <div key={`exit-${exiting}`} style={{ position:"absolute", inset:0,
          animation:"sOutLeft 0.54s cubic-bezier(0.4,0,0.2,1) both" }}>
          <Exit />
        </div>
      )}
      <div key={`enter-${entering}`} style={{ position:"absolute", inset:0,
        animation: phase==="animating" ? "sInRight 0.54s cubic-bezier(0.16,1,0.3,1) both" : undefined }}>
        <Enter />
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────── */
export default function FeatureCarousel({ onSlideChange }: { onSlideChange?: (idx:number) => void }) {
  const [active,   setActive]   = useState(0);
  const [prev,     setPrev]     = useState<number|null>(null);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const progRef  = useRef<ReturnType<typeof setInterval>|null>(null);

  const startTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (progRef.current)  clearInterval(progRef.current);
    setProgress(0);
    const step = 100 / (AUTOPLAY_MS / 50);
    progRef.current  = setInterval(() => setProgress(p => Math.min(p+step, 100)), 50);
    timerRef.current = setInterval(() => {
      setActive(curr => {
        const next = (curr+1) % SLIDES.length;
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
    setPrev(active); setActive(idx);
    onSlideChange?.(idx); startTimers();
  };

  return (
    <>
      <style>{`
        @keyframes gDrift0 { 0%,100%{transform:translateY(0px)}   50%{transform:translateY(-7px)}  }
        @keyframes gDrift1 { 0%,100%{transform:translateY(-4px)}  50%{transform:translateY(6px)}   }
        @keyframes gDrift2 { 0%,100%{transform:translateY(3px)}   50%{transform:translateY(-8px)}  }
        @keyframes cReveal { from{opacity:0;transform:translateY(12px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes sInRight { from{opacity:0;transform:translateX(44px) scale(0.98)} to{opacity:1;transform:translateX(0) scale(1)} }
        @keyframes sOutLeft { from{opacity:1;transform:translateX(0) scale(1)} to{opacity:0;transform:translateX(-44px) scale(0.98)} }
        @keyframes dotPulse { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.5)} }
      `}</style>

      <div className="h-full flex flex-col" style={{ gap:12 }}>

        {/* ── Tab nav + progress ── */}
        <div className="flex items-center shrink-0"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          {SLIDES.map((s, i) => (
            <button key={s.id} onClick={() => goTo(i)}
              className="relative flex items-center gap-2 pb-3 pr-8 transition-all duration-300">
              <span className="text-[10px] tracking-[0.14em] uppercase transition-all duration-300"
                style={{
                  color: i===active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.22)",
                  fontWeight: i===active ? 700 : 400,
                  textShadow: i===active ? "0 0 14px rgba(255,255,255,0.3)" : "none",
                }}>
                {s.id} / {s.short}
              </span>
              {i===active && (
                <span className="absolute bottom-0 left-0 h-[1.5px]"
                  style={{ width:`${progress}%`, background:"rgba(255,255,255,0.8)",
                    boxShadow:"0 0 8px rgba(255,255,255,0.5)", transition:"width 0.05s linear" }}/>
              )}
            </button>
          ))}
        </div>

        {/* ── 3-D composition ── */}
        <div className="flex-1 min-h-0 relative overflow-hidden"
          style={{ perspective:"1100px" }}>

          {/* edge vignettes */}
          <div aria-hidden style={{ position:"absolute", inset:0, zIndex:30, pointerEvents:"none",
            background:"linear-gradient(to right,#080808 0%,transparent 12%,transparent 72%,#080808 100%)" }}/>
          <div aria-hidden style={{ position:"absolute", inset:0, zIndex:30, pointerEvents:"none",
            background:"linear-gradient(to bottom,#080808 0%,transparent 8%,transparent 62%,#080808 100%)" }}/>

          {/* scene — subtle flat 3-D tilt, NO preserve-3d to avoid card blowout */}
          <div style={{ position:"absolute", inset:0,
            transform:"rotateX(3deg) rotateY(-9deg)",
            transformOrigin:"center 40%" }}>
            <SlideTransition active={active} prev={prev} />
          </div>
        </div>

        {/* ── Email form ── */}
        <div className="shrink-0"><EmailForm /></div>

        {/* ── Bottom nav ── */}
        <div className="shrink-0 flex items-center justify-between"
          style={{ borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:12 }}>
          <div className="flex items-center gap-0">
            {SLIDES.map((s, i) => (
              <button key={s.id} onClick={() => goTo(i)} className="flex items-center gap-2.5">
                {i>0 && <span className="text-[8px] text-white/18 tracking-widest mx-1">—</span>}
                {i===0 && <span className="text-[8px] text-white/18 tracking-widest mr-1">—</span>}
                <span className="text-[8px] tracking-[0.18em] uppercase transition-all duration-300"
                  style={{ color: i===active ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.2)",
                    fontWeight: i===active ? 700 : 400,
                    textShadow: i===active ? "0 0 10px rgba(255,255,255,0.25)" : "none" }}>
                  {s.label}
                </span>
              </button>
            ))}
          </div>
          <p style={{ fontSize:7, color:"rgba(255,255,255,0.12)", letterSpacing:"0.14em", textTransform:"uppercase" }}>
            AI · FASHION · STYLE
          </p>
        </div>

      </div>
    </>
  );
}
