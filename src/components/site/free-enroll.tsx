"use client";

import { enroll } from "@/app/actions/enroll";
import { ActionForm, SubmitButton } from "@/components/forms";

export function FreeEnroll({ cohortId, signedIn }: { cohortId: number; signedIn: boolean }) {
  return (
    <ActionForm action={enroll.bind(null, cohortId)} className="flex flex-col gap-3">
      <p className="font-display text-3xl font-bold tracking-tight text-emerald-700">Free</p>
      <SubmitButton pendingText="Enrolling…">{signedIn ? "Enrol for free" : "Sign in to enrol"}</SubmitButton>
    </ActionForm>
  );
}
