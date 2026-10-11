"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

/**
 * Cloudflare's bot check. It adds a hidden "cf-turnstile-response" field to the surrounding form,
 * which the server action verifies. Tokens work once, so it fetches a fresh one after every submit.
 */
export function Turnstile({ siteKey, action }: { siteKey: string; action: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const render = useCallback(() => {
    if (!ref.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(ref.current, { sitekey: siteKey, action, theme: "auto", size: "flexible" });
  }, [siteKey, action]);

  useEffect(() => {
    // The script may already be loaded, e.g. when React remounts this in development.
    render();
    const form = ref.current?.closest("form");
    // Reset after the form has read the current token, ready for the next attempt.
    const onSubmit = () => setTimeout(() => { if (widgetId.current) window.turnstile?.reset(widgetId.current); }, 0);
    form?.addEventListener("submit", onSubmit);
    return () => {
      form?.removeEventListener("submit", onSubmit);
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [render]);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={render} />
      <div ref={ref} className="min-h-[65px]" />
    </>
  );
}
