"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const QUERY = "(min-width: 72rem)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => {
    media.removeEventListener("change", onChange);
  };
}

/**
 * Renders its children only on wide screens, after hydration. The margin doodles live here so
 * phones never parse, style or paint them (they were most of the page's extra DOM).
 */
export function WideOnly({ children }: { children: ReactNode }) {
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
  return wide ? children : null;
}
