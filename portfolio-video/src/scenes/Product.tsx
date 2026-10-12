// Scene 5: the same sneaker's product page. The camera eases down to "Where to
// buy", the store rows arrive cheapest first, and the cheapest takes the "Best"
// badge and the highlight. Then the page recedes behind the phone.
import React from "react";
import { useCurrentFrame } from "remotion";
import type { Layout } from "../layout";
import { easeInOut, mix, ramp, settle } from "../motion";
import { Panel } from "../ui/Panel";
import { ProductPage } from "../ui/app/ProductPage";
import { FEATURED, FEATURED_STORES } from "../fixtures/story";

/** "Where to buy" on the 1440 px page, in CSS px (measured: scripts/measure.mjs). */
const WHERE_TO_BUY = { x: 749, y: 548, w: 602, h: 305 };

export const PROD = { cameraFrom: 28, cameraTo: 66, rows: [40, 45, 50], best: 64, recede: 101, gone: 175 };

export function ProductScene({ L }: { L: Layout }) {
  const f = useCurrentFrame();
  const P = L.product;
  const cam = ramp(f, PROD.cameraFrom, PROD.cameraTo, easeInOut);
  // From the page's top (gallery and title) to "Where to buy" filling `fill`
  // of the panel width; the scale moves geometrically so the push feels even.
  const endScale = (P.fill * L.panel.w) / WHERE_TO_BUY.w;
  const drift = mix(1, 1.02, ramp(f, PROD.cameraTo, PROD.recede, (t) => t));
  const camera = {
    scale: P.start.scale * Math.pow(endScale / P.start.scale, cam) * drift,
    cx: mix(P.start.cx, WHERE_TO_BUY.x + WHERE_TO_BUY.w / 2, cam),
    cy: mix(P.start.cy, WHERE_TO_BUY.y + WHERE_TO_BUY.h / 2, cam),
  };
  const recede = ramp(f, PROD.recede, PROD.recede + 24, easeInOut);
  const rowsIn = PROD.rows.map((at) => Math.min(1, settle(f, at)));
  const best = Math.min(1, settle(f, PROD.best, { damping: 14, stiffness: 160 }));
  return (
    <Panel
      rect={L.panel}
      scale={camera.scale}
      camera={camera}
      opacity={ramp(f, 0, 16) * (1 - ramp(f, PROD.gone - 20, PROD.gone, easeInOut))}
      outerScale={mix(1, 0.94, recede)}
      dim={0.55 * recede}
    >
      <ProductPage
        width={P.viewportW}
        product={FEATURED}
        stores={FEATURED_STORES}
        rowsIn={rowsIn}
        best={best}
        mainImage={f >= 14 ? 1 : 0}
      />
    </Panel>
  );
}
