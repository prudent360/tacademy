import Link from "next/link";
import { MenuIcon } from "@/components/icons";
import type { Settings, User } from "@/db/schema";
import { homeFor } from "@/lib/session";
import { Brand } from "./brand";

const LINKS = [
  { href: "/courses", label: "Courses" },
  { href: "/#formats", label: "How we teach" },
  { href: "/#how", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader({ settings, user }: { settings: Settings; user: User | null }) {
  const account = user
    ? <Link href={homeFor(user.role)} className="flex h-11 items-center rounded-lg bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-dark">My dashboard</Link>
    : (
      <>
        <Link href="/login" className="flex h-11 items-center rounded-lg px-4 text-[15px] font-semibold text-ink hover:bg-page">Sign in</Link>
        <Link href="/enroll" className="flex h-11 items-center rounded-lg bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-dark">Enrol now</Link>
      </>
    );
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="bg-navy px-5 py-2 text-center text-xs font-semibold text-white sm:text-sm">
        <span className="mr-2 inline-block size-2 rounded-full bg-cyan shadow-[0_0_0_4px_rgba(49,196,240,.16)]" aria-hidden="true" />
        Applications are open for upcoming cohorts.
        <Link href="/courses" className="ml-2 text-cyan-light underline decoration-cyan/60 underline-offset-4 hover:text-white">Explore courses</Link>
      </div>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-5 sm:px-8 md:h-20">
        <Brand settings={settings} />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="flex h-11 items-center rounded-lg px-3.5 text-[15px] font-semibold text-body hover:bg-page hover:text-ink">{l.label}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">{account}</div>
        <details className="group relative lg:hidden">
          <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-lg border border-edge text-ink" aria-label="Open menu">
            <MenuIcon />
          </summary>
          <nav aria-label="Mobile" className="absolute right-0 top-13 flex w-60 flex-col gap-1 rounded-xl border border-edge bg-white p-2 shadow-lg">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="flex h-11 items-center rounded-lg px-3 text-[15px] font-semibold text-body hover:bg-page">{l.label}</Link>
            ))}
            <div className="mt-1 flex flex-col gap-1 border-t border-line pt-2">{account}</div>
          </nav>
        </details>
      </div>
    </header>
  );
}
