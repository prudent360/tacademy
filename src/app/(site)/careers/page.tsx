import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { ArrowRight, AwardIcon, BriefcaseIcon, ClockIcon, LayersIcon, MailIcon, MonitorIcon, SparkIcon, UsersIcon } from "@/components/icons";
import { HeroHighlight, PageHero, heroButton } from "@/components/site/page-hero";
import { getDb } from "@/db";
import { jobOpenings, type JobOpening } from "@/db/schema";
import { isAccepting, JOB_MODE_LABEL, JOB_TYPE_LABEL, todayIso } from "@/lib/careers";
import { getSettings } from "@/lib/data";
import { pageMetadata, seoConfig } from "@/lib/seo";
import { formatDateOnly } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await seoConfig();
  return pageMetadata(seo, { title: "Careers", description: `Join the team at ${seo.siteName} and help people build careers in tech. See our open roles and apply online.`, path: "/careers" });
}

const VALUES = [
  { icon: UsersIcon, title: "Work that changes lives", text: "Every role here helps someone learn a skill, land a job or change career. You'll see the impact of your work." },
  { icon: SparkIcon, title: "Learn as you go", text: "We're an academy, so learning is part of the job: free access to our courses and time to grow your skills." },
  { icon: MonitorIcon, title: "Flexible by default", text: "Many roles are remote or hybrid. We care about what you get done, not where you sit." },
  { icon: AwardIcon, title: "Room to grow", text: "We're growing fast. Take ownership early, try new things and shape how the academy works." },
];

const STEPS = [
  { title: "Apply", text: "Send your CV and a few lines about why the role suits you. It takes about ten minutes." },
  { title: "Chat with us", text: "If it's a match, we'll invite you to a short call to get to know each other." },
  { title: "Show your skills", text: "Depending on the role, a practical task or a deeper interview with the team." },
  { title: "Offer", text: "We move quickly and keep you updated at every step, whatever the outcome." },
];

function RoleCard({ job }: { job: JobOpening }) {
  const chips = [JOB_TYPE_LABEL[job.employmentType], JOB_MODE_LABEL[job.workMode], job.location].filter(Boolean);
  return (
    <Link href={`/careers/${job.slug}`} className="group flex flex-col gap-4 rounded-[5px] border border-edge bg-white p-6 transition hover:-translate-y-0.5 hover:border-accent-muted hover:shadow-[0_24px_50px_-30px_rgba(24,19,64,.45)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="font-display text-xl font-bold text-ink group-hover:text-accent">{job.title}</h3>
        {job.summary && <p className="max-w-[680px] text-[15px] leading-relaxed text-muted">{job.summary}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {chips.map((c) => <span key={c} className="rounded-full bg-page px-3 py-1 text-[13px] font-semibold text-body">{c}</span>)}
          {job.salary && <span className="rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-semibold text-emerald-800">{job.salary}</span>}
          {job.closesOn && <span className="text-[13px] text-muted">Closes {formatDateOnly(job.closesOn)}</span>}
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-2 text-[15px] font-semibold text-accent">View role <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
    </Link>
  );
}

export default async function CareersPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const [{ team }, settings] = await Promise.all([searchParams, getSettings()]);
  const today = todayIso();
  const jobs = (await (await getDb()).select().from(jobOpenings).where(eq(jobOpenings.status, "open")).orderBy(asc(jobOpenings.sortOrder), desc(jobOpenings.publishedAt)))
    .filter((j) => isAccepting(j, today));
  const teams = [...new Set(jobs.map((j) => j.department).filter(Boolean))].sort();
  const shown = team ? jobs.filter((j) => j.department === team) : jobs;
  const groups = teams.length > 1 && !team
    ? teams.map((t) => ({ team: t, jobs: shown.filter((j) => j.department === t) })).concat(shown.some((j) => !j.department) ? [{ team: "Other roles", jobs: shown.filter((j) => !j.department) }] : [])
    : [{ team: "", jobs: shown }];
  const remote = jobs.filter((j) => j.workMode !== "onsite").length;

  return (
    <>
      <PageHero
        eyebrow="Careers"
        title={<>Help people build <HeroHighlight>careers in tech</HeroHighlight></>}
        lead={`Join the team behind ${settings.siteName}. We teach practical, job-ready skills to people across the world, and we're looking for people who care about doing that brilliantly.`}
        actions={<>
          <a href="#roles" className={heroButton.primary}>See open roles <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></a>
          <a href="#how" className={heroButton.secondary}>How we hire</a>
        </>}
        facts={[
          { icon: BriefcaseIcon, label: "Open roles", value: jobs.length ? String(jobs.length) : "None right now" },
          { icon: MonitorIcon, label: "Remote-friendly", value: jobs.length ? `${remote} of ${jobs.length} roles` : "Many roles" },
        ]}
        aside={
          <div className="relative mx-auto w-full max-w-[460px]">
            <div className="absolute -inset-6 -z-10 rounded-full bg-accent/30 blur-3xl" aria-hidden="true" />
            <div className="flex flex-col gap-3 rounded-[5px] bg-white/[.08] p-4 ring-1 ring-white/15 backdrop-blur">
              <p className="flex items-center gap-2 px-1 text-sm font-semibold text-white/80"><span className="size-2 animate-pulse rounded-full bg-emerald-400" /> We&apos;re hiring</p>
              {(jobs.length ? jobs.slice(0, 3) : [null]).map((job, i) => (
                <div key={job?.id ?? i} className="flex items-center gap-3 rounded-[5px] bg-white p-4 text-ink shadow-[0_18px_40px_-24px_rgba(0,0,0,.6)]">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[5px] bg-accent-soft text-accent">{job ? <BriefcaseIcon className="size-5" /> : <MailIcon className="size-5" />}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{job ? job.title : "Open application"}</p>
                    <p className="truncate text-[13px] text-muted">{job ? [JOB_TYPE_LABEL[job.employmentType], JOB_MODE_LABEL[job.workMode], job.location].filter(Boolean).join(" · ") : "Send us your CV any time"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
      />

      <section id="roles" className="scroll-mt-28 mx-auto flex max-w-[1100px] flex-col gap-8 px-5 py-16 sm:px-8 md:py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-accent">Open roles</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">{jobs.length ? "Find your next role" : "No open roles right now"}</h2>
          </div>
          {teams.length > 1 && (
            <nav aria-label="Filter by team" className="flex flex-wrap gap-1.5">
              <Link href="/careers#roles" scroll={false} className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold ${!team ? "bg-ink text-white" : "bg-page text-body hover:bg-edge"}`}>All teams</Link>
              {teams.map((t) => <Link key={t} href={`/careers?team=${encodeURIComponent(t)}#roles`} scroll={false} className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold ${team === t ? "bg-ink text-white" : "bg-page text-body hover:bg-edge"}`}>{t}</Link>)}
            </nav>
          )}
        </div>
        {shown.length ? (
          groups.filter((g) => g.jobs.length).map((g) => (
            <div key={g.team || "all"} className="flex flex-col gap-3">
              {g.team && <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted"><LayersIcon className="size-4" /> {g.team} <span className="text-muted/70">({g.jobs.length})</span></h3>}
              {g.jobs.map((job) => <RoleCard key={job.id} job={job} />)}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-[5px] border border-dashed border-edge-strong bg-panel px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent"><BriefcaseIcon className="size-6" /></span>
            <p className="max-w-[520px] text-[15px] leading-relaxed text-muted">We don&apos;t have any openings at the moment, but we&apos;re always happy to hear from great people.{settings.supportEmail && <> Send your CV to <a href={`mailto:${settings.supportEmail}?subject=${encodeURIComponent("Open application")}`} className="font-semibold text-accent hover:text-accent-dark">{settings.supportEmail}</a> and we&apos;ll keep it on file.</>}</p>
          </div>
        )}
      </section>

      <section className="border-y border-line bg-panel">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-16 sm:px-8 md:py-20">
          <div className="flex max-w-[640px] flex-col gap-3">
            <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-accent">Why join us</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">Build something that matters</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex flex-col gap-3 rounded-[5px] border border-edge bg-white p-6">
                <span className="flex size-11 items-center justify-center rounded-[5px] bg-accent-soft text-accent"><Icon className="size-5" /></span>
                <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
                <p className="text-[15px] leading-6 text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-28 mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-16 sm:px-8 md:py-20">
        <div className="flex max-w-[640px] flex-col gap-3">
          <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-accent">How we hire</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">Simple, quick and respectful of your time</h2>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3 rounded-[5px] border border-edge bg-white p-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-accent font-mono text-sm font-semibold text-white">0{i + 1}</span>
              <h3 className="font-display text-lg font-bold text-ink">{step.title}</h3>
              <p className="text-[15px] leading-6 text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="flex items-center gap-2 text-sm text-muted"><ClockIcon className="size-4" /> We reply to every application. <UsersIcon className="ml-3 size-4" /> We welcome applicants from every background.</p>
      </section>
    </>
  );
}
