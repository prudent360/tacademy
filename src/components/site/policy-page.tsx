import Link from "next/link";
import type { ReactNode } from "react";
import type { Settings } from "@/db/schema";
import { ArrowRight, MailIcon } from "@/components/icons";
import { PageHero } from "./page-hero";

export type PolicySection = {
  id: string;
  title: string;
  content: ReactNode;
};

export function PolicyPage({
  eyebrow,
  title,
  summary,
  updated,
  sections,
  settings,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  sections: PolicySection[];
  settings: Pick<Settings, "siteName" | "supportEmail">;
}) {
  const readMinutes = Math.max(3, Math.ceil(sections.length * 0.6));
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} lead={summary}>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60">
          <span>Last updated: {updated}</span><span aria-hidden="true">·</span><span>About {readMinutes} min read</span><span aria-hidden="true">·</span><span>{sections.length} sections</span>
        </div>
      </PageHero>

      <div className="mx-auto grid max-w-[1120px] gap-12 px-5 py-14 sm:px-8 md:py-20 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-36 lg:self-start">
          <p className="font-display text-sm font-bold text-ink">On this page</p>
          <nav aria-label={`${title} sections`} className="mt-4 border-l border-edge">
            {sections.map((section, index) => <a key={section.id} href={`#${section.id}`} className="block border-l-2 border-transparent py-2 pl-4 text-sm leading-5 text-muted transition hover:border-accent hover:text-accent">{index + 1}. {section.title}</a>)}
          </nav>
        </aside>

        <article className="min-w-0">
          <p className="rounded-2xl border border-accent/15 bg-accent-soft p-5 text-[15px] leading-7 text-body">
            This document applies to the {settings.siteName} website, learning platform, courses and related services. Please read it alongside the other policies linked below.
          </p>
          <div className="mt-10 divide-y divide-line border-t border-line">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-40 py-9 first:pt-0">
                <p className="font-mono text-xs font-semibold text-accent">{String(index + 1).padStart(2, "0")}</p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink md:text-[30px]">{section.title}</h2>
                <div className="policy-copy mt-4 space-y-4 text-[16px] leading-7 text-body">{section.content}</div>
              </section>
            ))}
          </div>
          <div className="mt-4 rounded-[20px] bg-navy p-6 text-white md:p-8">
            <p className="font-display text-xl font-bold">Questions about this policy?</p>
            <p className="mt-2 max-w-xl text-[15px] leading-6 text-white/70">We are happy to explain how this applies to your account, enrolment or data.</p>
            <Link href="/contact" className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-accent hover:bg-accent-soft"><MailIcon className="size-4" /> Contact support <ArrowRight className="size-4" /></Link>
          </div>
          <nav aria-label="Other policies" className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-accent">
            <Link href="/terms" className="hover:text-accent-dark">Terms of use</Link><Link href="/privacy" className="hover:text-accent-dark">Privacy policy</Link><Link href="/refund-policy" className="hover:text-accent-dark">Refund policy</Link><Link href="/cookies" className="hover:text-accent-dark">Cookie policy</Link>
          </nav>
        </article>
      </div>
    </>
  );
}
