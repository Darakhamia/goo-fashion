"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const SLIDES = [
  { id: "01", short: "ITEMS",  label: "AI STYLIST"     },
  { id: "02", short: "OUTFIT", label: "SMART WARDROBE" },
  { id: "03", short: "BRANDS", label: "BEST PRICE"     },
];
const AUTOPLAY_MS = 4800;

const ITEMS = [
  { n:"01", cat:"HOODIE",   brand:"ENFANTS RICHES DÉPRIMÉS", price:"$465", img:"/cs/hoodie.png"   },
  { n:"02", cat:"JEANS",    brand:"STRIPE BAGGY DENIM",      price:"$190", img:"/cs/jeans.png"    },
  { n:"03", cat:"SNEAKERS", brand:"BALENCIAGA",               price:"$890", img:"/cs/sneakers.png" },
];
const BRANDS = [
  { name:"LV",           top:"16%", left:"12%", size:66, hasBox:true,  textSize:20, bold:true  },
  { name:"BALENCIAGA",   top:"10%", left:"31%", size:54, hasBox:true,  textSize:7,  bold:true  },
  { name:"NIKE",         top:"9%",  left:"55%", size:58, hasBox:true,  textSize:10, bold:false },
  { name:"PRADA",        top:"12%", left:"72%", size:0,  hasBox:false, textSize:14, bold:true  },
  { name:"SAINT LAURENT",top:"23%", left:"88%", size:0,  hasBox:false, textSize:8,  bold:false },
  { name:"DIOR",         top:"38%", left:"19%", size:56, hasBox:true,  textSize:14, bold:true  },
  { name:"CELINE",       top:"34%", left:"78%", size:0,  hasBox:false, textSize:11, bold:false },
  { name:"STONE ISLAND", top:"47%", left:"93%", size:52, hasBox:true,  textSize:7,  bold:false },
  { name:"MONCLER",      top:"55%", left:"7%",  size:62, hasBox:true,  textSize:7,  bold:false },
  { name:"AMIRI",        top:"69%", left:"19%", size:54, hasBox:true,  textSize:12, bold:true  },
  { name:"BURBERRY",     top:"67%", left:"86%", size:0,  hasBox:false, textSize:12, bold:false },
  { name:"FEAR OF GOD",  top:"86%", left:"11%", size:0,  hasBox:false, textSize:8,  bold:false },
  { name:"OFF-WHITE",    top:"87%", left:"31%", size:54, hasBox:true,  textSize:8,  bold:true  },
  { name:"RHUDE",        top:"92%", left:"55%", size:54, hasBox:true,  textSize:11, bold:false },
  { name:"ACNE STUDIOS", top:"90%", left:"73%", size:0,  hasBox:false, textSize:8,  bold:false },
  { name:"A.P.C.",       top:"85%", left:"84%", size:0,  hasBox:false, textSize:14, bold:true  },
];

/* ── shared card surface style ──────────────────────────── */
const CS: React.CSSProperties = {
  width:"100%", height:"100%", position:"relative",
  borderRadius:13, overflow:"hidden",
  background:"rgba(9,9,9,0.97)",
  border:"1px solid rgba(255,255,255,0.08)",
  boxShadow:"inset 0 1px 0 rgba(255,255,255,0.055), 0 0 0 0.5px rgba(255,255,255,0.03)",
};

/* ── decorative overlays (glass sheen + top edge) ────────── */
function CardGlass() {
  return (
    <>
      <div aria-hidden style={{ position:"absolute", inset:0, zIndex:5, pointerEvents:"none",
        background:"linear-gradient(140deg,rgba(255,255,255,0.025) 0%,transparent 40%)" }}/>
      <div aria-hidden style={{ position:"absolute", top:0, left:"18%", right:"18%",
        height:1, zIndex:6, pointerEvents:"none",
        background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.13),transparent)" }}/>
    </>
  );
}

/* ── EmailForm ───────────────────────────────────────────── */
function EmailForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle"|"loading"|"done"|"error">("idle");

  const submit = async (e:{preventDefault:()=>void}) => {
    e.preventDefault();
    if (state==="loading"||state==="done") return;
    setState("loading");
    try {
      const res = await fetch("/api/waitlist",{method:"POST",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
      setState(res.ok?"done":"error");
    } catch { setState("error"); }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8 px-6 py-5 sm:px-8 sm:py-6"
      style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:14, boxShadow:"0 0 40px rgba(255,255,255,0.02),inset 0 1px 0 rgba(255,255,255,0.06)" }}>
      <div className="shrink-0">
        <p className="text-[8px] tracking-[0.28em] uppercase text-white/30 mb-1.5">Be the first to know</p>
        <p className="text-[15px] sm:text-[17px] font-black text-white uppercase tracking-tight leading-tight">
          Get notified when<br className="hidden sm:block"/> we launch.
        </p>
      </div>
      <form onSubmit={submit} className="flex-1 flex items-center"
        style={{border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(0,0,0,0.5)",overflow:"hidden"}}>
        {state==="done"
          ? <p className="flex-1 px-5 py-3.5 text-[11px] text-white/45 tracking-[0.14em] uppercase">You&apos;re on the list ✓</p>
          : <>
              <input type="email" value={email}
                onChange={(e:{target:{value:string}})=>setEmail(e.target.value)}
                placeholder="ENTER YOUR EMAIL" required
                className="flex-1 bg-transparent px-5 py-3.5 text-[11px] text-white placeholder:text-white/20 tracking-[0.1em] outline-none"/>
              <button type="submit" disabled={state==="loading"}
                className="px-5 py-3.5 text-white/40 hover:text-white transition-colors disabled:opacity-30 shrink-0">
                {state==="loading"
                  ? <svg width="14" height="14" viewBox="0 0 14 14" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5" strokeOpacity="0.2"/><path d="M7 2a5 5 0 0 1 5 5" strokeLinecap="round"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8h12M9 3.5l5 4.5-5 4.5"/></svg>}
              </button>
            </>}
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SLIDE 01 — three equal portrait cards in a row
   Cards are in a CSS grid so they NEVER overlap.
   rotateZ is applied to each card's inner wrapper only.
   ═══════════════════════════════════════════════════════════ */
function Slide01() {
  const ROT  = [-1.6, -0.4, 0.7] as const;

  return (
    <div style={{ height:"100%", display:"grid",
      gridTemplateColumns:"repeat(3,1fr)", gap:8,
      padding:"2px 0 4px", overflow:"visible" }}>
      {ITEMS.map((item, i) => (
        /* grid cell — overflow:visible so rotateZ corners don't clip */
        <div key={item.n} style={{ overflow:"visible",
          animation:`cReveal 0.7s cubic-bezier(0.16,1,0.3,1) both ${i*0.12}s` }}>

          {/* tilt layer */}
          <div style={{ width:"100%", height:"100%", transform:`rotateZ(${ROT[i]}deg)` }}>

              <div style={CS}>
                <CardGlass />

                {/* index */}
                <div style={{ position:"absolute", top:10, left:11, zIndex:10,
                  display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ fontSize:7, fontFamily:"monospace", color:"rgba(255,255,255,0.22)", letterSpacing:"0.22em" }}>{item.n}</span>
                  <div style={{ width:9, height:1, background:"rgba(255,255,255,0.12)" }}/>
                  <span style={{ fontSize:7, fontWeight:800, color:"rgba(255,255,255,0.28)", letterSpacing:"0.22em", textTransform:"uppercase" }}>{item.cat}</span>
                </div>

                {/* price */}
                <div style={{ position:"absolute", top:10, right:11, zIndex:10 }}>
                  <span style={{ fontSize:8, fontWeight:700, color:"rgba(255,255,255,0.45)", letterSpacing:"0.05em" }}>{item.price}</span>
                </div>

                {/* product image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.img} alt={item.cat} style={{
                  position:"absolute", top:28, bottom:42, left:0, right:0,
                  width:"100%", height:"calc(100% - 70px)",
                  objectFit:"contain", objectPosition:"center",
                  filter:"grayscale(1) contrast(1.12)",
                  padding:"6px 14px",
                }}/>

                {/* bottom label */}
                <div style={{ position:"absolute", bottom:0, left:0, right:0,
                  padding:"8px 11px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ fontSize:10, fontWeight:900, color:"rgba(255,255,255,0.82)",
                    letterSpacing:"0.07em", textTransform:"uppercase", lineHeight:1.2 }}>{item.cat}</p>
                  <p style={{ fontSize:7, color:"rgba(255,255,255,0.28)",
                    letterSpacing:"0.1em", textTransform:"uppercase", marginTop:2 }}>{item.brand}</p>
                </div>
              </div>

          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SLIDE 02 — item cards on left, full outfit card on right
   ═══════════════════════════════════════════════════════════ */
function Slide02() {
  return (
    <div style={{ height:"100%", display:"grid",
      gridTemplateColumns:"1fr 1.15fr", gap:8, overflow:"visible" }}>

      {/* ── left column: 3 stacked item cards ── */}
      <div style={{ display:"grid", gridTemplateRows:"repeat(3,1fr)", gap:6, overflow:"visible" }}>
        {ITEMS.map((item, i) => (
          <div key={item.n} style={{ overflow:"visible",
            animation:`cReveal 0.7s cubic-bezier(0.16,1,0.3,1) both ${i*0.12}s` }}>
            <div style={{ width:"100%", height:"100%",
              transform:`rotateZ(${[-0.9, 0, 0.6][i]}deg)` }}>

              <div style={CS}>
                <CardGlass/>
                {/* number */}
                <div style={{ position:"absolute", top:8, left:10, zIndex:10,
                  display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:7, fontFamily:"monospace", color:"rgba(255,255,255,0.22)", letterSpacing:"0.18em" }}>{item.n}</span>
                  <div style={{ width:8, height:1, background:"rgba(255,255,255,0.12)" }}/>
                  <span style={{ fontSize:7, fontWeight:800, color:"rgba(255,255,255,0.28)", letterSpacing:"0.18em", textTransform:"uppercase" }}>{item.cat}</span>
                </div>
                {/* price */}
                <div style={{ position:"absolute", top:8, right:10, zIndex:10 }}>
                  <span style={{ fontSize:7, fontWeight:700, color:"rgba(255,255,255,0.4)" }}>{item.price}</span>
                </div>
                {/* image — compact */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.img} alt={item.cat} style={{
                  position:"absolute", top:22, bottom:30, left:0, right:0,
                  width:"100%", height:"calc(100% - 52px)",
                  objectFit:"contain", objectPosition:"center",
                  filter:"grayscale(1) contrast(1.1)",
                  padding:"4px 12px",
                }}/>
                {/* label */}
                <div style={{ position:"absolute", bottom:0, left:0, right:0,
                  padding:"5px 10px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ fontSize:9, fontWeight:900, color:"rgba(255,255,255,0.78)",
                    letterSpacing:"0.07em", textTransform:"uppercase", lineHeight:1.2 }}>{item.cat}</p>
                  <p style={{ fontSize:6, color:"rgba(255,255,255,0.25)",
                    letterSpacing:"0.1em", textTransform:"uppercase", marginTop:1.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.brand}</p>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* ── right column: full outfit card ── */}
      <div style={{ overflow:"visible",
        animation:"cReveal 0.75s cubic-bezier(0.16,1,0.3,1) both 0.28s" }}>
        <div style={{ width:"100%", height:"100%", transform:"rotateZ(0.5deg)" }}>
          <div style={CS}>
            <CardGlass/>
            {/* header */}
            <div style={{ position:"absolute", top:10, left:11, zIndex:10,
              display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontSize:7, fontFamily:"monospace", color:"rgba(255,255,255,0.22)", letterSpacing:"0.22em" }}>04</span>
              <div style={{ width:9, height:1, background:"rgba(255,255,255,0.12)" }}/>
              <span style={{ fontSize:7, fontWeight:800, color:"rgba(255,255,255,0.35)", letterSpacing:"0.22em", textTransform:"uppercase" }}>COMPLETE LOOK</span>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"rgba(255,255,255,0.55)",
                boxShadow:"0 0 6px rgba(255,255,255,0.6)",
                animation:"dotPulse 2.4s ease-in-out infinite", display:"inline-block" }}/>
            </div>
            {/* outfit image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cs/outfit.png" alt="Complete outfit" style={{
              position:"absolute", top:28, bottom:0, left:0, right:0,
              width:"100%", height:"calc(100% - 28px)",
              objectFit:"cover", objectPosition:"center top",
              filter:"grayscale(1) contrast(1.08)",
            }}/>
          </div>
        </div>
      </div>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SLIDE 03 — "50+" center with scattered brand squircle badges
   ═══════════════════════════════════════════════════════════ */
function Slide03() {
  return (
    <div style={{ position:"relative", height:"100%", overflow:"hidden",
      animation:"cReveal 0.7s cubic-bezier(0.16,1,0.3,1) both 0s" }}>

      {/* subtle radial glow behind 50+ */}
      <div aria-hidden style={{
        position:"absolute", inset:0, pointerEvents:"none", zIndex:0,
        background:"radial-gradient(ellipse 55% 40% at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 70%)",
      }}/>

      {/* "50+" hero text — bright, centered */}
      <div style={{
        position:"absolute", inset:0,
        display:"flex", alignItems:"center", justifyContent:"center",
        pointerEvents:"none", zIndex:1,
      }}>
        <p style={{
          fontSize:"clamp(72px,14vw,108px)", fontWeight:900,
          color:"rgba(255,255,255,0.93)", letterSpacing:"-0.03em",
          lineHeight:1, userSelect:"none",
        }}>50+</p>
      </div>

      {/* brand badges — squircles + bare text */}
      {BRANDS.map((b, i) => (
        <div key={b.name} style={{
          position:"absolute",
          top: b.top, left: b.left,
          zIndex: 2,
          animation:`cReveal 0.65s cubic-bezier(0.16,1,0.3,1) both ${i*0.05}s`,
          transform:"translate(-50%,-50%)",
        }}>
          {b.hasBox ? (
            <div style={{
              width: b.size, height: b.size,
              borderRadius: Math.round(b.size * 0.28),
              background:"rgba(22,22,22,0.95)",
              border:"1px solid rgba(255,255,255,0.1)",
              boxShadow:"0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <span style={{
                fontSize: b.textSize,
                fontWeight: b.bold ? 800 : 500,
                color:"rgba(255,255,255,0.88)",
                letterSpacing: b.textSize > 12 ? "0em" : "0.08em",
                textTransform:"uppercase",
                textAlign:"center",
                lineHeight:1.2,
                padding:"0 6px",
              }}>{b.name}</span>
            </div>
          ) : (
            <span style={{
              fontSize: b.textSize,
              fontWeight: b.bold ? 700 : 400,
              color:"rgba(255,255,255,0.55)",
              letterSpacing:"0.14em",
              textTransform:"uppercase",
              whiteSpace:"nowrap",
            }}>{b.name}</span>
          )}
        </div>
      ))}

    </div>
  );
}

/* ── slide transition ───────────────────────────────────── */
const SLIDE_COMPS = [Slide01, Slide02, Slide03];

function SlideTransition({ active, prev }:{ active:number; prev:number|null }) {
  const [exiting,  setExiting]  = useState<number|null>(null);
  const [entering, setEntering] = useState<number>(active);
  const [phase,    setPhase]    = useState<"idle"|"animating">("idle");

  useEffect(() => {
    if (prev===null||prev===active) { setEntering(active); return; }
    setExiting(prev); setEntering(active); setPhase("animating");
    // keep exiting slide visible for the full fade-out duration (500ms)
    const t = setTimeout(() => { setExiting(null); setPhase("idle"); }, 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const Exit  = exiting!==null ? SLIDE_COMPS[exiting]  : null;
  const Enter = SLIDE_COMPS[entering];
  return (
    <div style={{ position:"absolute", inset:0 }}>
      {/* exiting slide fades out behind the entering one */}
      {Exit && phase==="animating" && (
        <div key={`x-${exiting}`} style={{
          position:"absolute", inset:0, zIndex:1,
          animation:"sFadeOut 0.5s cubic-bezier(0.4,0,1,1) both",
        }}>
          <Exit/>
        </div>
      )}
      {/* entering slide fades in on top — subtle scale-up for depth feel */}
      <div key={`e-${entering}`} style={{
        position:"absolute", inset:0, zIndex:2,
        animation:phase==="animating"
          ? "sFadeIn 0.75s cubic-bezier(0.16,1,0.3,1) both"
          : undefined,
      }}>
        <Enter/>
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────── */
export default function FeatureCarousel({ onSlideChange }:{ onSlideChange?:(i:number)=>void }) {
  const [active,   setActive]   = useState(0);
  const [prev,     setPrev]     = useState<number|null>(null);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const progRef  = useRef<ReturnType<typeof setInterval>|null>(null);

  const startTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (progRef.current)  clearInterval(progRef.current);
    setProgress(0);
    const step = 100/(AUTOPLAY_MS/50);
    progRef.current  = setInterval(()=>setProgress(p=>Math.min(p+step,100)),50);
    timerRef.current = setInterval(()=>{
      setActive(curr=>{ const next=(curr+1)%SLIDES.length; setPrev(curr); onSlideChange?.(next); return next; });
      setProgress(0);
    },AUTOPLAY_MS);
  },[onSlideChange]);

  useEffect(()=>{
    startTimers();
    return ()=>{ if(timerRef.current)clearInterval(timerRef.current); if(progRef.current)clearInterval(progRef.current); };
  },[startTimers]);

  const goTo=(idx:number)=>{ if(idx===active)return; setPrev(active); setActive(idx); onSlideChange?.(idx); startTimers(); };

  return (
    <>
      <style>{`
        /* hero-1 style card entrance — big translateY, spring easing */
        @keyframes cReveal  {
          0%   { opacity:0; transform:translateY(22px) scale(0.96); }
          100% { opacity:1; transform:translateY(0)    scale(1);    }
        }
        /* slide crossfade — premium dissolve with depth */
        @keyframes sFadeIn  {
          0%   { opacity:0; transform:scale(0.97) translateY(10px); }
          100% { opacity:1; transform:scale(1)    translateY(0);    }
        }
        @keyframes sFadeOut {
          0%   { opacity:1; transform:scale(1);    }
          100% { opacity:0; transform:scale(1.02); }
        }
        @keyframes dotPulse{ 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.5)} }
      `}</style>

      <div className="h-full flex flex-col" style={{ gap:11 }}>

        {/* ── tab nav ── */}
        <div className="flex items-center shrink-0"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          {SLIDES.map((s,i)=>(
            <button key={s.id} onClick={()=>goTo(i)}
              className="relative flex items-center gap-2 pb-3 pr-8 transition-all duration-300">
              <span className="text-[10px] tracking-[0.14em] uppercase transition-all duration-300"
                style={{ color:i===active?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.22)",
                  fontWeight:i===active?700:400,
                  textShadow:i===active?"0 0 14px rgba(255,255,255,0.3)":"none" }}>
                {s.id} / {s.short}
              </span>
              {i===active&&(
                <span className="absolute bottom-0 left-0 h-[1.5px]"
                  style={{ width:`${progress}%`, background:"rgba(255,255,255,0.8)",
                    boxShadow:"0 0 8px rgba(255,255,255,0.5)", transition:"width 0.05s linear" }}/>
              )}
            </button>
          ))}
        </div>

        {/* ── 3-D tilted scene ── */}
        <div className="flex-1 min-h-0 relative overflow-hidden"
          style={{ perspective:"1100px" }}>

          {/* edge vignettes */}
          <div aria-hidden style={{ position:"absolute",inset:0,zIndex:30,pointerEvents:"none",
            background:"linear-gradient(to right,#080808 0%,transparent 10%,transparent 74%,#080808 100%)" }}/>
          <div aria-hidden style={{ position:"absolute",inset:0,zIndex:30,pointerEvents:"none",
            background:"linear-gradient(to bottom,#080808 0%,transparent 7%,transparent 62%,#080808 100%)" }}/>

          {/* scene — flat 2-D tilt, no preserve-3d to prevent card flyouts */}
          <div style={{ position:"absolute", inset:0,
            transform:"rotateX(3deg) rotateY(-9deg)",
            transformOrigin:"center 40%" }}>
            <SlideTransition active={active} prev={prev}/>
          </div>
        </div>

        {/* ── email form ── */}
        <div className="shrink-0"><EmailForm/></div>

        {/* ── bottom nav ── */}
        <div className="shrink-0 flex items-center justify-between"
          style={{ borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:11 }}>
          <div className="flex items-center gap-0">
            {SLIDES.map((s,i)=>(
              <button key={s.id} onClick={()=>goTo(i)} className="flex items-center gap-2.5">
                {i>0&&<span className="text-[8px] text-white/18 tracking-widest mx-1">—</span>}
                {i===0&&<span className="text-[8px] text-white/18 tracking-widest mr-1">—</span>}
                <span className="text-[8px] tracking-[0.18em] uppercase transition-all duration-300"
                  style={{ color:i===active?"rgba(255,255,255,0.75)":"rgba(255,255,255,0.2)",
                    fontWeight:i===active?700:400,
                    textShadow:i===active?"0 0 10px rgba(255,255,255,0.25)":"none" }}>
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
