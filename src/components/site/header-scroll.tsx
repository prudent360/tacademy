"use client";

import { useEffect } from "react";

/** How far (px) the page scrolls before the header finishes turning into the floating pill. */
const RANGE = 120;

/** Drives the header's scroll animation: sets `--nav-p` from 0 to 1 over the first scroll, and marks it once scrolled. */
export function HeaderScrollState() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".site-header");
    if (!header) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      header.style.setProperty("--nav-p", Math.min(1, Math.max(0, window.scrollY / RANGE)).toFixed(3));
      header.toggleAttribute("data-scrolled", window.scrollY > 8);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, []);
  return null;
}
