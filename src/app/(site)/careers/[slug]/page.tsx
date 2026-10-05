import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowRight, BriefcaseIcon, CardIcon, CheckCircleIcon, CheckIcon, ChevronRight, ClockIcon, ExternalIcon, MailIcon, MonitorIcon, PinIcon } from "@/components/icons";
import { JobApplyForm } from "@/components/site/job-apply-form";
import { PageHero, heroButton } from "@/components/site/page-hero";
import { RichText } from "@/components/site/rich-text";
import { getDb } from "@/db";
import { jobOpenings, type JobOpening } from "@/db/schema";
import { can, getCurrentUser } from "@/lib/auth";
import { isAccepting, JOB_MODE_LABEL, JOB_TYPE_LABEL } from "@/lib/careers";
import { getSettings } from "@/lib/data";
import { pageMetadata, seoConfig } from "@/lib/seo";
import { absoluteUrl, jsonLd } from "@/lib/site";
import { formatDateOnly } from "@/lib/time";
import { visitorCountry } from "@/lib/visitor";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ applied?: string }> };

async function findJob(slug: string): Promise<JobOpening | null> {
  const [job] = await (await getDb()).select().from(jobOpenings).where(eq(jobOpenings.slug, slug));
  if (!job) return null;
  // Drafts are only visible to the team, as a preview.
  if (job.status === "draft") {
    const user = await getCurrentUser();
    if (!user || !(await can(user, "careers.manage"))) return null;
  }
  return job;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [job, seo] = await Promise.all([findJob((await params).slug), seoConfig()]);
  if (!job) return {};
  return { ...pageMetadata(seo, { title: `${job.title} (${JOB_TYPE_LABEL[job.employmentType]})`, description: job.summary, path: `/careers/${job.slug}` }), ...(job.status !== "open" ? { robots: { index: false } } : {}) };
}

const GOOGLE_TYPE = { full_time: "FULL_TIME", part_time: "PART_TIME", contract: "CONTRACTOR", internship: "INTERN", volunteer: "VOLUNTEER" } as const;

function List({ title, items, tick }: { title: string; items: string[]; tick?: boolean }) {
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-[16px] leading-relaxed text-body">
            {tick ? <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckIcon className="size-3.5" /></span> : <span aria-hidden="true" className="mt-[11px] size-1.5 shrink-0 rounded-full bg-accent" />}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function JobPage({ params, searchParams }: Props) {
  const [{ slug }, { applied }] = await Promise.all([params, searchParams]);
  const job = await findJob(slug);
  if (!job) notFound();
  const [settings, country] = await Promise.all([getSettings(), visitorCountry()]);
  const accepting = isAccepting(job);
  const where = [JOB_MODE_LABEL[job.workMode], job.location].filter(Boolean).join(" · ");
  const applyHref = job.applyMethod === "email" ? `mailto:${job.applyTarget}?subject=${encodeURIComponent(`Application: ${job.title}`)}` : job.applyMethod === "link" ? job.applyTarget : "#apply";

  const posting = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: [job.summary, job.description, ...job.responsibilities.map((r) => `• ${r}`), ...job.requirements.map((r) => `• ${r}`)].filter(Boolean).join("\n"),
    datePosted: (job.publishedAt ?? job.createdAt).toISOString().slice(0, 10),
    ...(job.closesOn ? { validThrough: `${job.closesOn}T23:59:59Z` } : {}),
    employmentType: GOOGLE_TYPE[job.employmentType],
    hiringOrganization: { "@type": "Organization", name: settings.siteName, sameAs: absoluteUrl("/"), ...(settings.logoUrl ? { logo: absoluteUrl(settings.logoUrl) } : {}) },
    ...(job.workMode === "remote" ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: job.location || "Worldwide" } } : {}),
    ...(job.location ? { jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location } } } : {}),
    directApply: job.applyMethod === "form",
    url: absoluteUrl(`/careers/${job.slug}`),
  };

  return (
    <>
      {job.status === "open" && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(posting) }} />}
      <PageHero
        breadcrumb={<nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5"><Link href="/careers" className="font-semibold text-white/80 transition hover:text-white">Careers</Link><ChevronRight className="size-4 shrink-0 text-white/40" /><span aria-current="page" className="truncate">{job.title}</span></nav>}
        eyebrow={job.department || "Open role"}
        title={job.title}
        lead={job.summary}
        actions={accepting && !applied ? <>
          <a href={applyHref} target={job.applyMethod === "link" ? "_blank" : undefined} rel={job.applyMethod === "link" ? "noopener noreferrer" : undefined} className={heroButton.primary}>Apply now <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></a>
          <Link href="/careers#roles" className={heroButton.secondary}>All roles</Link>
        </> : <Link href="/careers#roles" className={heroButton.secondary}>See all open roles</Link>}
        facts={[
          { icon: BriefcaseIcon, label: "Type", value: JOB_TYPE_LABEL[job.employmentType] },
          { icon: job.workMode === "remote" ? MonitorIcon : PinIcon, label: "Where", value: where },
          ...(job.salary ? [{ icon: CardIcon, label: "Pay", value: job.salary }] : []),
          ...(job.closesOn ? [{ icon: ClockIcon, label: "Closes", value: formatDateOnly(job.closesOn) }] : []),
        ]}
      />

      {job.status === "draft" && <p className="bg-amber-50 px-5 py-3 text-center text-sm font-semibold text-amber-900">Preview: this role is a draft, so only your team can see it.</p>}

      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-14 sm:px-8 md:py-20 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-12">
          {job.description && (
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-2xl font-bold tracking-tight text-ink">About the role</h2>
              <RichText text={job.description} />
            </section>
          )}
          <List title="What you'll do" items={job.responsibilities} />
          <List title="What we're looking for" items={job.requirements} tick />
          <List title="Nice to have" items={job.niceToHave} />
          <List title="What we offer" items={job.benefits} tick />

          <section id="apply" className="scroll-mt-28 flex flex-col gap-6 rounded-[5px] border border-edge bg-white p-6 shadow-[0_30px_80px_-50px_rgba(24,19,64,.45)] sm:p-8">
            {applied ? (
              <div className="flex flex-col items-start gap-4">
                <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircleIcon className="size-7" /></span>
                <h2 className="font-display text-2xl font-bold text-ink">Application sent. Thank you!</h2>
                <p className="text-[15px] leading-relaxed text-body">We&apos;ve emailed you a confirmation. Our team reviews every application, and we&apos;ll be in touch if your experience is a good match.</p>
                <Link href="/careers#roles" className="inline-flex items-center gap-2 font-semibold text-accent hover:text-accent-dark">See other open roles <ArrowRight className="size-4" /></Link>
              </div>
            ) : !accepting ? (
              <div className="flex flex-col gap-3">
                <h2 className="font-display text-2xl font-bold text-ink">This role is closed</h2>
                <p className="text-[15px] leading-relaxed text-body">We&apos;re no longer taking applications for this role. <Link href="/careers#roles" className="font-semibold text-accent hover:text-accent-dark">See our open roles</Link>.</p>
              </div>
            ) : job.applyMethod === "form" ? (
              <>
                <div className="flex flex-col gap-2">
                  <h2 className="font-display text-2xl font-bold text-ink">Apply for this role</h2>
                  <p className="text-[15px] text-muted">It takes about ten minutes. Have your CV ready.</p>
                </div>
                <JobApplyForm jobId={job.id} jobTitle={job.title} defaultCountry={country ?? undefined} />
              </>
            ) : (
              <div className="flex flex-col items-start gap-4">
                <h2 className="font-display text-2xl font-bold text-ink">How to apply</h2>
                <p className="text-[15px] leading-relaxed text-body">{job.applyMethod === "email" ? <>Email your CV and a short note about why you&apos;re a great fit to <a href={applyHref} className="font-semibold text-accent">{job.applyTarget}</a>, with “{job.title}” in the subject.</> : "Applications for this role are handled on another website."}</p>
                <a href={applyHref} target={job.applyMethod === "link" ? "_blank" : undefined} rel={job.applyMethod === "link" ? "noopener noreferrer" : undefined} className="inline-flex h-12 items-center gap-2 rounded-[5px] bg-accent px-6 font-semibold text-white hover:bg-accent-dark">
                  {job.applyMethod === "email" ? <><MailIcon className="size-4" /> Email your application</> : <>Apply on the hiring site <ExternalIcon className="size-4" /></>}
                </a>
              </div>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
          <div className="flex flex-col gap-4 rounded-[5px] border border-edge bg-white p-6">
            <p className="font-display text-lg font-bold text-ink">{job.title}</p>
            <dl className="flex flex-col gap-3 text-[15px]">
              <div className="flex items-center gap-3"><BriefcaseIcon className="size-4 shrink-0 text-accent" /><dt className="sr-only">Type</dt><dd className="text-body">{JOB_TYPE_LABEL[job.employmentType]}</dd></div>
              <div className="flex items-center gap-3"><PinIcon className="size-4 shrink-0 text-accent" /><dt className="sr-only">Where</dt><dd className="text-body">{where}</dd></div>
              {job.salary && <div className="flex items-center gap-3"><CardIcon className="size-4 shrink-0 text-accent" /><dt className="sr-only">Pay</dt><dd className="text-body">{job.salary}</dd></div>}
              {job.closesOn && <div className="flex items-center gap-3"><ClockIcon className="size-4 shrink-0 text-accent" /><dt className="sr-only">Closes</dt><dd className="text-body">Closes {formatDateOnly(job.closesOn)}</dd></div>}
            </dl>
            {accepting && !applied && <a href={applyHref} target={job.applyMethod === "link" ? "_blank" : undefined} rel={job.applyMethod === "link" ? "noopener noreferrer" : undefined} className="inline-flex h-11 items-center justify-center gap-2 rounded-[5px] bg-accent font-semibold text-white hover:bg-accent-dark">Apply now <ArrowRight className="size-4" /></a>}
            {!accepting && <p className="rounded-[5px] bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">No longer taking applications</p>}
          </div>
          <p className="px-1 text-sm text-muted">Questions about the role?{settings.supportEmail && <> Email <a href={`mailto:${settings.supportEmail}?subject=${encodeURIComponent(`Question: ${job.title}`)}`} className="font-semibold text-accent">{settings.supportEmail}</a>.</>}</p>
        </aside>
      </div>
    </>
  );
}
