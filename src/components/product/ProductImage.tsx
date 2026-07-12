"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { upscaleImageUrl } from "@/lib/image";

type ProductImageProps = Omit<ImageProps, "src" | "onError"> & { src: string };

/**
 * Product photo that requests a higher-resolution variant first and falls back
 * to the exact stored URL if the CDN won't serve the upscaled size. This keeps
 * catalog photos sharp where the CDN supports it while guaranteeing that a
 * failed rewrite can never leave a product with a blank/broken image.
 */
export default function ProductImage({ src, ...rest }: ProductImageProps) {
  const upscaled = upscaleImageUrl(src);
  const [current, setCurrent] = useState(upscaled);

  // Reset the candidate when the incoming src changes (variant/color switch),
  // derived during render per React's recommended pattern for prop-synced state.
  const [seenSrc, setSeenSrc] = useState(src);
  if (seenSrc !== src) {
    setSeenSrc(src);
    setCurrent(upscaled);
  }

  return (
    // `alt` is required by ImageProps and always supplied via {...rest}.
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      {...rest}
      src={current}
      onError={() => {
        if (current !== src) setCurrent(src);
      }}
    />
  );
}
