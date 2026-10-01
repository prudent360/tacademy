import Link from "next/link";
import type { Settings } from "@/db/schema";
import { MailIcon, PinIcon } from "@/components/icons";
import { Brand } from "./brand";

export function SiteFooter({ settings }: { settings: Settings }) {
  return (
    <footer className="site-footer border-t border-line bg-white">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.35fr_.8fr_.9fr_1fr]">
        <div className="flex flex-col gap-4">
          <Brand settings={settings} />
          {settings.tagline && <p className="max-w-[360px] text-[15px] leading-relaxed text-muted">{settings.tagline}</p>}
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-display text-base font-bold text-ink">Learn</p>
          <Link href="/courses" className="text-[15px] text-muted hover:text-accent">All courses</Link>
          <Link href="/#how" className="text-[15px] text-muted hover:text-accent">How it works</Link>
          <Link href="/#faq" className="text-[15px] text-muted hover:text-accent">FAQ</Link>
          <Link href="/login" className="text-[15px] text-muted hover:text-accent">Student sign in</Link>
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-display text-base font-bold text-ink">Company</p>
          <Link href="/teach-with-us" className="text-[15px] text-muted hover:text-accent">Become an instructor</Link>
          <Link href="/contact" className="text-[15px] text-muted hover:text-accent">Contact us</Link>
          <Link href="/privacy" className="text-[15px] text-muted hover:text-accent">Privacy policy</Link>
          <Link href="/terms" className="text-[15px] text-muted hover:text-accent">Terms of use</Link>
          <Link href="/refund-policy" className="text-[15px] text-muted hover:text-accent">Refund policy</Link>
          <Link href="/cookies" className="text-[15px] text-muted hover:text-accent">Cookie policy</Link>
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-display text-base font-bold text-ink">Contact</p>
          {settings.supportEmail && (
            <a href={`mailto:${settings.supportEmail}`} className="flex items-center gap-2 text-[15px] text-muted hover:text-accent"><MailIcon className="size-4" /> {settings.supportEmail}</a>
          )}
          {settings.phone && <p className="text-[15px] text-muted">{settings.phone}</p>}
          {settings.address && <p className="flex items-start gap-2 text-[15px] text-muted"><PinIcon className="mt-0.5 size-4 shrink-0" /> {settings.address}</p>}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted sm:px-8"><p>© {new Date().getFullYear()} {settings.siteName}. All rights reserved.</p><div className="flex flex-wrap gap-4"><Link href="/terms" className="hover:text-accent">Terms</Link><Link href="/privacy" className="hover:text-accent">Privacy</Link><Link href="/cookies" className="hover:text-accent">Cookies</Link></div></div>
      </div>
    </footer>
  );
}
