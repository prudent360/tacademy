"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { courses, programmeCourses, programmes } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parsePrices } from "@/lib/money";
import { deleteIfReplaced, deleteUpload } from "@/lib/storage";
import { resolveFileField, uploadErrorMessage } from "@/lib/upload-field";
import { parseList, slugify } from "@/lib/utils";
import { firstError, formValues, required, sortValue, text, type FormState } from "@/lib/validation";

const programmeSchema = z.object({
  title: required("Name", 160),
  slug: text(80),
  summary: required("Summary", 400),
  description: text(50_000),
  category: text(60),
  level: text(40),
  duration: required("Duration", 60),
  feeNote: text(200),
  instalmentCount: z.string().trim().refine((v) => v === "" || (/^\d{1,2}$/.test(v) && Number(v) >= 2 && Number(v) <= 12), "Instalments must be a number from 2 to 12."),
  instalmentFirstPercent: z.string().trim().refine((v) => v === "" || (/^\d{1,2}$/.test(v) && Number(v) >= 10 && Number(v) <= 90), "The first instalment must be between 10% and 90%."),
  sortOrder: sortValue,
  seoTitle: text(70),
  seoDescription: text(200),
});

async function imageField(formData: FormData, file: string, remove: string, current: string | null): Promise<{ url: string | null } | { error: string }> {
  try {
    return { url: await resolveFileField(formData, { file, remove, current, folder: "courses" }) };
  } catch (error) {
    const message = uploadErrorMessage(error);
    if (message) return { error: message };
    throw error;
  }
}

/** The ticked courses (regular courses only, not internships), ordered by their "Order" boxes, then as listed. */
async function chosenCourses(formData: FormData): Promise<number[]> {
  const ticked = formData.getAll("courseIds").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!ticked.length) return [];
  const valid = new Set((await (await getDb()).select({ id: courses.id }).from(courses).where(and(inArray(courses.id, ticked), eq(courses.kind, "course")))).map((c) => c.id));
  const order = (id: number) => {
    const raw = String(formData.get(`position-${id}`) ?? "").trim();
    return raw && Number.isFinite(Number(raw)) ? Number(raw) : Number.MAX_SAFE_INTEGER;
  };
  return ticked.filter((id) => valid.has(id)).map((id, i) => ({ id, i, at: order(id) })).sort((a, b) => a.at - b.at || a.i - b.i).map((c) => c.id);
}

async function saveProgramme(id: number | null, formData: FormData): Promise<FormState | number> {
  const actor = await requirePermission("courses.manage");
  const parsed = programmeSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const slug = slugify(parsed.data.slug || parsed.data.title);
  if (!slug) return { error: "Add a name with letters or numbers." };
  const courseIds = await chosenCourses(formData);
  if (courseIds.length < 2) return { error: "Choose at least two courses for the programme." };
  const priced = parsePrices(formData, "price", "fee");
  if ("error" in priced) return priced;
  const instalmentCount = parsed.data.instalmentCount ? Number(parsed.data.instalmentCount) : null;
  const instalmentFirstPercent = instalmentCount && parsed.data.instalmentFirstPercent ? Number(parsed.data.instalmentFirstPercent) : null;
  if (instalmentCount && !Object.keys(priced.prices).length) return { error: "Set a programme fee before offering instalments." };
  const db = await getDb();
  const clash = await db.select({ id: programmes.id }).from(programmes).where(id ? and(eq(programmes.slug, slug), ne(programmes.id, id)) : eq(programmes.slug, slug));
  if (clash.length) return { error: `Another programme already uses the address "/programmes/${slug}".` };
  const [existing] = id ? await db.select().from(programmes).where(eq(programmes.id, id)) : [];
  const image = await imageField(formData, "image", "removeImage", existing?.imageUrl ?? null);
  if ("error" in image) return image;
  const hero = await imageField(formData, "heroImage", "removeHeroImage", existing?.heroImageUrl ?? null);
  if ("error" in hero) return hero;

  const values = {
    ...parsed.data,
    slug,
    prices: priced.prices,
    instalmentCount,
    instalmentFirstPercent,
    outcomes: parseList(formData.get("outcomes"), /\n/).slice(0, 20),
    jobRoles: parseList(formData.get("jobRoles"), /\n/).slice(0, 20),
    published: formData.get("published") === "on",
    imageUrl: image.url,
    heroImageUrl: hero.url,
    updatedAt: new Date(),
  };
  let savedId = id;
  if (id) {
    await db.update(programmes).set(values).where(eq(programmes.id, id));
    await deleteIfReplaced(existing?.imageUrl, image.url);
    await deleteIfReplaced(existing?.heroImageUrl, hero.url);
  } else {
    [{ id: savedId }] = await db.insert(programmes).values(values).returning({ id: programmes.id }) as [{ id: number }];
  }
  await db.delete(programmeCourses).where(eq(programmeCourses.programmeId, savedId!));
  await db.insert(programmeCourses).values(courseIds.map((courseId, position) => ({ programmeId: savedId!, courseId, position })));
  await logAudit(actor, { action: id ? "programme.updated" : "programme.created", summary: `${id ? "updated" : "created"} the programme “${values.title}”`, target: { type: "programme", id: savedId! }, details: { courseIds, prices: values.prices } });
  revalidatePath("/", "layout");
  return savedId!;
}

export async function createProgramme(_state: FormState, formData: FormData): Promise<FormState> {
  const result = await saveProgramme(null, formData);
  if (typeof result !== "number") return result;
  redirect(`/admin/programmes/${result}?created=1`);
}

export async function updateProgramme(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const result = await saveProgramme(id, formData);
  return typeof result === "number" ? { ok: "Programme saved." } : result;
}

export async function deleteProgramme(id: number): Promise<void> {
  const actor = await requirePermission("courses.manage");
  const [removed] = await (await getDb()).delete(programmes).where(eq(programmes.id, id)).returning({ title: programmes.title, imageUrl: programmes.imageUrl, heroImageUrl: programmes.heroImageUrl });
  await Promise.all([deleteUpload(removed?.imageUrl), deleteUpload(removed?.heroImageUrl)]);
  if (removed) await logAudit(actor, { action: "programme.deleted", summary: `deleted the programme “${removed.title}”`, target: { type: "programme", id } });
  revalidatePath("/", "layout");
  redirect("/admin/programmes");
}
