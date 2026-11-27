"use client";

import { useEffect } from "react";

/** How far a pupil may move from its rest point, in its SVG's own units. */
const REACH = 3.5;

/**
 * Makes every `.heist-pupil` inside `[data-heist]` look towards the pointer or the last tap.
 * One passive listener, at most one update per frame, transform only. Off with reduced motion.
 */
export function EyeTracker() {
  // Slant the notes only after hydration, so the italic font files are never fetched before
  // first paint (they cost ~0.4s of FCP on a slow phone). See .hand-note in globals.css.
  useEffect(() => {
    document.querySelector<HTMLElement>("[data-heist]")?.setAttribute("data-italic", "");
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    const stage = document.querySelector<HTMLElement>("[data-heist]");
    if (!stage) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const update = () => {
      frame = 0;
      // Looked up each time: the wide-screen doodles mount after hydration.
      for (const pupil of stage.querySelectorAll<SVGGraphicsElement>(".heist-pupil")) {
        // Hidden on this breakpoint: nothing to aim.
        const box = pupil.getBoundingClientRect();
        if (box.width === 0) continue;
        const dx = x - (box.left + box.width / 2);
        const dy = y - (box.top + box.height / 2);
        const dist = Math.hypot(dx, dy) || 1;
        const pull = Math.min(1, dist / 240) * REACH;
        pupil.style.transform = `translate(${String((dx / dist) * pull)}px, ${String((dy / dist) * pull)}px)`;
      }
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
