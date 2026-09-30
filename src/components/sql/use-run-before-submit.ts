"use client";

import { useEffect, useRef } from "react";

/**
 * Holds a form's submission until a query has been run, then submits it again. `pending` says whether a
 * run is still needed; `run` does it and says whether submitting should go ahead.
 */
export function useRunBeforeSubmit(anchor: React.RefObject<HTMLElement | null>, pending: () => boolean, run: () => Promise<boolean>) {
  const latest = useRef({ pending, run });
  useEffect(() => { latest.current = { pending, run }; });
  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const onSubmit = (event: SubmitEvent) => {
      if (!latest.current.pending()) return;
      event.preventDefault();
      const submitter = event.submitter;
      void latest.current.run().then(async (ok) => {
        if (!ok) return;
        // Let React put the new result into the form's fields before it's sent.
        await new Promise((resolve) => setTimeout(resolve, 50));
        form.requestSubmit(submitter instanceof HTMLButtonElement ? submitter : undefined);
      });
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [anchor]);
}
