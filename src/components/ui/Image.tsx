import NextImage, { type ImageProps } from "next/image";
import { shouldOptimizeImage } from "@/lib/image";

export type { ImageProps };

/**
 * Drop-in replacement for `next/image` that keeps partner-CDN photos out of the
 * Vercel image optimizer.
 *
 * Catalog photos live on the retailers' CDNs, and those CDNs answer the
 * optimizer's server-side fetch with 429 — the user then sees alt text instead
 * of clothes. Rendering them `unoptimized` hands the URL to the browser, which
 * is the client those CDNs actually serve. Our own images (Supabase Storage,
 * Replicate output, `/public`) still go through the optimizer as before.
 *
 * Every `<Image>` in `src/` imports this instead of `next/image`; the lint rule
 * in eslint.config.mjs is what keeps it that way.
 */
export default function Image({ src, unoptimized, referrerPolicy, ...rest }: ImageProps) {
  // A static import (`import hero from "./hero.png"`) is bundled by us and is
  // always safe to optimize; only string URLs need the host check.
  const foreign = typeof src === "string" && !shouldOptimizeImage(src);

  return (
    // `alt` is required by ImageProps and always supplied via {...rest}.
    // eslint-disable-next-line jsx-a11y/alt-text
    <NextImage
      {...rest}
      src={src}
      // A caller asking for `unoptimized` (blob: previews) still gets it; a
      // caller passing `false` must not be able to push a partner URL back
      // through the optimizer, so the two reasons are OR-ed, never overridden.
      unoptimized={unoptimized || foreign}
      // Some retailer CDNs refuse hotlinked requests by Referer. Sending none
      // matches the request shape that measured 200 against Farfetch.
      referrerPolicy={referrerPolicy ?? (foreign ? "no-referrer" : undefined)}
    />
  );
}
