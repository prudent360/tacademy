import Image from "next/image";
import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { Brand } from "@/components/site/brand";
import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

const POINTS = [
  "Live classes with instructors who work in the field",
  "Lessons you can revisit at your own pace",
  "Feedback on every assignment, and a certificate at the end",
];

/** Sign-in and account pages: the form on the left, the academy on the right (from large screens up). */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-w-0 flex-col px-5 py-6 sm:px-10 sm:py-8 lg:px-14 xl:px-20">
        <Brand settings={settings} />
        <main className="flex grow items-center justify-center py-12">
          <div className="flex w-full max-w-[400px] flex-col gap-7">{children}</div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
          <span>© {settings.siteName}</span>
          <nav aria-label="Legal" className="flex gap-5">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/contact" className="hover:text-ink">Help</Link>
          </nav>
        </footer>
      </div>

      <aside className="relative m-3 hidden overflow-hidden rounded-[24px] bg-navy lg:block">
        <Image src="/images/home-hero-team.webp" alt="" fill priority sizes="55vw" className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(25,17,46,.15)_0%,rgba(25,17,46,.55)_45%,rgba(25,17,46,.94)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-6 p-10 xl:p-14">
          <p className="w-fit rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[1.4px] text-white/90 backdrop-blur">{settings.siteName}</p>
          <h2 className="max-w-[520px] font-display text-[34px] font-bold leading-[1.1] tracking-[-0.8px] text-white xl:text-[40px]">Practical skills, taught live, for the career you want.</h2>
          <ul className="flex flex-col gap-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[15px] text-white/85">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15"><CheckIcon className="size-3.5 text-white" /></span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
