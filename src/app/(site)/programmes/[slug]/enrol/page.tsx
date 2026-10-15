import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ProgrammeEnrolForm } from "@/components/site/programme-enrol-form";
import { getDb } from "@/db";
import { programmeEnrollments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { withCohorts } from "@/lib/catalog";
import { bankTransferConfig } from "@/lib/config";
import { getSettings } from "@/lib/data";
import { onlineProviders, payableCurrencies } from "@/lib/payments";
import { takenCourses } from "@/lib/programme-enrolment";
import { getProgrammeBySlug, programmeCourseMap } from "@/lib/programmes";
import { formatDateOnly } from "@/lib/time";
import { visitorCurrencies } from "@/lib/visitor";
import { whatsappConfig } from "@/lib/whatsapp";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const programme = await getProgrammeBySlug((await params).slug);
  return programme ? { title: `Enrol: ${programme.title}`, robots: { index: false } } : {};
}

/** Default country for the phone field, from the academy's main currency. */
const PHONE_COUNTRY: Record<string, string> = { NGN: "NG", GBP: "GB", USD: "US", CAD: "CA", EUR: "IE", GHS: "GH", KES: "KE", ZAR: "ZA", UGX: "UG", TZS: "TZ", RWF: "RW", XOF: "SN", XAF: "CM" };

export default async function ProgrammeEnrolPage({ params }: Props) {
  const programme = await getProgrammeBySlug((await params).slug);
  if (!programme) notFound();
  const [settings, user, included, payable, bank, providers] = await Promise.all([getSettings(), getCurrentUser(), programmeCourseMap([programme.id], { publishedOnly: true }), payableCurrencies(), bankTransferConfig(), onlineProviders()]);
  const list = included.get(programme.id) ?? [];
  if (list.length < 2) notFound();
  // A signed-in student's finished or booked courses count: they start with the first one they haven't taken.
  const taken = user ? await takenCourses(user.id, list.map((c) => c.id)) : new Map<number, "completed" | "booked">();
  const toBook = list.find((c) => !taken.has(c.id));
  const [[first], visitor] = await Promise.all([withCohorts(toBook ? [toBook] : []), visitorCurrencies(settings)]);
  const [existing] = user ? await (await getDb()).select().from(programmeEnrollments).where(and(eq(programmeEnrollments.userId, user.id), eq(programmeEnrollments.programmeId, programme.id), eq(programmeEnrollments.status, "active"))) : [];

  const cohorts = (first?.cohorts ?? []).filter((c) => c.enrollmentOpen && !c.full).map((c) => ({
    id: c.id, name: c.name, deliveryMode: c.deliveryMode,
    dates: c.startDate ? `${formatDateOnly(c.startDate)}${c.endDate ? ` – ${formatDateOnly(c.endDate)}` : ""}` : "Dates to be confirmed",
  }));
  const currencies = Object.entries(programme.prices).filter(([code, amount]) => (amount ?? 0) > 0 && (payable.includes(code) || (bank.enabled && code === bank.currency)))
    .map(([code]) => ({ code, online: payable.includes(code), provider: providers[code], bank: bank.enabled && code === bank.currency }));
  const [phoneDial, ...phoneRest] = user?.phone.includes(" ") ? user.phone.split(" ") : [];
  const unavailable = existing ? null : !first ? "You've already taken every course in this programme." : !currencies.length ? "This programme can't be paid for online yet." : !cohorts.length ? `There are no open dates for ${first.title} right now.` : null;

  return (
    <div data-under-header className="relative bg-navy">
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <Image src="/images/enrol-classroom.webp" alt="" fill priority sizes="100vw" className="object-cover object-[center_30%]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,19,64,.82)_0%,rgba(24,19,64,.68)_30%,rgba(35,24,130,.85)_58%,#3d2fb8_100%)]" />
      </div>
      <div className="relative mx-auto max-w-[1200px] px-5 pb-20 pt-14 sm:px-8 md:pt-20">
        <p className="text-center font-mono text-xs font-semibold uppercase tracking-[1.4px] text-white/70"><Link href={`/programmes/${programme.slug}`} className="hover:text-white">Programme</Link></p>
        <h1 className="mx-auto mt-3 max-w-[760px] text-center [text-shadow:0_2px_24px_rgba(0,0,0,.35)] font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-white md:text-[52px]">{programme.title}</h1>
        <p className="mx-auto mt-4 max-w-[560px] text-center text-lg text-white/70">{list.length} courses over {programme.duration}. Book your first course today and pick dates for the rest as you go.</p>
        <div className="mt-12">
          {existing ? (
            <div className="mx-auto max-w-[560px] rounded-[24px] bg-white p-8 text-center">
              <h2 className="font-display text-2xl font-bold text-ink">You&apos;re already on this programme</h2>
              <p className="mt-2 text-muted">Claim your next course and see your instalments from your dashboard.</p>
              <Link href="/dashboard/courses#programmes" className="mt-5 inline-flex h-12 items-center rounded-lg bg-accent px-6 font-semibold text-white hover:bg-accent-dark">Open my programme</Link>
            </div>
          ) : unavailable ? (
            <div className="mx-auto max-w-[560px] rounded-[24px] bg-white p-8 text-center">
              <h2 className="font-display text-2xl font-bold text-ink">{unavailable}</h2>
              <p className="mt-2 text-muted">{settings.supportEmail ? <>Email <a href={`mailto:${settings.supportEmail}?subject=${encodeURIComponent(`Programme enquiry: ${programme.title}`)}`} className="font-semibold text-accent">{settings.supportEmail}</a> and we&apos;ll help you join.</> : "Please check back soon."}</p>
            </div>
          ) : (
            <ProgrammeEnrolForm
              programme={{ id: programme.id, slug: programme.slug, title: programme.title, duration: programme.duration, prices: programme.prices, instalmentCount: programme.instalmentCount, instalmentFirstPercent: programme.instalmentFirstPercent, courses: list.map((c) => ({ title: c.title, status: taken.get(c.id) ?? (c.id === toBook?.id ? "now" : "later") })), cohorts, currencies }}
              preferred={visitor.currencies}
              whatsapp={(await whatsappConfig()).ready}
              signedIn={user ? { firstName: user.name.split(" ")[0], lastName: user.name.split(" ").slice(1).join(" "), email: user.email, dial: phoneDial ?? "", phone: phoneRest.join(" "), dateOfBirth: user.dateOfBirth ?? "", gender: user.gender ?? "", qualification: user.qualification, country: user.country ?? "" } : null}
              defaultCountry={visitor.country ?? PHONE_COUNTRY[settings.currencies[0] ?? ""]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
