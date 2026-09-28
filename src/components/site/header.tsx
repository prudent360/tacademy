import Link from "next/link";
import { MenuIcon } from "@/components/icons";
import type { Settings, User } from "@/db/schema";
import { homeFor } from "@/lib/session";
import { Brand } from "./brand";
import { HeaderScrollState } from "./header-scroll";

const LINKS = [
  { href: "/courses", label: "Courses" },
  { href: "/#formats", label: "How we teach" },
  { href: "/#how", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

const primary = "flex h-11 items-center justify-center rounded-[10px] bg-accent px-5 text-[15px] font-semibold text-white transition hover:bg-accent-dark";
const outline = "flex h-11 items-center justify-center rounded-[10px] border-[1.5px] border-accent px-5 text-[15px] font-semibold text-accent transition hover:bg-accent-soft";

/** A white bar over the top of the page, inset from the edges. It stays pinned on large screens and scrolls away on phones and tablets. */
export function SiteHeader({ settings, user }: { settings: Settings; user: User | null }) {
  const account = user
    ? <Link href={homeFor(user.role)} className={primary}>My dashboard</Link>
    : <><Link href="/enroll" className={primary}>Enrol now</Link><Link href="/login" className={outline}>Sign in</Link></>;
  return (
    <header className="site-header group/header relative z-30 px-3 lg:sticky lg:top-0 pt-3 sm:px-5 md:pt-4">
      <HeaderScrollState />
      <div className="relative mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-6 rounded-[16px] border border-edge/70 bg-white px-4 shadow-[0_10px_30px_-18px_rgba(25,17,46,.35)] transition-shadow duration-300 group-data-scrolled/header:shadow-[0_16px_40px_-18px_rgba(25,17,46,.45)] sm:px-6 md:h-[72px] md:px-8">
        <Brand settings={settings} />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="flex h-10 items-center rounded-lg px-3.5 text-[15px] font-medium text-ink transition hover:bg-page hover:text-accent">{l.label}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">{account}</div>
        <details className="relative lg:hidden">
          <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-[10px] border border-edge text-ink" aria-label="Open menu">
            <MenuIcon />
          </summary>
          <nav aria-label="Mobile" className="absolute -right-2 top-14 flex w-64 flex-col gap-1 rounded-[14px] border border-edge bg-white p-2 shadow-lg sm:-right-4">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="flex h-11 items-center rounded-lg px-3 text-[15px] font-medium text-ink hover:bg-page">{l.label}</Link>
            ))}
            <div className="mt-1 flex flex-col gap-2 border-t border-line pt-2">{account}</div>
          </nav>
        </details>
      </div>
    </header>
  );
}
