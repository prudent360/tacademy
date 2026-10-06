"use server";

import { and, count, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { FREE_CLASS_STATUSES, SESSION_MODES, courses, freeClasses, freeClassSignups } from "@/db/schema";
import { HEARD_FROM } from "@/lib/applications";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { parseLines } from "@/lib/careers";
import { getAdmins, getSettings } from "@/lib/data";
import { sendEmail } from "@/lib/email";
import { sendFollowUp } from "@/lib/free-class-jobs";
import { acceptingSignups, freeClassModeLabel, joinLine } from "@/lib/free-classes";
import { LEAD_BACKGROUNDS } from "@/lib/leads";
import { notify } from "@/lib/notify";
import { loginBlockedFor, recordLoginFailure } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/site";
import { formatSessionRange, fromZonedInput } from "@/lib/time";
import { firstName, slugify } from "@/lib/utils";
import { dateTimeValue, dialCode, email, firstError, formatPhone, formValues, optionalUrl, phoneNumber, required, text, type FormState } from "@/lib/validation";

const revalidate = () => {
  revalidatePath("/free-classes", "layout");
  revalidatePath("/admin/free-classes", "layout");
  revalidatePath("/");
};

// ---------- Classes (admin) ----------

const classSchema = z.object({
  title: required("Title", 120),
  slug: text(80),
  summary: required("Short summary", 300),
  description: text(10_000),
  courseId: z.coerce.number().int().catch(0),
  hostName: text(80),
  hostTitle: text(120),
  startsAt: dateTimeValue,
  endsAt: dateTimeValue,
  mode: z.enum(SESSION_MODES),
  meetingUrl: optionalUrl,
  venue: text(300),
  capacity: z.string().trim().refine((v) => v === "" || /^\d{1,5}$/.test(v), "Enter the number of places, or leave it empty for no limit."),
  status: z.enum(FREE_CLASS_STATUSES),
  offerPercent: z.coerce.number().int().min(0, "The offer can't be below 0%.").max(100, "The offer can't be above 100%."),
  offerDays: z.coerce.number().int().min(1, "The offer must last at least a day.").max(90, "Keep the offer to 90 days or less."),
  recordingUrl: optionalUrl,
});

export async function saveFreeClass(id: number | null, _state: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("free_classes.manage");
  const parsed = classSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;
  const tz = (await getSettings()).timezone;
  const startsAt = fromZonedInput(data.startsAt, tz);
  const endsAt = fromZonedInput(data.endsAt, tz);
  if (endsAt <= startsAt) return { error: "The class must end after it starts." };
  if (data.mode === "physical" && !data.venue) return { error: "Add the venue for an in-person class." };
  const slug = slugify(data.slug || data.title);
  if (!slug) return { error: "Add a title with letters or numbers." };
  const db = await getDb();
  const [clash] = await db.select({ id: freeClasses.id }).from(freeClasses).where(id ? and(eq(freeClasses.slug, slug), ne(freeClasses.id, id)) : eq(freeClasses.slug, slug));
  if (clash) return { error: `Another free class already uses the address /free-classes/${slug}. Change the title or the web address.` };
  const [course] = data.courseId ? await db.select({ id: courses.id }).from(courses).where(eq(courses.id, data.courseId)) : [];
  const [before] = id ? await db.select().from(freeClasses).where(eq(freeClasses.id, id)) : [];
  const values = {
    title: data.title,
    slug,
    summary: data.summary,
    description: data.description,
    takeaways: parseLines(formData.get("takeaways"), 8),
    courseId: course?.id ?? null,
    hostName: data.hostName,
    hostTitle: data.hostTitle,
    startsAt,
    endsAt,
    mode: data.mode,
    meetingUrl: data.meetingUrl || null,
    venue: data.venue,
    capacity: data.capacity ? Number(data.capacity) : null,
    status: data.status,
    offerPercent: data.offerPercent,
    offerDays: data.offerDays,
    recordingUrl: data.recordingUrl || null,
    // Moving a class to a new time re-arms its reminders.
    ...(before && before.startsAt.getTime() !== startsAt.getTime() ? { reminderDaySentAt: null, reminderHourSentAt: null } : {}),
    updatedAt: new Date(),
  };
  let classId = id;
  if (id) {
    await db.update(freeClasses).set(values).where(eq(freeClasses.id, id));
  } else {
    const [created] = await db.insert(freeClasses).values(values).returning({ id: freeClasses.id });
    classId = created.id;
  }
  await logAudit(actor, { action: id ? "free_class.updated" : "free_class.created", summary: `${id ? "updated" : "created"} the free class “${data.title}”`, target: { type: "free_class", id: classId! } });
  revalidate();
  if (!id) redirect(`/admin/free-classes/${classId}?created=1`);
  return { ok: data.status === "open" ? "Saved. Sign-ups are open on the Free classes page." : data.status === "draft" ? "Saved as a draft. Only the team can see it." : "Saved. The class is closed to new sign-ups." };
}

export async function setFreeClassStatus(id: number, status: (typeof FREE_CLASS_STATUSES)[number]): Promise<void> {
  const actor = await requirePermission("free_classes.manage");
  const db = await getDb();
  const [fc] = await db.update(freeClasses).set({ status, updatedAt: new Date() }).where(eq(freeClasses.id, id)).returning();
  if (fc) await logAudit(actor, { action: "free_class.status", summary: `${status === "open" ? "opened" : status === "closed" ? "closed" : "unpublished"} the free class “${fc.title}”`, target: { type: "free_class", id } });
  revalidate();
}

/** Deletes a class and its sign-ups. Discount codes already sent keep working until they expire. */
export async function deleteFreeClass(id: number): Promise<void> {
  const actor = await requirePermission("free_classes.manage");
  const [fc] = await (await getDb()).delete(freeClasses).where(eq(freeClasses.id, id)).returning();
  if (fc) await logAudit(actor, { action: "free_class.deleted", summary: `deleted the free class “${fc.title}”`, target: { type: "free_class", id } });
  revalidate();
  redirect("/admin/free-classes");
}

/** Records whether someone came. `null` clears it. */
export async function setAttendance(signupId: number, attended: boolean | null): Promise<void> {
  await requirePermission("free_classes.manage");
  await (await getDb()).update(freeClassSignups).set({ attended }).where(eq(freeClassSignups.id, signupId));
  revalidatePath("/admin/free-classes", "layout");
}

/** Sends the thank-you and offer now, instead of waiting for the hour after the class. */
export async function sendFollowUpNow(id: number): Promise<FormState> {
  const actor = await requirePermission("free_classes.manage");
  const [fc] = await (await getDb()).select().from(freeClasses).where(eq(freeClasses.id, id));
  if (!fc) return { error: "This class no longer exists." };
  if (fc.followUpSentAt) return { error: "The follow-up has already been sent." };
  const sent = await sendFollowUp(fc);
  await logAudit(actor, { action: "free_class.follow_up", summary: `sent the follow-up for “${fc.title}” to ${sent} ${sent === 1 ? "person" : "people"}`, target: { type: "free_class", id } });
  revalidatePath("/admin/free-classes", "layout");
  return { ok: `Follow-up sent to ${sent} ${sent === 1 ? "person" : "people"}.` };
}

// ---------- Signing up (public) ----------

const signupSchema = z.object({
  name: required("Full name", 120),
  email,
  dialCode,
  phone: phoneNumber,
  background: z.string().refine((v) => v === "" || (LEAD_BACKGROUNDS as readonly string[]).includes(v), "Choose what best describes you."),
  heardFrom: z.string().refine((v) => v === "" || (HEARD_FROM as readonly string[]).includes(v), "Choose where you heard about us."),
  website: text(200),
});

export type FreeClassSignupState = { error?: string } | undefined;

export async function signUpForFreeClass(classId: number, _state: FreeClassSignupState, formData: FormData): Promise<FreeClassSignupState> {
  const db = await getDb();
  const [fc] = await db.select().from(freeClasses).where(eq(freeClasses.id, classId));
  if (!fc) return { error: "This class isn't available any more." };
  const parsed = signupSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;
  // Bots fill the hidden "website" field; pretend it worked.
  if (data.website) redirect(`/free-classes/${fc.slug}?joined=1`);
  if (formData.get("consent") !== "on") return { error: "Please agree to the privacy policy so we can send you the class details." };

  const wait = await loginBlockedFor(data.email, "free_class");
  if (wait) return { error: `Too many attempts. Please try again in ${wait} minute${wait === 1 ? "" : "s"}.` };
  await recordLoginFailure(data.email, "free_class");

  const [existing] = await db.select().from(freeClassSignups).where(and(eq(freeClassSignups.classId, fc.id), eq(freeClassSignups.email, data.email)));
  if (existing && !existing.cancelledAt) redirect(`/free-classes/${fc.slug}?joined=1&again=1`);
  const [{ taken }] = await db.select({ taken: count() }).from(freeClassSignups).where(and(eq(freeClassSignups.classId, fc.id), isNull(freeClassSignups.cancelledAt)));
  if (!acceptingSignups(fc, taken)) return { error: fc.status === "open" && new Date(fc.startsAt) > new Date() ? "Sorry, this class is full." : "Sign-ups for this class have closed." };

  const values = {
    name: data.name,
    phone: formatPhone(data.dialCode, data.phone),
    background: data.background,
    heardFrom: data.heardFrom,
    whatsappOptIn: formData.get("whatsapp") === "on",
    consentAt: new Date(),
    cancelledAt: null,
  };
  if (existing) await db.update(freeClassSignups).set(values).where(eq(freeClassSignups.id, existing.id));
  else await db.insert(freeClassSignups).values({ classId: fc.id, email: data.email, ...values });

  const tz = (await getSettings()).timezone;
  await sendEmail(data.email, "free_class_confirmed", {
    name: firstName(data.name),
    classTitle: fc.title,
    when: formatSessionRange(fc.startsAt, fc.endsAt, tz),
    modeLabel: freeClassModeLabel(fc),
    location: joinLine(fc),
    calendarUrl: absoluteUrl(`/free-classes/${fc.slug}/calendar.ics`),
    classUrl: absoluteUrl(`/free-classes/${fc.slug}`),
  });
  // Only the first few sign-ups notify the team, so a popular class doesn't flood their inbox.
  if (taken < 3) {
    await notify((await getAdmins()).map((a) => a.id), { kind: "free_class", title: `New sign-up: ${fc.title}`, body: data.name, href: `/admin/free-classes/${fc.id}` });
  }
  revalidatePath("/admin/free-classes", "layout");
  redirect(`/free-classes/${fc.slug}?joined=1`);
}
