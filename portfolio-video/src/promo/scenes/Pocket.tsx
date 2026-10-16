// The short "Pocket": GOO on a phone, from search results to the stores.
// Every pixel on the screen is the real phone site (public/captures/pocket-*):
// - pocket-browse.png, the results for "Jordan 1" in full, one tall capture;
// - pocket-product.png, the Air Jordan 1 "Royal" page in full;
// - the fixed bars, each captured alone on a transparent background: the
//   header, the tab bar, and the product's buy bar before and after the bag
//   is tapped (the header then shows the bag's count).
// The video scrolls each page under its bars, the way the phone composes them.
// A finger flicks down the results, taps the sneaker, the page opens; it taps
// "Where to buy", the page scrolls to the stores (the app's own scroll target,
// measured), and it taps the bag.
import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { easeDrawer, easeInOut, easeOut, mix, ramp } from "../../motion";
import { M, PAPER, Shot, type Format, SIZE, type Rect } from "../kit";
import { Phone, Tap } from "../Device";
import { Sfx, type SfxName } from "../Sfx";

const P = M.pocket;
const SCREEN = P.size; // 390 × 844 CSS px
const B = P.browse;
const D = P.product;

/** A flick: a quick push, then a long glide to rest. */
const flick = Easing.bezier(0.33, 0, 0.18, 1);

// Local frames.
export const POCKET = {
  flick1: [14, 46] as const,
  flick2: [50, 86] as const,
  tapCard: 96,
  push: [104, 122] as const,
  tapGo: 140,
  scroll: [143, 172] as const,
  tapBag: 188,
};

// The vertical frame: the whole phone, as in the builder.
const LAYOUT = { s: 2.1, top: 74 };

/** One fixed bar's layer; `blur` puts the app's backdrop blur under it. */
function Bar({ layer, s, radius, blur, opacity = 1 }: { layer: { image: string; rect: Rect }; s: number; radius?: number; blur?: boolean; opacity?: number }) {
  const r = layer.rect;
  return (
    <>
      {blur && (
        // The bar itself, inside the layer's 4 px margin: backdrop-blur-md (12 px).
        // It stays while the bar's two states crossfade over it.
        <div style={{ position: "absolute", left: (r.x + 4) * s, top: (r.y + 4) * s, width: (r.w - 8) * s, height: (r.h - 8) * s, borderRadius: (radius ?? 0) * s, backdropFilter: `blur(${12 * s}px)` }} />
      )}
      <Shot src={layer.image} size={{ w: r.w, h: r.h }} scale={s} style={{ left: r.x * s, top: r.y * s, opacity }} />
    </>
  );
}

export function Pocket({ format, dur }: { format: Format; dur: number }) {
  const f = useCurrentFrame();
  const { W, H } = SIZE[format];
  const { s, top } = LAYOUT;
  const sw = SCREEN.w * s;
  const sh = SCREEN.h * s;
  const left = (W - sw) / 2;
  const T = POCKET;

  // The results: two flicks, coming to rest with the sneaker's card in view.
  const card = B.card;
  const rest = Math.min(card.y + card.h / 2 - 410, B.size.h - SCREEN.h);
  const mid = Math.round(rest * 0.54);
  const by = mix(0, mid, ramp(f, T.flick1[0], T.flick1[1], flick)) + mix(0, rest - mid, ramp(f, T.flick2[0], T.flick2[1], flick));
  // The sneaker's page pushes in from the right; the results slip left under it.
  const push = ramp(f, T.push[0], T.push[1], easeDrawer);
  // "Where to buy": the page scrolls to the stores.
  const py = mix(0, D.scrollTo, ramp(f, T.scroll[0], T.scroll[1], easeInOut));
  const bagged = ramp(f, T.tapBag + 1, T.tapBag + 4, (t) => t);

  const enter = ramp(f, 0, 18, easeOut);
  const cam = mix(0.97, 1.03, ramp(f, 0, dur, easeInOut));
  const press = Math.sin(Math.PI * ramp(f, T.tapCard - 2, T.tapCard + 8, (t) => t));
  const badge = D.badge;
  const pop = Math.sin(Math.PI * ramp(f, T.tapBag + 2, T.tapBag + 12, (t) => t)) * 0.35;

  const rowsAt = T.scroll[1] - 6;

  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      {/* Sound: the phone arrives, two soft flicks, taps, the page opening, the
          store rows settling a step higher each, the bag taking the sneaker. */}
      <Sfx at={0} name="whoosh-soft" volume={0.22} />
      <Sfx at={T.flick1[0]} name="whoosh-soft" volume={0.14} />
      <Sfx at={T.flick2[0]} name="whoosh-soft" volume={0.14} />
      <Sfx at={T.tapCard} name="pop" volume={0.32} />
      <Sfx at={T.push[0]} name="whoosh" volume={0.2} />
      <Sfx at={T.tapGo} name="pop" volume={0.3} />
      <Sfx at={T.scroll[0]} name="whoosh-down" volume={0.14} />
      {[0, 1, 2].map((i) => (
        <Sfx key={i} at={rowsAt + i * 5} name={`tick-${i}` as SfxName} volume={0.26} />
      ))}
      <Sfx at={T.tapBag} name="snap" volume={0.36} />
      <Sfx at={T.tapBag + 2} name="pop-3" volume={0.24} />
      <AbsoluteFill style={{ transform: `scale(${cam})`, transformOrigin: `${W / 2}px ${top + sh / 2}px` }}>
        <Phone
          w={sw}
          h={sh}
          s={s}
          style={{
            left: left - 11 * s,
            top: top - 11 * s,
            transform: `translateY(${(1 - enter) * 160}px) perspective(2000px) rotateX(${(1 - enter) * 10}deg)`,
            opacity: enter,
          }}
        >
          {/* The results. */}
          {push < 1 && (
            <div style={{ position: "absolute", inset: 0, transform: `translateX(${-push * 0.3 * sw}px)` }}>
              <Shot src={B.image} size={B.size} crop={{ x: 0, y: by, w: SCREEN.w, h: SCREEN.h }} scale={s} style={{ left: 0, top: 0 }} />
              {press > 0 && (
                // The tapped card gives under the finger.
                <>
                  <div style={{ position: "absolute", left: card.x * s, top: (card.y - by) * s, width: card.w * s, height: card.h * s, background: PAPER }} />
                  <Shot src={B.image} size={B.size} crop={card} scale={s} style={{ left: card.x * s, top: (card.y - by) * s, transform: `scale(${1 - 0.03 * press})` }} />
                </>
              )}
              <Bar layer={B.tabs} s={s} radius={25} blur />
              <Bar layer={B.nav} s={s} />
              <Tap at={T.tapCard} x={card.x + card.w / 2} y={card.y + card.h * 0.4 - by} s={s} />
              <AbsoluteFill style={{ background: "#000", opacity: push * 0.12 }} />
            </div>
          )}
          {/* The sneaker's page. */}
          {push > 0 && (
            <div style={{ position: "absolute", inset: 0, transform: `translateX(${(1 - push) * sw}px)`, boxShadow: `0 0 ${40 * s}px rgba(0, 0, 0, ${0.18 * (1 - push)})` }}>
              <Shot src={D.image} size={D.size} crop={{ x: 0, y: py, w: SCREEN.w, h: SCREEN.h }} scale={s} style={{ left: 0, top: 0 }} />
              <Bar layer={D.before.bar} s={s} radius={24} blur opacity={1 - bagged} />
              <Bar layer={D.after.bar} s={s} opacity={bagged} />
              <Bar layer={D.before.nav} s={s} opacity={1 - bagged} />
              <Bar layer={D.after.nav} s={s} opacity={bagged} />
              {pop > 0 && (
                <Shot
                  src={D.after.nav.image}
                  size={{ w: D.after.nav.rect.w, h: D.after.nav.rect.h }}
                  crop={{ x: badge.x - D.after.nav.rect.x - 1, y: badge.y - D.after.nav.rect.y - 1, w: badge.w + 2, h: badge.h + 2 }}
                  scale={s}
                  radius={999}
                  style={{ left: (badge.x - 1) * s, top: (badge.y - 1) * s, transform: `scale(${1 + pop})` }}
                />
              )}
              <Tap at={T.tapGo} x={D.go.x + D.go.w / 2} y={D.go.y + D.go.h / 2} s={s} />
              <Tap at={T.tapBag} x={D.bag.x + D.bag.w / 2} y={D.bag.y + D.bag.h / 2} s={s} />
            </div>
          )}
        </Phone>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
