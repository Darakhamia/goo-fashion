import "./styles/app.css";
import "./fonts";
import React from "react";
import { Composition } from "remotion";
import { Promo } from "./promo/Promo";
import { DURATION } from "./promo/timeline";
import type { Format } from "./promo/kit";
import { Card, CARD } from "./card/Card";

export const Root: React.FC = () => (
  <>
    <Composition id="GOO-16x9" component={Promo} durationInFrames={DURATION} fps={30} width={1920} height={1080} defaultProps={{ format: "16x9" as Format }} />
    <Composition id="GOO-1x1" component={Promo} durationInFrames={DURATION} fps={30} width={1080} height={1080} defaultProps={{ format: "1x1" as Format }} />
    <Composition id="GOO-9x16" component={Promo} durationInFrames={DURATION} fps={30} width={1080} height={1920} defaultProps={{ format: "9x16" as Format, sound: true }} />
    <Composition id="Card" component={Card} durationInFrames={CARD.frames} fps={CARD.fps} width={CARD.W} height={CARD.H} defaultProps={{}} />
  </>
);
