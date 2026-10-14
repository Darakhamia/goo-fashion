// Beat 6: the AI stylist. Everything is the real phone sheet:
// - stylist-open.png, the sheet as it opens;
// - stylist-type-00…31.png, the input bar after each keystroke of the question;
// - stylist-sent.png, the question sent and the typing dots;
// - stylist-reply.png, the scripted reply with its four pieces and "Build this look".
// The camera starts close on the input while the question is typed, pulls back
// to the whole sheet when it is sent, and pushes in on the look as the reply
// rises in, piece by piece, from its own capture.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeInOut, easeOut, mix, ramp } from "../../motion";
import { M, PAPER, Shot, rand, type Format, SIZE } from "../kit";
import { Phone } from "../Device";
import { Sfx, type SfxName } from "../Sfx";

const S = M.stylist;
const SCREEN = S.size; // 390 × 844 CSS px

const TYPE_FROM = 6;
const SEND = 54;
const PULL = [57, 80] as const;
const REPLY = 98;

/** Frame at which the i-th character appears: a quick, slightly uneven hand. */
const charAt = (i: number) => TYPE_FROM + i * 1.2 + (rand(i + 101) - 0.5) * 0.8;

const ZOOM: Record<Format, { z0: number; z1: number; z2: number; endY: number }> = {
  // endY: the sheet's header to "Build this look"; vertical shows the whole sheet.
  "16x9": { z0: 3.0, z1: 1.62, z2: 1.9, endY: 326 },
  "1x1": { z0: 2.7, z1: 1.55, z2: 1.9, endY: 326 },
  "9x16": { z0: 2.7, z1: 2.0, z2: 2.15, endY: 422 },
};

export function Stylist({ format, dur }: { format: Format; dur: number }) {
  const f = useCurrentFrame();
  const { W, H } = SIZE[format];
  const Z = ZOOM[format];
  const bar = S.bar;
  const barC = { x: bar.x + bar.w / 2, y: bar.y + bar.h / 2 };

  // Camera: focus point in screen CSS px, and video px per CSS px.
  const pull = ramp(f, PULL[0], PULL[1], easeInOut);
  const push = ramp(f, REPLY - 4, dur, easeInOut);
  let fx = mix(barC.x, 195, pull);
  let fy = mix(barC.y, 340, pull);
  let z = mix(Z.z0, Z.z1, pull);
  fx = mix(fx, 195, push);
  fy = mix(fy, Z.endY, push);
  z = mix(z, Z.z2, push);
  const enter = ramp(f, 0, 8, easeOut);
  z *= mix(0.94, 1, enter);
  const ox = W / 2 - fx * z;
  const oy = H / 2 - fy * z;

  const typed = S.typed.filter((t) => t.chars === 0 || f >= charAt(t.chars - 1)).pop()!;
  const sent = ramp(f, SEND + 2, SEND + 6, (t) => t);
  const replied = f >= REPLY;
  const caretOn = f < SEND && (f < charAt(S.question.length - 1) + 2 || Math.floor(f / 8) % 2 === 0);

  const reveal = (start: number, dy = 26) => {
    const t = ramp(f, start, start + 13, easeOut);
    return { opacity: t, transform: `translateY(${(1 - t) * dy * z}px)` };
  };

  const send = S.send;
  const ripple = ramp(f, SEND, SEND + 12, easeOut);

  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      {/* Sound: a keystroke per character, the send, the pull-back, the answer
          arriving with its pieces and the "Build this look" card. */}
      {S.question.split("").map((ch, i) =>
        ch === " " ? null : <Sfx key={`k${i}`} at={charAt(i)} name={`key-${i % 3}` as SfxName} volume={0.3} />,
      )}
      <Sfx at={SEND} name="pop" volume={0.38} />
      <Sfx at={PULL[0]} name="whoosh-soft" volume={0.22} />
      <Sfx at={REPLY} name="chime" volume={0.3} />
      {S.cards.map((_, i) => (
        <Sfx key={`c${i}`} at={REPLY + 6 + i * 3} name={(["tick", "tick-0", "tick-1", "tick-2"] as SfxName[])[i]} volume={0.14} />
      ))}
      <Sfx at={REPLY + 20} name="pop-2" volume={0.2} />
      <Phone w={SCREEN.w * z} h={SCREEN.h * z} s={z} style={{ left: ox - 11 * z, top: oy - 11 * z, opacity: enter }}>
        {/* Before the send: the open sheet, with the input as typed so far. */}
        {sent < 1 && (
          <>
            <Shot src={S.open} size={SCREEN} scale={z} style={{ left: 0, top: 0 }} />
            <Shot src={typed.image} size={{ w: bar.w, h: bar.h }} scale={z} style={{ left: bar.x * z, top: bar.y * z }} />
            {caretOn && (
              <div
                style={{
                  position: "absolute",
                  left: (bar.x + typed.caret.x) * z,
                  top: (bar.y + typed.caret.y) * z,
                  width: typed.caret.w * z,
                  height: typed.caret.h * z,
                  background: typed.caret.color,
                }}
              />
            )}
            {ripple > 0 && ripple < 1 && (
              <div
                style={{
                  position: "absolute",
                  left: (bar.x + send.x + send.w / 2) * z,
                  top: (bar.y + send.y + send.h / 2) * z,
                  width: send.w * z * (0.6 + ripple * 0.9),
                  height: send.w * z * (0.6 + ripple * 0.9),
                  transform: "translate(-50%, -50%)",
                  borderRadius: "50%",
                  background: `rgba(255, 255, 255, ${0.35 * (1 - ripple)})`,
                }}
              />
            )}
          </>
        )}
        {/* Sent: the question in its bubble, the typing dots. */}
        {sent > 0 && !replied && <Shot src={S.sent} size={SCREEN} scale={z} style={{ left: 0, top: 0, opacity: sent }} />}
        {/* The reply: the same sheet, its new messages rising in from their own capture. */}
        {replied && (
          <>
            <Shot src={S.reply} size={SCREEN} scale={z} style={{ left: 0, top: 0 }} />
            <div style={{ position: "absolute", left: 0, top: 258 * z, width: SCREEN.w * z, height: 345 * z, background: "#fff" }} />
            <Shot src={S.reply} size={SCREEN} crop={S.bubbles[2].rect} scale={z} radius={18 * z} style={{ left: S.bubbles[2].rect.x * z, top: S.bubbles[2].rect.y * z, ...reveal(REPLY) }} />
            {S.cards.map((c, i) => (
              <Shot key={i} src={S.reply} size={SCREEN} crop={c} scale={z} style={{ left: c.x * z, top: c.y * z, ...reveal(REPLY + 6 + i * 3, 40) }} />
            ))}
            <Shot src={S.reply} size={SCREEN} crop={S.look} scale={z} radius={16 * z} style={{ left: S.look.x * z, top: S.look.y * z, ...reveal(REPLY + 20, 30) }} />
          </>
        )}
      </Phone>
    </AbsoluteFill>
  );
}
