"use client";

import { useEffect, useState } from "react";

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$";

/**
 * Text that "decodes" from random characters into the real value, left to right, once it mounts.
 * Spaces and punctuation stay put so the shape holds. Screen readers and reduced-motion users get the text as is.
 */
export function ScrambleText({ text, delay = 0, duration = 800 }: { text: string; delay?: number; duration?: number }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now() + delay;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      // Swap the random characters every ~50ms rather than every frame, so it reads as flicker, not noise.
      if (now - last > 50 || t === 1) {
        last = now;
        const fixed = Math.floor(t * text.length);
        setShown([...text].map((ch, i) => (i < fixed || /[\s,.:/+-]/.test(ch) ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(""));
      }
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, delay, duration]);
  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}
