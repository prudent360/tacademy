import Link from "next/link";
import { LearningShowcase } from "@/components/learning-showcase";
import { Brand } from "@/components/site/brand";
import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Sign-in and account pages: one card with the form on the left and the academy on the right (from large screens up). */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white sm:bg-[#e9eaf0] sm:px-6 sm:py-10">
      <div className="grid w-full max-w-[1120px] overflow-hidden bg-white sm:rounded-[20px] sm:shadow-[0_40px_90px_-40px_rgba(24,19,64,.35)] lg:min-h-[660px] lg:grid-cols-2">
        <div className="flex min-w-0 flex-col justify-center px-6 py-10 sm:px-14 lg:px-20">
          <div className="mx-auto flex w-full max-w-[380px] flex-col gap-7">
            <Brand settings={settings} />
            {children}
          </div>
        </div>
        <aside className="hidden bg-accent lg:block">
          <LearningShowcase />
        </aside>
      </div>
      <nav aria-label="Legal" className="flex gap-6 py-6 text-[13px] text-muted">
        <span>© {settings.siteName}</span>
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <Link href="/contact" className="hover:text-ink">Help</Link>
      </nav>
    </div>
  );
}
