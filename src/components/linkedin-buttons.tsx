import { linkedInLinks } from "@/lib/linkedin";

/** LinkedIn's "in" mark, for the buttons below. */
export function LinkedInMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/** "Add to LinkedIn profile" and "Share on LinkedIn" for a student's own certificate. */
export function LinkedInButtons({ course, organisation, issuedAt, url, code, className = "" }: { course: string; organisation: string; issuedAt: Date; url: string; code: string; className?: string }) {
  const links = linkedInLinks({ course, organisation, issuedAt, url, code });
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <a href={links.add} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[5px] bg-[#0a66c2] px-4 text-sm font-semibold text-white transition hover:bg-[#004182]">
        <LinkedInMark /> Add to LinkedIn profile
      </a>
      <a href={links.share} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[5px] border border-[#0a66c2]/40 bg-surface px-4 text-sm font-semibold text-[#0a66c2] transition hover:bg-[#0a66c2]/5 dark:text-[#70b5f9]">
        <LinkedInMark /> Share on LinkedIn
      </a>
    </div>
  );
}
