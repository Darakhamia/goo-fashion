// Beat 8: where to buy. The real product page of the Air Jordan 1 "Royal"
// (public/captures/product.png, desktop 1440×900), below the site's nav, in a
// browser frame. The camera pushes in from the whole page to "Where to buy"
// while the store rows, cropped from the same capture, cascade in. Goat is the
// item's real store; StockX and Farfetch are illustrative (D2).
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeInOut, easeOut, mix, ramp } from "../../motion";
import { M, PAPER, Shot, type Format, SIZE, type Rect } from "../kit";
import { Browser } from "../Device";
import { Sfx, type SfxName } from "../Sfx";

const P = M.product;
const PAGE = { x: 0, y: 110, w: 1440, h: 790 }; // the capture below the site's nav

const ZOOM: Record<Format, { fit: number; end: number }> = {
  "16x9": { fit: 1.18, end: 2.1 },
  "1x1": { fit: 0.69, end: 1.52 },
  "9x16": { fit: 0.69, end: 1.6 },
};

export function Product({ format, dur }: { format: Format; dur: number }) {
  const f = useCurrentFrame();
  const { W, H } = SIZE[format];
  const Z = ZOOM[format];
  const wtb = P.whereToBuy;
  // End on "Where to buy" with the page's bottom edge near the frame's: the
  // block is the last thing in the captured viewport.
  // Vertical frames the whole info column instead, centred.
  const end = { x: wtb.x + wtb.w / 2, y: format === "9x16" ? 430 : PAGE.h - H / 2 / Z.end + 14 };

  const c = ramp(f, 22, dur - 6, easeInOut);
  const z = mix(Z.fit, Z.end, c) * mix(0.96, 1, ramp(f, 0, 18, easeOut));
  const bar = 38 * z;
  const fx = mix(PAGE.w / 2, end.x, c);
  const fy = mix(PAGE.h / 2 - 19, end.y, c);
  const left = W / 2 - fx * z;
  const top = H / 2 - fy * z;
  const enter = ramp(f, 0, 18, easeOut);

  // The store rows, hidden at first under the panel's own colour.
  const rows = P.rows as Rect[];
  const first = rows[0];
  const last = rows[rows.length - 1];
  const cover = { x: first.x - 4, y: first.y - 4, w: first.w + 8, h: last.y + last.h - first.y + 8 };

  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      {/* Sound: the window arrives, each store row ticks in a step higher, and
          a low swell leads into the end card. */}
      <Sfx at={0} name="whoosh-soft" volume={0.24} />
      {[0, 1, 2].map((i) => (
        <Sfx key={i} at={30 + i * 10} name={`tick-${i}` as SfxName} volume={0.3} />
      ))}
      <Sfx at={dur - 40} name="swell" volume={0.2} />
      <Browser
        w={PAGE.w * z}
        h={PAGE.h * z}
        s={z}
        url="goo-fashion.com"
        compact={format === "9x16"}
        style={{
          left,
          top: top - bar,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 140}px) perspective(2400px) rotateX(${(1 - enter) * 12}deg)`,
        }}
      >
        <Shot src={P.image} size={P.size} crop={PAGE} scale={z} style={{ left: 0, top: 0 }} />
        <div style={{ position: "absolute", left: cover.x * z, top: (cover.y - PAGE.y) * z, width: cover.w * z, height: cover.h * z, background: PAPER }} />
        {rows.map((r, i) => {
          const t = ramp(f, 30 + i * 10, 44 + i * 10, easeOut);
          return (
            <Shot
              key={i}
              src={P.image}
              size={P.size}
              crop={r}
              scale={z}
              radius={12 * z}
              style={{ left: r.x * z, top: (r.y - PAGE.y) * z, opacity: t, transform: `translateX(${(1 - t) * 60 * z}px)` }}
            />
          );
        })}
      </Browser>
    </AbsoluteFill>
  );
}
