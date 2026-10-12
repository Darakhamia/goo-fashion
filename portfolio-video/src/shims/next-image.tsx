// Shim for next/image: Remotion's <Img>, which holds the frame until the
// photo has loaded. `fill` becomes the absolute box next/image would draw.
import React from "react";
import { Img } from "remotion";

export type ImageProps = {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  unoptimized?: boolean;
  quality?: number;
  className?: string;
  style?: React.CSSProperties;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  onError?: React.ReactEventHandler<HTMLImageElement>;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
};

export default function NextImage({
  fill,
  sizes: _sizes,
  priority: _priority,
  unoptimized: _unoptimized,
  quality: _quality,
  referrerPolicy: _referrer,
  style,
  ...rest
}: ImageProps) {
  const fillStyle: React.CSSProperties = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
    : {};
  return <Img {...rest} style={{ ...fillStyle, ...style }} />;
}
