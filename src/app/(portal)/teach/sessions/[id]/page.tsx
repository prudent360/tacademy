import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteSession, updateSession } from "@/app/actions/teach";
import { ActionForm, Checkbox, DeleteButton, SubmitButton } from "@/components/forms";
import { AttendanceForm } from "@/components/teach/attendance-form";
import { SessionFields } from "@/components/teach/session-fields";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { UsersIcon } from "@/components/icons";
import { getDb } from "@/db";
import { attendance, classSessions } from "@/db/schema";
import { requireTeacher } from "@/lib/auth";
import { getCohortStudents, getCohortWithCourse, getSettings } from "@/lib/data";
import { formatSessionRange, toZonedInput } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Live class" };

export default async function TeachSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = idParam((await params).id);
  if (!id) notFound();
  const db = await getDb();
  const [session] = await db.select().from(classSessions).where(eq(classSessions.id, id));
  if (!session) notFound();
  await requireTeacher(session.cohortId);
  const [settings, found, students, marks] = await Promise.all([
    getSettings(),
    getCohortWithCourse(session.cohortId),
    getCohortStudents(session.cohortId),
    db.select().from(attendance).where(eq(attendance.sessionId, id)),
  ]);
  const tz = settings.timezone;
  const started = new Date(session.startsAt) <= new Date();

  return (
    <>
      <PageHeader back={{ href: `/teach/cohorts/${session.cohortId}?tab=classes`, label: found ? `${found.course.title}: ${found.cohort.name}` : "Cohort" }} title={session.title} description={formatSessionRange(session.startsAt, session.endsAt, tz)} />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card title="Attendance">
          {!started ? <p className="text-sm text-muted">You can take attendance once the class starts.</p>
            : students.length ? <AttendanceForm sessionId={id} students={students} marks={marks} />
            : <EmptyState icon={UsersIcon} title="No students enrolled yet" />}
        </Card>
        <Card title="Live class details">
          <ActionForm action={updateSession.bind(null, id)}>
            <SessionFields defaults={{
              title: session.title, description: session.description, mode: session.mode,
              startsAt: toZonedInput(session.startsAt, tz),
              durationMinutes: Math.round((+new Date(session.endsAt) - +new Date(session.startsAt)) / 60000),
              meetingUrl: session.meetingUrl, venue: session.venue, recordingUrl: session.recordingUrl,
            }} />
            <Checkbox label="Class is cancelled" name="cancelled" defaultChecked={session.cancelled} />
            <Checkbox label="Email students about changes to the time, place or cancellation" name="notifyStudents" defaultChecked />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SubmitButton>Save class</SubmitButton>
              <DeleteButton action={deleteSession.bind(null, id)} label="Delete class" />
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
