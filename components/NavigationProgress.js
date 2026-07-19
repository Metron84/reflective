"use client";

import NextTopLoader from "nextjs-toploader";

/**
 * Route-change progress only (App Router). Does not attach to fetch/XHR,
 * so Concierge chat typing stays independent.
 */
export default function NavigationProgress() {
  return (
    <NextTopLoader
      color="#D8232A"
      height={3}
      showSpinner={false}
      shadow={false}
      showForHashAnchor={false}
      crawl
      crawlSpeed={200}
      speed={200}
      easing="ease"
      zIndex={9999}
    />
  );
}
