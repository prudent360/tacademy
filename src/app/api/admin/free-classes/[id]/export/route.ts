import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { discountCodes, freeClasses, freeClassSignups } from "@/db/schema";
import { can, getCurrentUser } from "@/lib/auth";
import { idParam } from "@/lib/validation";

function csv(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  // Quote everything and neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
}

/** CSV of one free class's sign-ups, in the order they signed up. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await can(user, "free_classes.manage"))) return new Response("Unauthorized", { status: 401 });
  const id = idParam((await params).id);
  if (!id) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [fc] = await db.select().from(freeClasses).where(eq(freeClasses.id, id));
  if (!fc) return new Response("Not found", { status: 404 });
  const rows = await db.select({ signup: freeClassSignups, code: discountCodes.code, used: discountCodes.usedCount }).from(freeClassSignups).leftJoin(discountCodes, eq(discountCodes.id, freeClassSignups.discountCodeId)).where(eq(freeClassSignups.classId, id)).orderBy(asc(freeClassSignups.createdAt));
  const header = ["Signed up", "Name", "Email", "Phone", "Describes them", "Heard from", "WhatsApp reminders", "Attended", "Discount code", "Code used", "Cancelled"];
  const lines = rows.map(({ signup: s, code, used }) => [s.createdAt.toISOString(), s.name, s.email, s.phone, s.background, s.heardFrom, s.whatsappOptIn ? "Yes" : "No", s.attended === null ? "" : s.attended ? "Yes" : "No", code ?? "", code ? (used ? "Yes" : "No") : "", s.cancelledAt ? "Yes" : ""].map(csv).join(","));
  return new Response([header.map(csv).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fc.slug}-signups.csv"`,
    },
  });
}
