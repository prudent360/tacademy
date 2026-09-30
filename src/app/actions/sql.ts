"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { cohorts, courseModules, enrollments, lessons, quizQuestions, quizzes, sqlDatasets, type User } from "@/db/schema";
import { requireRole, requireUser } from "@/lib/auth";
import { SQL_MAX_SETUP_BYTES, sqlTablesSchema } from "@/lib/sql";
import { SAMPLE_DATASETS } from "@/lib/sql-samples";
import type { FormState } from "@/lib/validation";

async function usedBy(datasetId: number): Promise<number> {
  const [{ n }] = await (await getDb()).select({ n: count() }).from(quizQuestions).where(eq(quizQuestions.datasetId, datasetId));
  return n;
}

/** Admins can change any dataset; instructors the ones they added. */
async function editable(user: User, datasetId: number) {
  const [dataset] = await (await getDb()).select().from(sqlDatasets).where(eq(sqlDatasets.id, datasetId));
  if (!dataset) return null;
  return user.role === "admin" || dataset.createdById === user.id ? dataset : null;
}

function datasetFields(formData: FormData): { name: string; description: string } | { error: string } {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) return { error: "Give the dataset a name." };
  return { name, description: String(formData.get("description") ?? "").trim().slice(0, 600) };
}

/** The data itself, checked in the browser (it ran, and these are its tables) before it's sent. */
function datasetData(formData: FormData): { setupSql: string; tables: ReturnType<typeof sqlTablesSchema.parse> } | { error: string } {
  const setupSql = String(formData.get("setupSql") ?? "");
  if (!setupSql.trim()) return { error: "Add the data: upload CSV files or paste SQL." };
  if (new Blob([setupSql]).size > SQL_MAX_SETUP_BYTES) return { error: "That's too much data for a practice dataset. Keep it under 3 MB (a few tens of thousands of rows)." };
  let tables;
  try {
    tables = sqlTablesSchema.parse(JSON.parse(String(formData.get("tables") ?? "")));
  } catch {
    return { error: "Check the data first, so we can confirm it loads." };
  }
  if (!tables.length) return { error: "The data didn't create any tables." };
  return { setupSql, tables };
}

export async function createDataset(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("admin", "instructor");
  const fields = datasetFields(formData);
  if ("error" in fields) return fields;
  const data = datasetData(formData);
  if ("error" in data) return data;
  const [row] = await (await getDb()).insert(sqlDatasets).values({ ...fields, ...data, createdById: user.id }).returning({ id: sqlDatasets.id });
  revalidatePath("/teach/datasets");
  redirect(`/teach/datasets/${row.id}?created=1`);
}

export async function updateDataset(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("admin", "instructor");
  const dataset = await editable(user, id);
  if (!dataset) return { error: "You can only change datasets you added." };
  const fields = datasetFields(formData);
  if ("error" in fields) return fields;
  const changes: Partial<typeof sqlDatasets.$inferInsert> = { ...fields, updatedAt: new Date() };
  if (formData.get("setupSql") !== null) {
    // Changing the data would silently change the right answer to every question using it.
    if (await usedBy(id)) return { error: "Questions already use this dataset, so its data can't change. Create a new dataset instead." };
    const data = datasetData(formData);
    if ("error" in data) return data;
    Object.assign(changes, data);
  }
  await (await getDb()).update(sqlDatasets).set(changes).where(eq(sqlDatasets.id, id));
  revalidatePath("/teach/datasets", "layout");
  return { ok: "Dataset saved." };
}

export async function deleteDataset(id: number): Promise<void> {
  const user = await requireRole("admin", "instructor");
  if (!(await editable(user, id)) || (await usedBy(id))) return;
  await (await getDb()).delete(sqlDatasets).where(eq(sqlDatasets.id, id));
  revalidatePath("/teach/datasets", "layout");
  redirect("/teach/datasets");
}

/** Adds the ready-made practice datasets that aren't in the library yet. */
export async function addSampleDatasets(): Promise<void> {
  const user = await requireRole("admin", "instructor");
  const db = await getDb();
  const existing = new Set((await db.select({ name: sqlDatasets.name }).from(sqlDatasets)).map((d) => d.name));
  const missing = SAMPLE_DATASETS.filter((d) => !existing.has(d.name));
  if (missing.length) await db.insert(sqlDatasets).values(missing.map((d) => ({ ...d, createdById: user.id })));
  revalidatePath("/teach/datasets", "layout");
}

/**
 * The SQL that builds a dataset, for running in the browser. Staff can load any dataset; students only
 * ones used by a quiz in a course they're on.
 */
export async function loadDatasetSetup(id: number): Promise<string> {
  const user = await requireUser();
  const db = await getDb();
  if (user.role === "student") {
    const [allowed] = await db.select({ id: quizQuestions.id }).from(quizQuestions)
      .innerJoin(quizzes, eq(quizzes.id, quizQuestions.quizId))
      .innerJoin(lessons, eq(lessons.id, quizzes.lessonId))
      .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
      .innerJoin(cohorts, eq(cohorts.courseId, courseModules.courseId))
      .innerJoin(enrollments, eq(enrollments.cohortId, cohorts.id))
      .where(and(eq(quizQuestions.datasetId, id), eq(enrollments.userId, user.id), inArray(enrollments.status, ["active", "completed"])))
      .limit(1);
    if (!allowed) throw new Error("This dataset isn't available to you.");
  }
  const [dataset] = await db.select({ setupSql: sqlDatasets.setupSql }).from(sqlDatasets).where(eq(sqlDatasets.id, id));
  if (!dataset) throw new Error("This dataset no longer exists.");
  return dataset.setupSql;
}
