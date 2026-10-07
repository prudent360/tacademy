import Link from "next/link";
import type { Settings } from "@/db/schema";
import { ExternalIcon, MailIcon, PinIcon, ShieldIcon } from "@/components/icons";
import { companiesHouseUrl, companyInfo, companyStatement } from "@/lib/company";
import { Brand } from "./brand";

export function SiteFooter({ settings }: { settings: Settings }) {
  const company = companyInfo(settings);
  const statement = companyStatement(company, settings.siteName);
  return (
    <footer className="site-footer relative bg-[#0c0b12] bg-[radial-gradient(640px_320px_at_92%_0%,rgba(79,63,215,.18),transparent_65%)] text-white">
      <div aria-hidden="true" className="h-px bg-[linear-gradient(90deg,transparent,rgba(49,196,240,.8)_30%,rgba(124,112,240,.8)_70%,transparent)]" />
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.35fr_.8fr_.9fr_1fr]">
        <div className="flex flex-col gap-4">
          <Brand settings={settings} tone="reversed" />
          {settings.tagline && <p className="max-w-[360px] text-[15px] leading-relaxed text-white/70">{settings.tagline}</p>}
          {company.number && (
            <a href={companiesHouseUrl(company.number)} target="_blank" rel="noopener noreferrer" title="View on Companies House" className="group mt-1 flex w-fit items-center gap-3 rounded-[5px] border border-white/10 bg-white/[.04] px-3.5 py-2.5 transition hover:border-white/25 hover:bg-white/[.07]">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[5px] bg-white/[.08] text-[#b9f0ff]"><ShieldIcon className="size-[18px]" /></span>
              <span className="flex flex-col">
                <span className="text-[13px] font-semibold text-white">UK registered company</span>
                <span className="flex items-center gap-1 text-[12px] text-white/60">Company No. {company.number} <ExternalIcon className="size-3 opacity-0 transition group-hover:opacity-100" /></span>
              </span>
            </a>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-display text-base font-bold text-white">Learn</p>
          <Link href="/courses" className="text-[15px] text-white/70 transition hover:text-white">All courses</Link>
          <Link href="/free-classes" className="text-[15px] text-white/70 transition hover:text-white">Free classes</Link>
          <Link href="/projects" className="text-[15px] text-white/70 transition hover:text-white">Student projects</Link>
          <Link href="/#how" className="text-[15px] text-white/70 transition hover:text-white">How it works</Link>
          <Link href="/#faq" className="text-[15px] text-white/70 transition hover:text-white">FAQ</Link>
          <Link href="/login" className="text-[15px] text-white/70 transition hover:text-white">Student sign in</Link>
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-display text-base font-bold text-white">Company</p>
          <Link href="/teach-with-us" className="text-[15px] text-white/70 transition hover:text-white">Become an instructor</Link>
          <Link href="/careers" className="text-[15px] text-white/70 transition hover:text-white">Careers</Link>
          <Link href="/contact" className="text-[15px] text-white/70 transition hover:text-white">Contact us</Link>
          <Link href="/privacy" className="text-[15px] text-white/70 transition hover:text-white">Privacy policy</Link>
          <Link href="/terms" className="text-[15px] text-white/70 transition hover:text-white">Terms of use</Link>
          <Link href="/refund-policy" className="text-[15px] text-white/70 transition hover:text-white">Refund policy</Link>
          <Link href="/cookies" className="text-[15px] text-white/70 transition hover:text-white">Cookie policy</Link>
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-display text-base font-bold text-white">Contact</p>
          {settings.supportEmail && (
            <a href={`mailto:${settings.supportEmail}`} className="flex items-center gap-2 text-[15px] text-white/70 transition hover:text-white"><MailIcon className="size-4" /> {settings.supportEmail}</a>
          )}
          {settings.phone && <p className="text-[15px] text-white/70">{settings.phone}</p>}
          {settings.address && <p className="flex items-start gap-2 text-[15px] text-white/70"><PinIcon className="mt-0.5 size-4 shrink-0" /> {settings.address}</p>}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-6 text-sm text-white/60 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3"><p>© {new Date().getFullYear()} {settings.siteName}. All rights reserved.</p><div className="flex flex-wrap gap-4"><Link href="/terms" className="hover:text-white">Terms</Link><Link href="/privacy" className="hover:text-white">Privacy</Link><Link href="/cookies" className="hover:text-white">Cookies</Link></div></div>
          {statement && <p className="max-w-[880px] text-[12px] leading-relaxed text-white/45">{statement}</p>}
        </div>
      </div>
    </footer>
  );
}
