import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { classSessions } from "@/db/schema";
import { canTeach, getCurrentUser } from "@/lib/auth";
import { getCohortWithCourse, isEnrolled } from "@/lib/data";
import { buildIcs } from "@/lib/ics";
import { absoluteUrl } from "@/lib/site";
import { idParam } from "@/lib/validation";

/** Calendar file for one class, or the whole cohort timetable with ?all=1. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const id = idParam((await params).id);
  if (!user || !id) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [session] = await db.select().from(classSessions).where(eq(classSessions.id, id));
  if (!session) return new Response("Not found", { status: 404 });
  if (!(await isEnrolled(user.id, session.cohortId)) && !(await canTeach(user, session.cohortId))) return new Response("Not found", { status: 404 });

  const found = await getCohortWithCourse(session.cohortId);
  const all = new URL(request.url).searchParams.get("all") === "1";
  const sessions = all ? await db.select().from(classSessions).where(eq(classSessions.cohortId, session.cohortId)) : [session];
  const url = absoluteUrl(`/dashboard/cohorts/${session.cohortId}`);
  const ics = buildIcs(sessions.map((s) => ({ session: s, courseTitle: found?.course.title ?? "", url })), found ? `${found.course.title} – ${found.cohort.name}` : "Classes");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${all ? "timetable" : `class-${session.id}`}.ics"`,
    },
  });
}
