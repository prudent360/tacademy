import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon } from "@/components/icons";

export const metadata: Metadata = { title: "You're enrolled", robots: { index: false } };

/** Shown after a free enrolment by someone without an account yet. */
export default async function EnrolConfirmedPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center gap-5 px-5 py-20 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckIcon className="size-8" /></span>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Your place is confirmed</h1>
      <p className="text-lg text-muted">We&apos;ve emailed {email ? <strong className="text-ink">{email}</strong> : "you"} a link to set your password. Use it to sign in and see your timetable, class links and assignments.</p>
      <Link href="/login" className="flex h-12 items-center rounded-lg bg-accent px-6 font-semibold text-white hover:bg-accent-dark">Go to sign in</Link>
    </div>
  );
}
