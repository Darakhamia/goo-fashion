// Shim for next/link: a plain anchor. Nothing in the video navigates.
import React from "react";

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string };
  prefetch?: boolean;
  scroll?: boolean;
  replace?: boolean;
};

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch: _p, scroll: _s, replace: _r, ...rest },
  ref,
) {
  return <a ref={ref} href={typeof href === "string" ? href : href.pathname ?? "#"} {...rest} />;
});

export default Link;
