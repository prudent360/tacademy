"use client";

import { useState } from "react";

/**
 * A segmented choice (submitted as `name`) that shows the matching panel. The other panels stay in
 * the form, just hidden, so switching back and forth never loses what's been entered or saved.
 */
export function ChoicePanels<T extends string>({ name, legend, options, initial, panels }: { name: string; legend: string; options: { value: T; label: string }[]; initial: T; panels: Partial<Record<T, React.ReactNode>> }) {
  const [choice, setChoice] = useState(initial);
  return (
    <>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-ink">{legend}</legend>
        <div className="inline-flex w-fit flex-wrap rounded-lg border border-edge-strong bg-panel p-1">
          {options.map((o) => (
            <label key={o.value} className="cursor-pointer rounded-md px-4 py-1.5 text-sm font-semibold text-muted has-[:checked]:bg-surface has-[:checked]:text-accent-ink has-[:checked]:shadow-sm">
              <input type="radio" name={name} value={o.value} checked={choice === o.value} onChange={() => setChoice(o.value)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      {options.map((o) => panels[o.value] ? <div key={o.value} hidden={choice !== o.value} className="flex flex-col gap-5">{panels[o.value]}</div> : null)}
    </>
  );
}
