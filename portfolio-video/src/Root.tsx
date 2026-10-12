import "./styles/app.css";
import "./fonts";
import React from "react";
import { AbsoluteFill, Composition, Still } from "remotion";
import { Film } from "./Film";
import { LAYOUTS, type Format } from "./layout";
import { DURATION, POSTER_LOCAL_FRAME } from "./timeline";
import { BuilderScene } from "./scenes/Builder";
import { Caption } from "./ui/Caption";
import { ProductPage } from "./ui/app/ProductPage";
import { FEATURED, FEATURED_STORES } from "./fixtures/story";
import { Card, CARD } from "./card/Card";

/** Debug: logs where "Where to buy" sits on the product page (CSS px). */
function MeasureProduct({ width }: { width: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const root = ref.current!;
    const el = root.querySelector<HTMLElement>('[data-focus="where-to-buy"]')!;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    console.log(`MEASURE width=${width} x=${r.left - rr.left} y=${r.top - rr.top} w=${r.width} h=${r.height} page=${rr.height}`);
  });
  return (
    <div ref={ref} className="dark" style={{ position: "absolute", left: 0, top: 0 }}>
      <ProductPage width={width} product={FEATURED} stores={FEATURED_STORES} rowsIn={[1, 1, 1]} best={1} />
    </div>
  );
}

/** The poster: the builder with the board filled and the total settled. */
function Poster({ format }: { format: Format }) {
  const L = LAYOUTS[format];
  return (
    <AbsoluteFill className="dark" style={{ background: "var(--background)", fontFamily: "var(--font-body)" }}>
      <BuilderScene L={L} poster at={POSTER_LOCAL_FRAME} />
      <Caption text="Build the look" from={0} to={100000} at={60} x={L.caption.x} y={L.caption.y} size={L.caption.size} />
    </AbsoluteFill>
  );
}

export const Root: React.FC = () => (
  <>
    <Composition id="GOO-16x9" component={Film} durationInFrames={DURATION} fps={30} width={1920} height={1080} defaultProps={{ format: "16x9" as Format }} />
    <Composition id="GOO-1x1" component={Film} durationInFrames={DURATION} fps={30} width={1080} height={1080} defaultProps={{ format: "1x1" as Format }} />
    <Composition id="Card" component={Card} durationInFrames={CARD.frames} fps={CARD.fps} width={CARD.W} height={CARD.H} defaultProps={{}} />
    <Still id="Measure-1440" component={MeasureProduct} width={1440} height={1600} defaultProps={{ width: 1440 }} />
    <Still id="Poster-16x9" component={Poster} width={1920} height={1080} defaultProps={{ format: "16x9" as Format }} />
    <Still id="Poster-1x1" component={Poster} width={1080} height={1080} defaultProps={{ format: "1x1" as Format }} />
  </>
);
