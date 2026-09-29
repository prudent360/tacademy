import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Application received", robots: { index: false } };

export default function ApplicationThanksPage() {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center gap-5 px-5 py-20 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckIcon className="size-8" /></span>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Application received</h1>
      <p className="text-lg text-muted">Thank you for applying. We&apos;ve emailed you a confirmation, and we&apos;ll be in touch with the outcome, usually within a week.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/courses" className="flex h-12 items-center rounded-lg bg-accent px-6 font-semibold text-white hover:bg-accent-dark">Explore our courses</Link>
        <Link href="/" className="flex h-12 items-center rounded-lg border border-edge-strong bg-white px-6 font-semibold text-ink hover:bg-page">Back to home</Link>
      </div>
    </div>
  );
}
