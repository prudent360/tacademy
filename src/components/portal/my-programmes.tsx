import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { claimProgrammeCourse, payProgrammeInstalment } from "@/app/actions/enroll";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ArrowRight, CapIcon, CheckIcon } from "@/components/icons";
import { Badge, Card } from "@/components/ui";
import { getDb } from "@/db";
import { cohorts, enrollments, programmeEnrollments, programmes } from "@/db/schema";
import { withCohorts } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { payableCurrencies } from "@/lib/payments";
import { instalmentStatus } from "@/lib/programme-enrolment";
import { programmeCourseMap } from "@/lib/programmes";
import { formatDateOnly } from "@/lib/time";
import { MODE_LABEL } from "@/lib/utils";

const selectClass = "h-10 min-w-0 grow rounded-md border border-edge-strong bg-white px-3 text-sm text-ink";

/** A student's active programmes: each course in order (booked, or claimable), and their instalments. */
export async function MyProgrammes({ userId }: { userId: number }) {
  const db = await getDb();
  const rows = await db.select({ enrolment: programmeEnrollments, programme: programmes }).from(programmeEnrollments).innerJoin(programmes, eq(programmes.id, programmeEnrollments.programmeId))
    .where(and(eq(programmeEnrollments.userId, userId), eq(programmeEnrollments.status, "active")));
  if (!rows.length) return null;
  const [included, places, payable] = await Promise.all([
    programmeCourseMap(rows.map((r) => r.programme.id)),
    db.select({ cohortId: cohorts.id, courseId: cohorts.courseId, name: cohorts.name, startDate: cohorts.startDate }).from(enrollments).innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .where(and(eq(enrollments.userId, userId), inArray(enrollments.status, ["active", "completed"]))),
    payableCurrencies(),
  ]);
  const summaries = await withCohorts([...new Map([...included.values()].flat().map((c) => [c.id, c])).values()]);

  return (
    <section id="programmes" className="flex scroll-mt-24 flex-col gap-4">
      {await Promise.all(rows.map(async ({ enrolment, programme }) => {
        const status = await instalmentStatus(enrolment);
        const list = included.get(programme.id) ?? [];
        const booked = list.filter((c) => places.some((p) => p.courseId === c.id)).length;
        return (
          <Card key={enrolment.id} padded={false}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5 md:p-6">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-accent-soft text-accent"><CapIcon className="size-5" /></span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[1.2px] text-accent">My programme</p>
                  <h2 className="font-display text-xl font-bold text-ink">{programme.title}</h2>
                  <p className="text-sm text-muted">{booked} of {list.length} courses booked · {programme.duration}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 text-right">
                {enrolment.instalmentCount > 1
                  ? <Badge tone={status.overdue ? "amber" : status.next ? "accent" : "green"}>{status.paid} of {enrolment.instalmentCount} instalments paid</Badge>
                  : <Badge tone="green">Paid in full</Badge>}
                {status.next && (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <p className="text-sm text-body">{status.overdue ? <strong className="text-amber-700">Overdue: </strong> : "Next: "}{formatMoney(status.next.amount, enrolment.currency)} {status.overdue ? "" : `due ${formatDateOnly(status.next.dueDate.toISOString().slice(0, 10))}`}</p>
                    {payable.includes(enrolment.currency)
                      ? <ActionForm action={payProgrammeInstalment.bind(null, enrolment.id)} className="flex flex-col items-end gap-2"><SubmitButton pendingText="Opening…">Pay instalment</SubmitButton></ActionForm>
                      : <p className="max-w-48 text-xs text-muted">Online payments in {enrolment.currency} are unavailable right now. Contact support.</p>}
                  </div>
                )}
              </div>
            </div>
            <ol className="flex flex-col divide-y divide-line">
              {list.map((course, i) => {
                const place = places.find((p) => p.courseId === course.id);
                const open = summaries.find((s) => s.id === course.id)?.cohorts.filter((c) => c.enrollmentOpen && !c.full) ?? [];
                return (
                  <li key={course.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center md:px-6">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${place ? "bg-emerald-50 text-emerald-700" : "bg-accent-soft text-accent"}`}>{place ? <CheckIcon className="size-4" /> : String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 grow">
                      <p className="font-semibold text-ink">{course.title}</p>
                      <p className="text-sm text-muted">{place ? `${place.name}${place.startDate ? `, starts ${formatDateOnly(place.startDate)}` : ""}` : open.length ? "Choose your start date when you're ready" : "New dates coming soon"}</p>
                    </div>
                    {place ? (
                      <Link href={`/dashboard/cohorts/${place.cohortId}`} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-accent hover:underline">Open course <ArrowRight className="size-4" /></Link>
                    ) : open.length > 0 && (
                      <ActionForm action={claimProgrammeCourse.bind(null, enrolment.id)} className="flex w-full flex-col gap-2 sm:w-auto sm:max-w-[420px]">
                        <div className="flex gap-2">
                          <select name="cohortId" aria-label={`Start date for ${course.title}`} required className={selectClass}>
                            {open.map((c) => <option key={c.id} value={c.id}>{c.name}{c.startDate ? ` · ${formatDateOnly(c.startDate)}` : ""} · {MODE_LABEL[c.deliveryMode]}</option>)}
                          </select>
                          <SubmitButton pendingText="Booking…">Claim my place</SubmitButton>
                        </div>
                      </ActionForm>
                    )}
                  </li>
                );
              })}
            </ol>
            {status.overdue && <p className="border-t border-line bg-amber-50 px-5 py-3 text-sm text-amber-900 md:px-6">Pay your overdue instalment to claim places on your next courses.</p>}
          </Card>
        );
      }))}
    </section>
  );
}
