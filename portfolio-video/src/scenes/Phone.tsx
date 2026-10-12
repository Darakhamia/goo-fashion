// Scene 6: a phone rises in front of the receding page with the builder's
// phone layout; the look settles onto the board piece by piece.
import React from "react";
import { useCurrentFrame } from "remotion";
import type { Layout } from "../layout";
import { easeInOut, easeOut, mix, ramp, settle } from "../motion";
import { PhoneFrame, PHONE, PHONE_H, PHONE_W } from "../ui/PhoneFrame";
import { MobileBuilder } from "../ui/app/MobileBuilder";
import { LOOK, MOBILE_STRIP } from "../fixtures/story";

const LANDS = [22, 26, 30, 34, 38];

export function PhoneScene({ L }: { L: Layout }) {
  const f = useCurrentFrame();
  const sc = L.phone.scale;
  const x = (L.W - PHONE_W * sc) / 2;
  const y = (L.H - PHONE_H * sc) / 2;
  const rise = Math.min(1.02, settle(f, 2, { damping: 20, stiffness: 90, mass: 1 }));
  const leave = ramp(f, 72, 90, easeInOut);
  const landed = LOOK.filter((_, k) => f >= LANDS[k]);
  const pieces = landed.map((p, k) => ({ product: p.product, land: Math.min(1, settle(f, LANDS[k], { damping: 15, stiffness: 130 })) }));
  const last = landed.length - 1;
  const relayout = last >= 0 ? Math.min(1, settle(f, LANDS[last], { damping: 20, stiffness: 120 })) : 1;
  let total = 0;
  landed.forEach((p, k) => {
    total += p.product.priceMin * ramp(f, LANDS[k], LANDS[k] + 12, easeOut);
  });
  const picked = new Set(landed.map((p) => p.product.id));
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translateY(${mix(L.H * 0.75, 0, rise) + 60 * leave}px) scale(${sc})`,
        transformOrigin: "0 0",
        opacity: 1 - leave,
      }}
    >
      <PhoneFrame>
        <MobileBuilder
          width={PHONE.screenW}
          height={PHONE.appH}
          pieces={pieces}
          relayout={relayout}
          total={total}
          strip={MOBILE_STRIP}
          picked={picked}
          stripScroll={mix(0, 130, ramp(f, 22, 44, easeInOut))}
        />
      </PhoneFrame>
    </div>
  );
}
