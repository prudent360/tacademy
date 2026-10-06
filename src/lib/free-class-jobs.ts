import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lte, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, discountCodes, freeClasses, freeClassSignups, type FreeClass } from "@/db/schema";
import { reminderConfig } from "./config";
import { getSettings } from "./data";
import { sendEmails, type OutgoingEmail } from "./email";
import { freeClassModeLabel, joinLine } from "./free-classes";
import { absoluteUrl } from "./site";
import { formatSessionRange } from "./time";
import { firstName } from "./utils";
import { sendWhatsApp, whatsappNumber } from "./whatsapp";

const HOUR = 60 * 60 * 1000;

async function activeSignups(classId: number) {
  return (await getDb()).select().from(freeClassSignups).where(and(eq(freeClassSignups.classId, classId), isNull(freeClassSignups.cancelledAt)));
}

/**
 * Day-before and about-to-start reminders for free classes, using the same timing as class reminders
 * (Settings › Reminders). Each is recorded on the class, so overlapping runs don't send twice.
 */
export async function sendFreeClassReminders(now = new Date()): Promise<number> {
  const db = await getDb();
  const cfg = await reminderConfig();
  const tz = (await getSettings()).timezone;
  const hourWindow = cfg.hourLeadMinutes + 15;
  const lookAhead = cfg.dayBefore ? 24 * 60 : cfg.hourBefore ? hourWindow : 0;
  if (!lookAhead) return 0;
  const upcoming = await db.select().from(freeClasses).where(and(ne(freeClasses.status, "draft"), gt(freeClasses.startsAt, now), lte(freeClasses.startsAt, new Date(now.getTime() + lookAhead * 60_000))));
  let sent = 0;
  for (const fc of upcoming) {
    const minutesAway = (new Date(fc.startsAt).getTime() - now.getTime()) / 60000;
    const kind = cfg.hourBefore && minutesAway <= hourWindow ? "hour" : "day";
    if (kind === "day" && (!cfg.dayBefore || fc.reminderDaySentAt || fc.reminderHourSentAt)) continue;
    if (kind === "hour" && fc.reminderHourSentAt) continue;
    const column = kind === "hour" ? freeClasses.reminderHourSentAt : freeClasses.reminderDaySentAt;
    const claimed = await db
      .update(freeClasses)
      .set(kind === "hour" ? { reminderHourSentAt: now, reminderDaySentAt: fc.reminderDaySentAt ?? now } : { reminderDaySentAt: now })
      .where(and(eq(freeClasses.id, fc.id), isNull(column)))
      .returning({ id: freeClasses.id });
    if (!claimed.length) continue;
    const leadTime = kind === "hour" ? (cfg.hourLeadMinutes >= 45 ? "starting in about an hour" : `starting in ${cfg.hourLeadMinutes} minutes`) : minutesAway >= 12 * 60 ? "tomorrow" : "later today";
    const vars = { classTitle: fc.title, when: formatSessionRange(fc.startsAt, fc.endsAt, tz), leadTime, modeLabel: freeClassModeLabel(fc), location: joinLine(fc), classUrl: absoluteUrl(`/free-classes/${fc.slug}`) };
    const signups = await activeSignups(fc.id);
    await sendEmails(signups.map((s) => ({ to: s.email, template: "free_class_reminder", vars: { name: firstName(s.name), ...vars } })));
    // Same reminder on WhatsApp for people who ticked "Also remind me on WhatsApp". Markdown bold doesn't apply there.
    const plainLocation = vars.location.replace(/\*\*/g, "");
    await sendWhatsApp(signups.flatMap((s) => {
      const to = s.whatsappOptIn ? whatsappNumber(s.phone) : null;
      return to ? [{ to, template: "free_class_reminder" as const, params: [firstName(s.name), fc.title, leadTime, vars.when, plainLocation] }] : [];
    }));
    sent += signups.length;
  }
  return sent;
}

/** A personal, single-use code like FREE-ADA-7K3Q. */
function personalCode(name: string): string {
  const letters = firstName(name).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "CLASS";
  return `FREE-${letters}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

/**
 * Emails everyone who signed up for a class: thanks, the recording if there is one, and (when the class has an offer
 * and a linked course) a personal single-use discount code. Claims the class first so it only happens once.
 */
export async function sendFollowUp(fc: FreeClass, now = new Date()): Promise<number> {
  const db = await getDb();
  const claimed = await db.update(freeClasses).set({ followUpSentAt: now }).where(and(eq(freeClasses.id, fc.id), isNull(freeClasses.followUpSentAt))).returning({ id: freeClasses.id });
  if (!claimed.length) return 0;
  const [course] = fc.courseId ? await db.select().from(courses).where(eq(courses.id, fc.courseId)) : [];
  const expiresAt = new Date(now.getTime() + fc.offerDays * 24 * HOUR);
  const validUntil = new Intl.DateTimeFormat("en-GB", { timeZone: (await getSettings()).timezone, weekday: "short", day: "numeric", month: "short" }).format(expiresAt);
  const outgoing: OutgoingEmail[] = [];
  for (const signup of await activeSignups(fc.id)) {
    let offer = "";
    let enrolUrl = absoluteUrl(course ? `/enroll?course=${course.slug}` : "/courses");
    if (course && fc.offerPercent > 0) {
      // Retry on the (unlikely) chance a code is already taken.
      for (let attempt = 0; attempt < 3 && !offer; attempt++) {
        const code = personalCode(signup.name);
        const [created] = await db.insert(discountCodes).values({ code, percentOff: fc.offerPercent, maxUses: 1, expiresAt }).onConflictDoNothing().returning({ id: discountCodes.id });
        if (!created) continue;
        await db.update(freeClassSignups).set({ discountCodeId: created.id }).where(eq(freeClassSignups.id, signup.id));
        offer = `As a thank-you, here's **${fc.offerPercent}% off** ${course.title} with your personal code **${code}**. It's valid until ${validUntil} and works once.`;
        enrolUrl = absoluteUrl(`/enroll?course=${course.slug}&code=${code}`);
      }
    }
    outgoing.push({
      to: signup.email,
      template: "free_class_follow_up",
      vars: {
        name: firstName(signup.name),
        classTitle: fc.title,
        courseTitle: course?.title ?? "one of our courses",
        recording: fc.recordingUrl ? `Missed a bit, or want to go over it again? [Watch the recording](${fc.recordingUrl}).` : "",
        offer,
        enrolUrl,
      },
    });
  }
  await sendEmails(outgoing);
  return outgoing.length;
}

/** Sends the follow-up for classes that ended at least an hour ago (and within the last week, so old classes stay quiet). */
export async function sendDueFollowUps(now = new Date()): Promise<number> {
  const db = await getDb();
  const due = await db.select().from(freeClasses).where(and(ne(freeClasses.status, "draft"), isNull(freeClasses.followUpSentAt), lte(freeClasses.endsAt, new Date(now.getTime() - HOUR)), gt(freeClasses.endsAt, new Date(now.getTime() - 7 * 24 * HOUR))));
  let sent = 0;
  for (const fc of due) sent += await sendFollowUp(fc, now);
  return sent;
}
