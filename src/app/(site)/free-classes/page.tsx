import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, gt, inArray, isNull } from "drizzle-orm";
import { ArrowRight, CalendarIcon, ClockIcon, MonitorIcon, PinIcon, SparkIcon, VideoIcon } from "@/components/icons";
import { HeroHighlight, PageHero, heroButton } from "@/components/site/page-hero";
import { getDb } from "@/db";
import { freeClasses, freeClassSignups, type FreeClass } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { acceptingSignups, seatsLeft } from "@/lib/free-classes";
import { pageMetadata, seoConfig } from "@/lib/seo";
import { formatSessionRange } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await seoConfig();
  return pageMetadata(seo, { title: "Free classes", description: `Join a free live class at ${seo.siteName}. Learn something useful in an hour, meet an instructor, and see how our courses work before you enrol.`, path: "/free-classes" });
}

const WHY = [
  { icon: VideoIcon, title: "Live, not recorded", text: "A real instructor, teaching live. Ask questions as you go." },
  { icon: SparkIcon, title: "Leave with a skill", text: "Each class is hands-on: you'll build or solve something real in about an hour." },
  { icon: CalendarIcon, title: "Try before you enrol", text: "See how we teach, then decide. Everyone who joins gets a discount on the full course." },
];

function ClassCard({ fc, taken, timezone }: { fc: FreeClass; taken: number; timezone: string }) {
  const left = seatsLeft(fc, taken);
  const open = acceptingSignups(fc, taken);
  const start = new Date(fc.startsAt);
  const day = start.toLocaleDateString("en-GB", { day: "numeric", timeZone: timezone });
  const month = start.toLocaleDateString("en-GB", { month: "short", timeZone: timezone });
  return (
    <Link href={`/free-classes/${fc.slug}`} className="group flex flex-col gap-5 rounded-[12px] border border-edge bg-white p-6 transition hover:-translate-y-0.5 hover:border-accent-muted hover:shadow-[0_24px_50px_-30px_rgba(24,19,64,.45)] sm:flex-row sm:items-center">
      <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-[10px] bg-accent text-white">
        <span className="font-display text-3xl font-extrabold leading-none">{day}</span>
        <span className="font-mono text-xs uppercase tracking-[1.4px] text-white/80">{month}</span>
      </div>
      <div className="flex min-w-0 grow flex-col gap-2">
        <h3 className="font-display text-xl font-bold text-ink group-hover:text-accent">{fc.title}</h3>
        <p className="max-w-[640px] text-[15px] leading-relaxed text-muted">{fc.summary}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[13px] text-body">
          <span className="flex items-center gap-1.5"><ClockIcon className="size-4 text-accent" />{formatSessionRange(fc.startsAt, fc.endsAt, timezone)}</span>
          <span className="flex items-center gap-1.5">{fc.mode === "virtual" ? <MonitorIcon className="size-4 text-accent" /> : <PinIcon className="size-4 text-accent" />}{fc.mode === "virtual" ? "Live online" : fc.venue}</span>
          {fc.hostName && <span>with {fc.hostName}</span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-semibold text-emerald-800">Free</span>
        {open ? <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-accent">Save my place <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span> : <span className="text-sm font-semibold text-muted">{left === 0 ? "Full" : "Sign-ups closed"}</span>}
        {open && left !== null && left <= 10 && <span className="text-xs font-semibold text-amber-800">{left} place{left === 1 ? "" : "s"} left</span>}
      </div>
    </Link>
  );
}

export default async function FreeClassesPage() {
  const db = await getDb();
  const settings = await getSettings();
  const upcoming = await db.select().from(freeClasses).where(and(inArray(freeClasses.status, ["open", "closed"]), gt(freeClasses.endsAt, new Date()))).orderBy(asc(freeClasses.startsAt));
  const counts = upcoming.length ? await db.select({ classId: freeClassSignups.classId, n: count() }).from(freeClassSignups).where(and(inArray(freeClassSignups.classId, upcoming.map((c) => c.id)), isNull(freeClassSignups.cancelledAt))).groupBy(freeClassSignups.classId) : [];
  const taken = (id: number) => counts.find((c) => c.classId === id)?.n ?? 0;
  const next = upcoming.find((fc) => acceptingSignups(fc, taken(fc.id)));

  return (
    <>
      <PageHero
        eyebrow="Free classes"
        title={<>Try a live class, <HeroHighlight>free</HeroHighlight></>}
        lead="Spend an hour with one of our instructors, learn something you can use straight away, and see how our courses work before you commit."
        actions={next ? <>
          <Link href={`/free-classes/${next.slug}`} className={heroButton.primary}>Join the next one <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link>
          <Link href="/courses" className={heroButton.secondary}>Browse courses</Link>
        </> : <Link href="/courses" className={heroButton.secondary}>Browse courses</Link>}
      />

      <div className="mx-auto flex max-w-[1200px] flex-col gap-16 px-5 py-14 sm:px-8 md:py-20">
        <section id="upcoming" className="flex scroll-mt-28 flex-col gap-6">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink">Coming up</h2>
          {upcoming.length ? (
            <div className="flex flex-col gap-4">{upcoming.map((fc) => <ClassCard key={fc.id} fc={fc} taken={taken(fc.id)} timezone={settings.timezone} />)}</div>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-[12px] border border-dashed border-edge-strong bg-panel p-8">
              <h3 className="font-display text-xl font-bold text-ink">No free classes scheduled right now</h3>
              <p className="max-w-[560px] text-[15px] text-body">New dates are added regularly. In the meantime, explore our courses or download a curriculum.</p>
              <Link href="/courses" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:text-accent-dark">Browse courses <ArrowRight className="size-4" /></Link>
            </div>
          )}
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {WHY.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex flex-col gap-3 rounded-[12px] border border-edge bg-panel p-6">
              <span className="flex size-11 items-center justify-center rounded-[8px] bg-accent-soft text-accent"><Icon className="size-5" /></span>
              <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
              <p className="text-[15px] leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
