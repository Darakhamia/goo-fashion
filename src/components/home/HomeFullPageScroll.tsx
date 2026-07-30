"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Matches HomeSection's fit threshold — below it the page scrolls normally. */
const ENABLE_FROM = 1024;
const ANIM_MS = 700;
/**
 * A wheel gesture isn't over when the fingers lift: trackpad momentum keeps
 * firing events for up to a second afterwards. The next move is only unlocked
 * once those events have actually stopped, so one flick travels one section.
 */
const WHEEL_IDLE_MS = 150;
const WHEEL_MIN_DELTA = 4;
const TOUCH_MIN_DELTA = 50;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function navHeight() {
  const header = document.querySelector("header");
  return header ? Math.round(header.getBoundingClientRect().height) : 0;
}

function isModalOpen() {
  return document.querySelector('[aria-modal="true"]') !== null;
}

/**
 * Where a wheel event belongs:
 * - `scroller` — a list inside the page that can still scroll that way; leave it be.
 * - `overlay`  — a floating panel (stylist drawer, cart, search) with nothing
 *   left to scroll; swallow it so the page behind doesn't drift off its stop.
 * - `page`     — the page itself, so move a section.
 */
function classifyWheel(target: EventTarget | null, delta: number): "scroller" | "overlay" | "page" {
  let el = target instanceof Element ? target : null;
  let overlay = false;

  while (el && el !== document.body && el !== document.documentElement) {
    // The section rail is ours and floats over everything — wheeling across it
    // should still move the page rather than hit the overlay branch below.
    if (el.hasAttribute("data-home-rail")) return "page";

    const style = getComputedStyle(el);
    const { overflowY } = style;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight + 1
    ) {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if (!(delta > 0 ? atBottom : atTop)) return "scroller";
    }
    // The nav is sticky, not fixed, so wheeling over it still moves the page.
    if (style.position === "fixed") overlay = true;
    el = el.parentElement;
  }

  return overlay ? "overlay" : "page";
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName);
}

function sameLabels(a: string[], b: string[]) {
  return a.length === b.length && a.every((label, i) => label === b[i]);
}

/**
 * Turns the homepage into one screen per section: a single wheel notch, swipe
 * or arrow key travels to the next block of information instead of drifting
 * part-way into it.
 *
 * Only the homepage renders this, and only from {@link ENABLE_FROM} up — narrow
 * screens and "reduce motion" keep the browser's own scrolling.
 */
export default function HomeFullPageScroll() {
  const [labels, setLabels] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  /** Absolute scroll positions, in document order. */
  const stopsRef = useRef<number[]>([]);
  /** Index into `stopsRef` of each section's own stop (a tall one adds extras). */
  const sectionStopsRef = useRef<number[]>([]);
  const enabledRef = useRef(false);
  const lockedRef = useRef(false);
  const lastWheelRef = useRef(0);
  const rafRef = useRef(0);
  const unlockRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touchStartRef = useRef(0);

  // ── Where the dots are ─────────────────────────────────────────────────────

  const syncActiveSection = useCallback(() => {
    const stops = stopsRef.current;
    const sectionStops = sectionStopsRef.current;
    if (sectionStops.length === 0) return;

    const y = window.scrollY;
    let current = 0;
    sectionStops.forEach((stopIndex, i) => {
      if (y >= (stops[stopIndex] ?? 0) - 8) current = i;
    });
    setActiveSection(current);
  }, []);

  // ── Stops ──────────────────────────────────────────────────────────────────

  const measure = useCallback(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-home-section]")
    );
    if (sections.length === 0) {
      stopsRef.current = [];
      sectionStopsRef.current = [];
      setLabels((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const nav = navHeight();
    document.documentElement.style.setProperty("--home-nav-h", `${nav}px`);

    // The footer is the last stop — "everything else" lives there.
    const footer = document.querySelector<HTMLElement>("footer");
    const blocks: HTMLElement[] = footer ? [...sections, footer] : sections;

    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
    const screen = Math.max(240, window.innerHeight - nav);

    const stops: number[] = [];
    const sectionStops: number[] = [];
    const push = (value: number) => {
      const y = Math.min(maxScroll, Math.max(0, Math.round(value)));
      if (stops.length > 0 && Math.abs(stops[stops.length - 1] - y) <= 8) {
        return stops.length - 1;
      }
      stops.push(y);
      return stops.length - 1;
    };

    blocks.forEach((block, i) => {
      const documentTop = block.getBoundingClientRect().top + window.scrollY;
      // The hero sits under the nav's own place in the flow, so it is already
      // fully in view at the top of the page. Every later block reserves a strip
      // for the pinned nav and therefore lines up with its own top.
      const top = i === 0 ? documentTop - nav : documentTop;
      sectionStops.push(push(top));

      // A block that genuinely can't fit one screen still has to be reachable,
      // so it gets intermediate stops a screen apart.
      const box = i === 0 ? screen : window.innerHeight;
      const pages = Math.ceil((block.offsetHeight - 4) / box);
      for (let page = 1; page < pages; page++) push(top + page * box);
    });

    stopsRef.current = stops;
    sectionStopsRef.current = sectionStops;

    const next = blocks.map((block, i) =>
      block.dataset.homeLabel || (block.tagName === "FOOTER" ? "More" : `Section ${i + 1}`)
    );
    setLabels((prev) => (sameLabels(prev, next) ? prev : next));
    syncActiveSection();
  }, [syncActiveSection]);

  // ── Movement ───────────────────────────────────────────────────────────────

  const unlockWhenIdle = useCallback(() => {
    clearTimeout(unlockRef.current);
    const tick = () => {
      const idle = Date.now() - lastWheelRef.current;
      if (idle < WHEEL_IDLE_MS) {
        unlockRef.current = setTimeout(tick, WHEEL_IDLE_MS - idle + 20);
      } else {
        lockedRef.current = false;
      }
    };
    unlockRef.current = setTimeout(tick, WHEEL_IDLE_MS);
  }, []);

  const goToStop = useCallback(
    (index: number) => {
      const stops = stopsRef.current;
      if (stops.length === 0) return;

      const target = stops[Math.min(stops.length - 1, Math.max(0, index))];
      const from = window.scrollY;
      const distance = target - from;

      lockedRef.current = true;
      cancelAnimationFrame(rafRef.current);

      if (Math.abs(distance) < 2) {
        unlockWhenIdle();
        return;
      }

      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ANIM_MS);
        window.scrollTo({ top: from + distance * easeInOutCubic(t), behavior: "instant" });
        syncActiveSection();
        if (t < 1) rafRef.current = requestAnimationFrame(step);
        else unlockWhenIdle();
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [syncActiveSection, unlockWhenIdle]
  );

  const move = useCallback(
    (direction: 1 | -1) => {
      // Re-read the layout on every gesture: a stale nav height or a section
      // that only just finished loading its images would land us off-target.
      measure();

      const stops = stopsRef.current;
      const y = window.scrollY;
      let nearest = 0;
      let nearestDistance = Infinity;
      stops.forEach((stop, i) => {
        const distance = Math.abs(stop - y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = i;
        }
      });
      goToStop(nearest + direction);
    },
    [goToStop, measure]
  );

  // ── Wiring ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const wide = window.matchMedia(`(min-width: ${ENABLE_FROM}px)`);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => {
      const on = wide.matches && !reduced.matches;
      enabledRef.current = on;
      setEnabled(on);
      // The global `scroll-behavior: smooth` would fight the animation above.
      document.documentElement.classList.toggle("home-fullpage", on);
      if (on) measure();
    };

    sync();
    wide.addEventListener("change", sync);
    reduced.addEventListener("change", sync);

    // Sections settle after images and fonts load, and reflow on every resize.
    const remeasure = () => {
      if (enabledRef.current) measure();
    };
    const observer = new ResizeObserver(remeasure);
    observer.observe(document.body);
    window.addEventListener("load", remeasure);
    document.fonts?.ready.then(remeasure).catch(() => {});
    // The nav fades in over 300ms; measuring mid-transition reads the wrong height.
    const settle = setTimeout(remeasure, 600);

    const onWheel = (e: WheelEvent) => {
      if (!enabledRef.current) return;
      lastWheelRef.current = Date.now();
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      // The desktop stylist drawer deliberately leaves the page browsable, so an
      // open panel doesn't switch section snapping off — it only claims the
      // wheels that land on it.
      const where = classifyWheel(e.target, e.deltaY);
      if (where === "scroller") return;
      e.preventDefault();
      if (where === "overlay") return;

      if (lockedRef.current || Math.abs(e.deltaY) < WHEEL_MIN_DELTA) return;
      move(e.deltaY > 0 ? 1 : -1);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current || isModalOpen() || isTypingTarget(e.target)) return;

      let direction: 1 | -1 | 0 = 0;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") direction = 1;
      else if (e.key === "ArrowUp" || e.key === "PageUp") direction = -1;
      else if (e.key === "Home") {
        e.preventDefault();
        goToStop(0);
        return;
      } else if (e.key === "End") {
        e.preventDefault();
        goToStop(stopsRef.current.length - 1);
        return;
      }
      if (direction === 0) return;

      e.preventDefault();
      if (lockedRef.current) return;
      move(direction);
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartRef.current = e.touches[0]?.clientY ?? 0;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!enabledRef.current || lockedRef.current || isModalOpen()) return;
      const delta = touchStartRef.current - (e.changedTouches[0]?.clientY ?? 0);
      if (Math.abs(delta) < TOUCH_MIN_DELTA) return;
      if (classifyWheel(e.target, delta) !== "page") return;
      move(delta > 0 ? 1 : -1);
    };

    // Keeps the dots honest when scrolling happens outside this controller.
    const onScroll = () => {
      if (enabledRef.current && !lockedRef.current) syncActiveSection();
    };

    // The hero's scroll hint asks for the next section without reaching in here.
    const onNext = () => {
      if (enabledRef.current && !lockedRef.current) move(1);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("home-fullpage:next", onNext);

    return () => {
      wide.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
      observer.disconnect();
      clearTimeout(settle);
      window.removeEventListener("load", remeasure);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("home-fullpage:next", onNext);
      cancelAnimationFrame(rafRef.current);
      clearTimeout(unlockRef.current);
      document.documentElement.classList.remove("home-fullpage");
      document.documentElement.style.removeProperty("--home-nav-h");
    };
  }, [goToStop, measure, move, syncActiveSection]);

  if (!enabled || labels.length < 2) return null;

  return (
    <nav
      data-home-rail
      aria-label="Page sections"
      // The rail is as wide as its longest label, so only the dots themselves
      // take pointer events — the rest must not block the page underneath.
      className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-end gap-4 mix-blend-difference pointer-events-none"
    >
      {labels.map((label, i) => (
        <button
          key={`${label}-${i}`}
          type="button"
          onClick={() => goToStop(sectionStopsRef.current[i] ?? 0)}
          aria-label={`Go to ${label}`}
          aria-current={i === activeSection ? "true" : undefined}
          className="group flex items-center gap-2.5 cursor-pointer pointer-events-auto p-1 -m-1"
        >
          <span className="pointer-events-none text-[9px] tracking-[0.18em] uppercase text-white/0 group-hover:text-white/70 transition-colors duration-200 whitespace-nowrap">
            {label}
          </span>
          <span
            className={`block rounded-full bg-white transition-all duration-300 ${
              i === activeSection ? "h-5 w-[3px] opacity-90" : "h-[3px] w-[3px] opacity-40"
            }`}
          />
        </button>
      ))}
    </nav>
  );
}
