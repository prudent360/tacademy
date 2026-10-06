import type { Metadata } from "next";
import Image from "next/image";
import { EnrolForm, type EnrolCohort } from "@/components/site/enrol-form";
import { getCurrentUser } from "@/lib/auth";
import { isFree, withCohorts } from "@/lib/catalog";
import { bankTransferConfig } from "@/lib/config";
import { getPublishedCourses, getSettings, getStudentCohorts, graduateFor, linkedCourseTitles } from "@/lib/data";
import { findDiscount, onlineProviders, payableCurrencies } from "@/lib/payments";
import { cohortCurrencies } from "@/lib/pricing";
import { formatDateOnly } from "@/lib/time";
import { visitorCurrencies } from "@/lib/visitor";
import { whatsappConfig } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Enrol", description: "Choose a course and cohort, tell us about yourself and secure your place.", alternates: { canonical: "/enroll" } };

/** Default country for the phone field, from the academy's main currency. */
const PHONE_COUNTRY: Record<string, string> = { NGN: "NG", GBP: "GB", USD: "US", CAD: "CA", EUR: "IE", GHS: "GH", KES: "KE", ZAR: "ZA", UGX: "UG", TZS: "TZ", RWF: "RW", XOF: "SN", XAF: "CM" };

export default async function EnrolPage({ searchParams }: { searchParams: Promise<{ cohort?: string; course?: string; code?: string }> }) {
  const [params, settings, user, courses, payable, bank, providers] = await Promise.all([searchParams, getSettings(), getCurrentUser(), getPublishedCourses(), payableCurrencies(), bankTransferConfig(), onlineProviders()]);
  const visitor = await visitorCurrencies(settings);
  const enrolledIn = user ? new Set((await getStudentCohorts(user.id)).map((row) => row.cohort.id)) : new Set<number>();
  // Graduate status depends on each programme's linked courses, so it's worked out per course that offers free graduate places.
  const graduateOf = new Map<number, boolean>();
  const summaries = await withCohorts(courses);
  const linkedTitles = await linkedCourseTitles(summaries.filter((c) => c.kind === "internship").map((c) => c.id));
  if (user) for (const course of summaries) if (course.cohorts.some((c) => c.graduatesFree)) graduateOf.set(course.id, await graduateFor(user.id, course.id));

  const cohorts: EnrolCohort[] = summaries.flatMap((course) => course.cohorts
    .filter((cohort) => cohort.enrollmentOpen && !cohort.full && !enrolledIn.has(cohort.id))
    .map((cohort) => {
      const currencies = cohortCurrencies(cohort).filter((c) => payable.includes(c) || (bank.enabled && c === bank.currency));
      return {
        id: cohort.id,
        courseId: course.id,
        courseTitle: course.title,
        name: cohort.name,
        dates: cohort.startDate ? `${formatDateOnly(cohort.startDate)}${cohort.endDate ? ` – ${formatDateOnly(cohort.endDate)}` : ""}` : "Dates to be confirmed",
        deliveryMode: cohort.deliveryMode,
        free: isFree(cohort) || (cohort.graduatesFree && (graduateOf.get(course.id) ?? false)),
        graduatesFree: cohort.graduatesFree && !isFree(cohort),
        graduatesOf: linkedTitles.get(course.id) ?? [],
        prices: cohort.prices,
        registrationFees: cohort.registrationFees,
        depositPercent: cohort.depositPercent,
        registrationOnly: cohort.registrationOnly,
        currencies: currencies.map((code) => ({ code, online: payable.includes(code), provider: providers[code], bank: bank.enabled && code === bank.currency })),
      };
    })
    .filter((cohort) => cohort.free || cohort.currencies.length > 0));

  const requested = Number(params.cohort);
  const selected = cohorts.find((c) => c.id === requested) ?? (params.course ? cohorts.find((c) => courses.find((course) => course.id === c.courseId)?.slug === params.course) : undefined);
  // A code in the link (e.g. from a free class follow-up email) is applied straight away if it's still valid.
  const linked = params.code ? await findDiscount(params.code) : null;
  const initialDiscount = linked && !("error" in linked) ? { code: linked.code, percentOff: linked.percentOff } : null;
  const [phoneDial, ...phoneRest] = user?.phone.includes(" ") ? user.phone.split(" ") : [];

  return (
    <div data-under-header className="relative bg-navy">
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <Image src="/images/enrol-classroom.webp" alt="" fill priority sizes="100vw" className="object-cover object-[center_30%]" />
        {/* Darkens the photo behind the heading, then fades into brand purple behind the form. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,19,64,.82)_0%,rgba(24,19,64,.68)_30%,rgba(35,24,130,.85)_58%,#3d2fb8_100%)]" />
      </div>
      <div className="relative mx-auto max-w-[1200px] px-5 pb-20 pt-14 sm:px-8 md:pt-20">
        <h1 className="mx-auto max-w-[720px] text-center [text-shadow:0_2px_24px_rgba(0,0,0,.35)] font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-white md:text-[56px]">Start your journey into tech</h1>
        <p className="mx-auto mt-4 max-w-[560px] text-center text-lg text-white/70">Tell us about yourself, choose your cohort and secure your place. Your student account is created as soon as you&apos;re enrolled.</p>
        <div className="mt-12">
          {cohorts.length ? (
            <EnrolForm
              cohorts={cohorts}
              preferred={visitor.currencies}
              initialCohortId={selected?.id ?? null}
              initialDiscount={initialDiscount}
              whatsapp={(await whatsappConfig()).ready}
              signedIn={user ? { firstName: user.name.split(" ")[0], lastName: user.name.split(" ").slice(1).join(" "), email: user.email, dial: phoneDial ?? "", phone: phoneRest.join(" "), dateOfBirth: user.dateOfBirth ?? "", gender: user.gender ?? "", qualification: user.qualification, country: user.country ?? "" } : null}
              defaultCountry={visitor.country ?? PHONE_COUNTRY[settings.currencies[0] ?? ""]}
            />
          ) : (
            <div className="mx-auto max-w-[560px] rounded-[24px] bg-white p-8 text-center">
              <h2 className="font-display text-2xl font-bold text-ink">No cohorts are open right now</h2>
              <p className="mt-2 text-muted">{settings.supportEmail ? <>Email <a href={`mailto:${settings.supportEmail}`} className="font-semibold text-accent">{settings.supportEmail}</a> to hear when the next one opens.</> : "Check back soon for new dates."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
