"use client";

import { useCallback, useEffect, useRef } from "react";

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

/**
 * How still the page has to be before a scroll counts as finished and its
 * resting position becomes the start of the next gesture. Long enough to sit
 * out the tail of a fling, short enough not to swallow a quick second swipe.
 */
const SETTLE_MS = 160;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function navHeight() {
  const header = document.querySelector("header");
  return header ? Math.round(header.getBoundingClientRect().height) : 0;
}

function isModalOpen() {
  return document.querySelector('[aria-modal="true"]') !== null;
}

/** Every block still on screen at this width, in document order. */
function visibleSections() {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-home-section]")
  ).filter((el) => el.offsetHeight > 0);
}

/**
 * The scroll position the last slide comes to rest at — the point past which
 * the page belongs to the footer rather than to the sequence.
 */
function lastSlideTop() {
  const sections = visibleSections();
  const last = sections[sections.length - 1];
  if (!last) return Infinity;
  return Math.round(last.getBoundingClientRect().top + window.scrollY);
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

/**
 * Turns the homepage into one screen per section: a single wheel notch, swipe
 * or arrow key travels to the next block of information instead of drifting
 * part-way into it. The footer is left out of that sequence — past the last
 * section the page scrolls the ordinary way.
 *
 * Renders nothing — it only installs the scroll behaviour, and only on the
 * homepage from {@link ENABLE_FROM} up. Narrow screens and "reduce motion" keep
 * the browser's own scrolling.
 */
export default function HomeFullPageScroll() {
  /** Absolute scroll positions, in document order. */
  const stopsRef = useRef<number[]>([]);
  const enabledRef = useRef(false);
  const lockedRef = useRef(false);
  const lastWheelRef = useRef(0);
  const rafRef = useRef(0);
  const unlockRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touchStartRef = useRef(0);

  // ── Stops ──────────────────────────────────────────────────────────────────

  const measure = useCallback(() => {
    // Blocks that only exist on phones (the featured product gets its own
    // screen there) are still in the DOM at this width, just hidden — a
    // zero-height section would otherwise add a stop at the top of the page.
    const sections = visibleSections();
    if (sections.length === 0) {
      stopsRef.current = [];
      return;
    }

    const nav = navHeight() || parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--home-nav-h")
    ) || 0;

    // The footer is deliberately not a stop: it is reference material — links,
    // legal, the copyright line — rather than another block of the pitch, so it
    // is scrolled to normally instead of being snapped onto its own screen.
    const blocks = sections;

    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
    const screen = Math.max(240, window.innerHeight - nav);

    const stops: number[] = [];
    const push = (value: number) => {
      const y = Math.min(maxScroll, Math.max(0, Math.round(value)));
      if (stops.length > 0 && Math.abs(stops[stops.length - 1] - y) <= 8) return;
      stops.push(y);
    };

    blocks.forEach((block, i) => {
      const documentTop = block.getBoundingClientRect().top + window.scrollY;
      // The hero sits under the nav's own place in the flow, so it is already
      // fully in view at the top of the page. Every later block reserves a strip
      // for the pinned nav and therefore lines up with its own top.
      const top = i === 0 ? documentTop - nav : documentTop;
      push(top);

      // A block that genuinely can't fit one screen still has to be reachable,
      // so it gets intermediate stops a screen apart.
      const box = i === 0 ? screen : window.innerHeight;
      const pages = Math.ceil((block.offsetHeight - 4) / box);
      for (let page = 1; page < pages; page++) push(top + page * box);
    });

    stopsRef.current = stops;
  }, []);

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

  const animateTo = useCallback(
    (target: number) => {
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
        if (t < 1) rafRef.current = requestAnimationFrame(step);
        else unlockWhenIdle();
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [unlockWhenIdle]
  );

  const goToStop = useCallback(
    (index: number) => {
      const stops = stopsRef.current;
      if (stops.length === 0) return;
      animateTo(stops[Math.min(stops.length - 1, Math.max(0, index))]);
    },
    [animateTo]
  );

  /**
   * Whether this gesture belongs to the footer rather than to the section
   * sequence: once the last section is on screen, going further down — and
   * coming back up from anywhere below it — is ordinary browser scrolling.
   */
  const isFooterGesture = useCallback((direction: number) => {
    const stops = stopsRef.current;
    if (stops.length === 0) return false;
    const last = stops[stops.length - 1];
    return direction > 0 ? window.scrollY >= last - 2 : window.scrollY > last + 2;
  }, []);

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

    /** Every section is sized off the nav's real height, at every width. */
    const syncNav = () => {
      const nav = navHeight();
      if (nav > 0) {
        document.documentElement.style.setProperty("--home-nav-h", `${nav}px`);
      }
    };

    const sync = () => {
      const on = wide.matches && !reduced.matches;
      enabledRef.current = on;
      // The global `scroll-behavior: smooth` would fight the animation above.
      document.documentElement.classList.toggle("home-fullpage", on);
      // Where the wheel-driven jump is off, CSS scroll-snap keeps one block per
      // screen instead — see `html.home-snap` in globals.css.
      document.documentElement.classList.toggle("home-snap", !on);
      // Desktop drives the sequence itself, so the footer exemption below has
      // nothing to exempt — leaving it set would outlive the width that set it.
      // On phones it has to be decided in the same breath as snapping is turned
      // on: a reload restores its scroll position before any gesture happens,
      // and if that position is already in the footer, a snapping that arrives
      // even a frame earlier drags the reader back up to the last slide.
      document.documentElement.classList.toggle(
        "home-snap-free",
        !on && window.scrollY > lastSlideTop() + 2
      );
      syncNav();
      if (on) measure();
    };

    sync();
    wide.addEventListener("change", sync);
    reduced.addEventListener("change", sync);

    // Sections settle after images and fonts load, and reflow on every resize.
    const remeasure = () => {
      syncNav();
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
      // Hand the footer back to the browser — but only between gestures, so the
      // momentum of the flick that landed on the last section doesn't carry
      // straight on into it.
      if (where === "page" && !lockedRef.current && isFooterGesture(e.deltaY)) return;
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
        // End means the bottom of the page, which is now the foot of the footer.
        animateTo(document.documentElement.scrollHeight - window.innerHeight);
        return;
      }
      if (direction === 0) return;

      if (!lockedRef.current && isFooterGesture(direction)) return;
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
      if (isFooterGesture(delta)) return;
      move(delta > 0 ? 1 : -1);
    };

    // ── The footer, on phones ────────────────────────────────────────────────
    // Snapping runs the slides, but the footer isn't one of them: past the last
    // slide the page scrolls the ordinary way, and drifts back up the same way,
    // exactly as it does on desktop. Since `scroll-snap-type` belongs to the
    // whole scroller, that region is freed by dropping snapping for the run of
    // the gesture instead.
    //
    // The test is the desktop one, and for the same reason it is made against
    // where the page was *resting* when the gesture began rather than against
    // where it is right now: a fling that starts three slides up merely passes
    // the last slide on its way to it, and reading the live position would free
    // that fling to sail on into the footer.
    let restY = window.scrollY;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const setFree = (free: boolean) =>
      document.documentElement.classList.toggle("home-snap-free", free);

    const onScroll = () => {
      if (enabledRef.current) return;
      const last = lastSlideTop();
      const y = window.scrollY;

      // Down: free once the last slide is where we started from. Up: free only
      // from below it — leaving the last slide upwards is still a slide move.
      if (y > restY ? restY >= last - 2 : restY > last + 2) setFree(true);

      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        restY = window.scrollY;
        // Back among the slides, snapping resumes. Doing it only once the page
        // is still keeps the property change from yanking a gesture still in
        // flight, and at a resting slide the change moves nothing at all.
        setFree(restY > lastSlideTop() + 2);
      }, SETTLE_MS);
    };

    // The hero's scroll hint asks for the next section without reaching in here.
    const onNext = () => {
      if (enabledRef.current) {
        if (!lockedRef.current) move(1);
        return;
      }
      // Phones do the travelling natively: the snap points already sit where
      // each slide starts, so the browser only has to be pointed at the next
      // one. "Next" is measured past the stuck nav — from the top of the page
      // the hero's own top still sits below it, and would match itself.
      const past = navHeight() + 8;
      const next = Array.from(
        document.querySelectorAll<HTMLElement>("[data-home-section]")
      ).find((el) => el.offsetHeight > 0 && el.getBoundingClientRect().top > past);
      next?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("home-fullpage:next", onNext);

    return () => {
      wide.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
      observer.disconnect();
      clearTimeout(settle);
      window.removeEventListener("load", remeasure);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("home-fullpage:next", onNext);
      cancelAnimationFrame(rafRef.current);
      clearTimeout(unlockRef.current);
      clearTimeout(settleTimer);
      document.documentElement.classList.remove("home-fullpage");
      document.documentElement.classList.remove("home-snap");
      document.documentElement.classList.remove("home-snap-free");
      document.documentElement.style.removeProperty("--home-nav-h");
    };
  }, [animateTo, goToStop, isFooterGesture, measure, move]);

  return null;
}
