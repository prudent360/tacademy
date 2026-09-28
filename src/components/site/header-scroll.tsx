"use client";

import { useEffect } from "react";

/** Marks the site header once the page is scrolled, so it turns solid after leaving a dark hero. */
export function HeaderScrollState() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".site-header");
    if (!header) return;
    const update = () => header.toggleAttribute("data-scrolled", window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return null;
}
