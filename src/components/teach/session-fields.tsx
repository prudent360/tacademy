"use client";

import { useState } from "react";
import { Input, Textarea } from "@/components/forms";
import type { SessionMode } from "@/db/schema";

/** Class form fields; shows the joining link or the venue depending on the format. */
export function SessionFields({ defaults, repeat = false }: {
  defaults: { title?: string; description?: string; mode: SessionMode; startsAt?: string; durationMinutes?: number; meetingUrl?: string | null; venue?: string; recordingUrl?: string | null };
  repeat?: boolean;
}) {
  const [mode, setMode] = useState<SessionMode>(defaults.mode);
  return (
    <>
      <Input label="Title" name="title" defaultValue={defaults.title} placeholder="Week 1: Introduction" required />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold text-ink">Format</legend>
        <div className="flex flex-wrap gap-2">
          {(["virtual", "physical"] as const).map((m) => (
            <label key={m} className={`flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-semibold ${mode === m ? "border-accent bg-accent-soft text-accent-ink" : "border-edge-strong text-body"}`}>
              <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
              {m === "virtual" ? "Live online" : "In person"}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Starts" name="startsAt" type="datetime-local" defaultValue={defaults.startsAt} required />
        <Input label="Duration (minutes)" name="durationMinutes" type="number" min={15} max={720} step={15} defaultValue={defaults.durationMinutes ?? 120} required />
      </div>
      {mode === "virtual" ? (
        <Input key="meeting" label="Joining link" name="meetingUrl" type="url" defaultValue={defaults.meetingUrl ?? ""} placeholder="https://zoom.us/j/… or https://meet.google.com/…" hint="Shown to enrolled students and included in reminders." />
      ) : (
        <Input key="venue" label="Venue" name="venue" defaultValue={defaults.venue} placeholder="Lab 2, Innovation Hub, 12 High Street" required />
      )}
      <Textarea label="Notes for students" name="description" defaultValue={defaults.description} rows={3} hint="Optional: what to prepare or bring." />
      {defaults.recordingUrl !== undefined && <Input label="Recording link" name="recordingUrl" type="url" defaultValue={defaults.recordingUrl ?? ""} hint="Add after class so students can rewatch." />}
      {repeat && (
        <div className="grid items-end gap-5 sm:grid-cols-2">
          <Input label="Repeat weekly for" name="repeatWeeks" type="number" min={1} max={24} defaultValue={1} hint="Number of weeks, including this one." />
          <label className="flex items-center gap-3 pb-3 text-sm font-semibold text-ink">
            <input type="checkbox" name="numberTitles" defaultChecked className="size-5 accent-accent" /> Number the titles (Week 1, Week 2…)
          </label>
        </div>
      )}
    </>
  );
}
