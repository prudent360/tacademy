import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { deleteFreeClass, sendFollowUpNow, setAttendance, setFreeClassStatus } from "@/app/actions/free-classes";
import { FreeClassForm } from "@/components/admin/free-class-form";
import { ActionButton, ActionForm, DeleteButton, SubmitButton } from "@/components/forms";
import { DownloadIcon, ExternalIcon } from "@/components/icons";
import { Badge, buttonClass, Card, DataTable, Notice, PageHeader, PersonCell } from "@/components/ui";
import { getDb } from "@/db";
import { courses, discountCodes, freeClasses, freeClassSignups } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { FREE_CLASS_STATUS_LABEL, FREE_CLASS_STATUS_TONE } from "@/lib/free-classes";
import { formatDateTime, relativeTime } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Free class" };

const pill = (active: boolean) => `inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${active ? "bg-accent text-white" : "border border-edge-strong bg-surface text-body hover:bg-page"}`;

export default async function FreeClassAdminPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requirePermission("free_classes.manage");
  const [{ id: raw }, { created }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const db = await getDb();
  const [fc] = await db.select().from(freeClasses).where(eq(freeClasses.id, id));
  if (!fc) notFound();
  const [signups, courseList, settings] = await Promise.all([
    db.select({ signup: freeClassSignups, code: discountCodes.code, used: discountCodes.usedCount }).from(freeClassSignups).leftJoin(discountCodes, eq(discountCodes.id, freeClassSignups.discountCodeId)).where(eq(freeClassSignups.classId, id)).orderBy(asc(freeClassSignups.createdAt)),
    db.select({ id: courses.id, title: courses.title }).from(courses).orderBy(asc(courses.sortOrder), asc(courses.title)),
    getSettings(),
  ]);
  const active = signups.filter((r) => !r.signup.cancelledAt);
  const came = active.filter((r) => r.signup.attended).length;
  const usedCodes = active.filter((r) => r.used).length;
  const started = fc.startsAt <= new Date();

  return (
    <>
      <PageHeader
        back={{ href: "/admin/free-classes", label: "Free classes" }}
        title={fc.title}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={FREE_CLASS_STATUS_TONE[fc.status]}>{FREE_CLASS_STATUS_LABEL[fc.status]}</Badge> /free-classes/{fc.slug}</span>}
        actions={<>
          {fc.status !== "draft" && <Link href={`/free-classes/${fc.slug}`} target="_blank" className={buttonClass.secondary}><ExternalIcon className="size-4" /> View on site</Link>}
          {fc.status === "open" ? <ActionButton action={setFreeClassStatus.bind(null, id, "closed")} pendingText="Closing…">Close sign-ups</ActionButton> : <ActionButton action={setFreeClassStatus.bind(null, id, "open")} variant="primary" pendingText="Opening…">{fc.status === "draft" ? "Publish" : "Reopen sign-ups"}</ActionButton>}
        </>}
      />
      {created && <Notice>Free class created as a {fc.status === "open" ? "live class" : "draft"}. {fc.status === "draft" && "Click Publish when it's ready."}</Notice>}

      <Card title={`Sign-ups (${active.length}${fc.capacity ? ` of ${fc.capacity}` : ""})`} action={signups.length ? <a href={`/api/admin/free-classes/${id}/export`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-ink"><DownloadIcon className="size-4" /> Download CSV</a> : undefined} padded={false}>
        {signups.length ? (
          <DataTable>
            <thead><tr><th>Person</th><th>Phone</th><th>Describes them</th><th>Signed up</th>{started && <th>Came?</th>}{fc.followUpSentAt && <th>Code</th>}</tr></thead>
            <tbody>
              {signups.map(({ signup: s, code, used }) => (
                <tr key={s.id} className={s.cancelledAt ? "opacity-50" : ""}>
                  <td><PersonCell name={s.name} email={s.email} /></td>
                  <td className="whitespace-nowrap text-body">{s.phone}{s.whatsappOptIn && <Badge tone="green" className="ml-2">WhatsApp</Badge>}</td>
                  <td className="text-body">{s.background || <span className="text-muted">–</span>}{s.heardFrom && <span className="mt-0.5 block text-xs text-muted">via {s.heardFrom}</span>}</td>
                  <td className="whitespace-nowrap text-muted">{relativeTime(s.createdAt)}</td>
                  {started && (
                    <td>
                      <div className="flex gap-1.5">
                        <form action={setAttendance.bind(null, s.id, s.attended === true ? null : true)}><button type="submit" className={pill(s.attended === true)}>Yes</button></form>
                        <form action={setAttendance.bind(null, s.id, s.attended === false ? null : false)}><button type="submit" className={pill(s.attended === false)}>No</button></form>
                      </div>
                    </td>
                  )}
                  {fc.followUpSentAt && <td className="whitespace-nowrap">{code ? <><span className="font-mono text-xs text-body">{code}</span>{used ? <Badge tone="green" className="ml-2">Enrolled</Badge> : null}</> : <span className="text-muted">–</span>}</td>}
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : <p className="p-5 text-sm text-muted">{fc.status === "open" ? "No sign-ups yet. Share the class page link on WhatsApp, Instagram and LinkedIn." : "No sign-ups yet. Publish the class to start taking sign-ups."}</p>}
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <FreeClassForm freeClass={fc} courses={courseList} timezone={settings.timezone} />
        <div className="flex flex-col gap-6 xl:sticky xl:top-24">
          <Card title="Follow-up">
            {fc.followUpSentAt ? (
              <div className="flex flex-col gap-3 text-sm text-body">
                <p>Sent {formatDateTime(fc.followUpSentAt, settings.timezone)}.</p>
                <dl className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-[5px] bg-panel p-3"><dd className="font-display text-xl font-bold text-ink">{active.length}</dd><dt className="text-xs text-muted">Emailed</dt></div>
                  <div className="rounded-[5px] bg-panel p-3"><dd className="font-display text-xl font-bold text-ink">{came}</dd><dt className="text-xs text-muted">Came</dt></div>
                  <div className="rounded-[5px] bg-panel p-3"><dd className="font-display text-xl font-bold text-ink">{usedCodes}</dd><dt className="text-xs text-muted">Enrolled</dt></div>
                </dl>
              </div>
            ) : (
              <ActionForm action={sendFollowUpNow.bind(null, id)} className="flex flex-col gap-3">
                <p className="text-sm text-muted">Goes out automatically an hour after the class ends{fc.offerPercent > 0 && fc.courseId ? `, with a personal ${fc.offerPercent}% code valid for ${fc.offerDays} days` : ""}. Add the recording link first if you have one.</p>
                {started && <div><SubmitButton pendingText="Sending…">Send it now</SubmitButton></div>}
              </ActionForm>
            )}
          </Card>
          <Card title="Delete this class">
            <p className="mb-4 text-sm text-muted">Removes the class and its sign-up list. Codes already sent keep working until they expire.</p>
            <DeleteButton action={deleteFreeClass.bind(null, id)} label="Delete class" />
          </Card>
        </div>
      </div>
    </>
  );
}
