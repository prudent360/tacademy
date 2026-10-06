import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq, isNull } from "drizzle-orm";
import { ArrowRight, CalendarIcon, CheckCircleIcon, CheckIcon, ChevronRight, ClockIcon, MonitorIcon, PinIcon, UserIcon, UsersIcon } from "@/components/icons";
import { FreeClassSignupForm } from "@/components/site/free-class-signup-form";
import { PageHero, heroButton } from "@/components/site/page-hero";
import { RichText } from "@/components/site/rich-text";
import { getDb } from "@/db";
import { courses, freeClasses, freeClassSignups, type FreeClass } from "@/db/schema";
import { can, getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { acceptingSignups, seatsLeft } from "@/lib/free-classes";
import { pageMetadata, seoConfig } from "@/lib/seo";
import { absoluteUrl, jsonLd } from "@/lib/site";
import { formatSessionRange } from "@/lib/time";
import { visitorCountry } from "@/lib/visitor";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ joined?: string; again?: string }> };

async function findClass(slug: string): Promise<FreeClass | null> {
  const [fc] = await (await getDb()).select().from(freeClasses).where(eq(freeClasses.slug, slug));
  if (!fc) return null;
  // Drafts are only visible to the team, as a preview.
  if (fc.status === "draft") {
    const user = await getCurrentUser();
    if (!user || !(await can(user, "free_classes.manage"))) return null;
  }
  return fc;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [fc, seo] = await Promise.all([findClass((await params).slug), seoConfig()]);
  if (!fc) return {};
  return { ...pageMetadata(seo, { title: `${fc.title} (free class)`, description: fc.summary, path: `/free-classes/${fc.slug}` }), ...(fc.status === "draft" ? { robots: { index: false } } : {}) };
}

export default async function FreeClassPage({ params, searchParams }: Props) {
  const [{ slug }, { joined, again }] = await Promise.all([params, searchParams]);
  const fc = await findClass(slug);
  if (!fc) notFound();
  const db = await getDb();
  const [[{ taken }], settings, country, [course]] = await Promise.all([
    db.select({ taken: count() }).from(freeClassSignups).where(and(eq(freeClassSignups.classId, fc.id), isNull(freeClassSignups.cancelledAt))),
    getSettings(),
    visitorCountry(),
    fc.courseId ? db.select().from(courses).where(and(eq(courses.id, fc.courseId), eq(courses.published, true))) : Promise.resolve([]),
  ]);
  const accepting = acceptingSignups(fc, taken);
  const finished = new Date(fc.endsAt) < new Date();
  const left = seatsLeft(fc, taken);
  const when = formatSessionRange(fc.startsAt, fc.endsAt, settings.timezone);
  const where = fc.mode === "virtual" ? "Live online" : fc.venue;

  const event = {
    "@context": "https://schema.org",
    "@type": "EducationEvent",
    name: fc.title,
    description: fc.summary,
    startDate: fc.startsAt.toISOString(),
    endDate: fc.endsAt.toISOString(),
    eventAttendanceMode: fc.mode === "virtual" ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    isAccessibleForFree: true,
    location: fc.mode === "virtual" ? { "@type": "VirtualLocation", url: absoluteUrl(`/free-classes/${fc.slug}`) } : { "@type": "Place", name: fc.venue, address: fc.venue },
    organizer: { "@type": "Organization", name: settings.siteName, url: absoluteUrl("/") },
    offers: { "@type": "Offer", price: 0, priceCurrency: settings.currencies[0] ?? "NGN", availability: accepting ? "https://schema.org/InStock" : "https://schema.org/SoldOut", url: absoluteUrl(`/free-classes/${fc.slug}`) },
    ...(fc.hostName ? { performer: { "@type": "Person", name: fc.hostName } } : {}),
  };

  return (
    <>
      {fc.status !== "draft" && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(event) }} />}
      <PageHero
        breadcrumb={<nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5"><Link href="/free-classes" className="font-semibold text-white/80 transition hover:text-white">Free classes</Link><ChevronRight className="size-4 shrink-0 text-white/40" /><span aria-current="page" className="truncate">{fc.title}</span></nav>}
        eyebrow={finished ? "Free class · finished" : "Free class"}
        title={fc.title}
        lead={fc.summary}
        actions={accepting && !joined ? <>
          <a href="#signup" className={heroButton.primary}>Save my free place <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></a>
          <Link href="/free-classes" className={heroButton.secondary}>All free classes</Link>
        </> : <Link href="/free-classes" className={heroButton.secondary}>See all free classes</Link>}
        facts={[
          { icon: CalendarIcon, label: "When", value: when },
          { icon: fc.mode === "virtual" ? MonitorIcon : PinIcon, label: "Where", value: where },
          ...(fc.hostName ? [{ icon: UserIcon, label: "Host", value: fc.hostName }] : []),
          { icon: UsersIcon, label: "Price", value: left !== null && accepting ? `Free · ${left} place${left === 1 ? "" : "s"} left` : "Free" },
        ]}
      />

      {fc.status === "draft" && <p className="bg-amber-50 px-5 py-3 text-center text-sm font-semibold text-amber-900">Preview: this class is a draft, so only your team can see it.</p>}

      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-14 sm:px-8 md:py-20 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-12">
          {fc.takeaways.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-2xl font-bold tracking-tight text-ink">What you&apos;ll learn</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {fc.takeaways.map((item) => (
                  <li key={item} className="flex items-start gap-3 rounded-[5px] border border-edge bg-white p-4 text-[15px] leading-relaxed text-body">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><CheckIcon className="size-3.5" /></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {fc.description && (
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-2xl font-bold tracking-tight text-ink">About this class</h2>
              <RichText text={fc.description} />
            </section>
          )}
          {fc.hostName && (
            <section className="flex items-center gap-4 rounded-[5px] border border-edge bg-panel p-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent font-display text-lg font-bold text-white">{fc.hostName.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
              <div><p className="text-xs font-semibold uppercase tracking-[1.2px] text-muted">Your host</p><p className="font-display text-lg font-bold text-ink">{fc.hostName}</p>{fc.hostTitle && <p className="text-sm text-muted">{fc.hostTitle}</p>}</div>
            </section>
          )}
          {course && (
            <section className="flex flex-col gap-3 rounded-[5px] border border-edge bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[1.2px] text-accent">Want to go further?</p>
              <h2 className="font-display text-xl font-bold text-ink">{course.title}</h2>
              <p className="text-[15px] text-body">{course.summary}</p>
              <p className="text-sm text-muted">Everyone who joins this class gets a personal discount code for the full course.</p>
              <Link href={`/courses/${course.slug}`} className="inline-flex items-center gap-1.5 font-semibold text-accent hover:text-accent-dark">See the course <ArrowRight className="size-4" /></Link>
            </section>
          )}
        </div>

        <aside id="signup" className="scroll-mt-28 lg:sticky lg:top-28 lg:self-start">
          <div className="flex flex-col gap-5 rounded-[12px] border border-edge bg-white p-6 shadow-[0_30px_80px_-50px_rgba(24,19,64,.45)] sm:p-7">
            {joined ? (
              <div className="flex flex-col items-start gap-4">
                <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircleIcon className="size-7" /></span>
                <h2 className="font-display text-2xl font-bold text-ink">{again ? "You're already signed up" : "Your place is saved!"}</h2>
                <p className="text-[15px] leading-relaxed text-body">{again ? "You signed up with this email before, so your place is safe. Check your inbox for the joining details." : "We've emailed you the details. We'll remind you the day before and just before it starts."}</p>
                <a href={`/free-classes/${fc.slug}/calendar.ics`} className="inline-flex h-11 items-center gap-2 rounded-full border border-edge-strong px-5 text-sm font-semibold text-ink hover:bg-page"><CalendarIcon className="size-4" /> Add to calendar</a>
              </div>
            ) : accepting ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <h2 className="font-display text-2xl font-bold text-ink">Save your free place</h2>
                  <p className="flex items-center gap-2 text-sm text-muted"><ClockIcon className="size-4 text-accent" /> {when}</p>
                  {left !== null && left <= 10 && <p className="text-sm font-semibold text-amber-800">Only {left} place{left === 1 ? "" : "s"} left</p>}
                </div>
                <FreeClassSignupForm classId={fc.id} defaultCountry={country ?? undefined} />
              </>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <h2 className="font-display text-2xl font-bold text-ink">{finished ? "This class has finished" : left === 0 ? "This class is full" : "Sign-ups have closed"}</h2>
                <p className="text-[15px] leading-relaxed text-body">{finished ? "Thanks to everyone who came." : "We run free classes regularly."} See what&apos;s coming up next.</p>
                <Link href="/free-classes" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:text-accent-dark">Upcoming free classes <ArrowRight className="size-4" /></Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
