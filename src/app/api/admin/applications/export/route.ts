import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { APPLICATION_STATUSES, internshipApplications } from "@/db/schema";
import { MODE_LABELS, STATUS_LABELS } from "@/lib/applications";
import { getCurrentUser, can } from "@/lib/auth";
import { countryByCode } from "@/lib/countries";

function csv(value: string | number | boolean | null | undefined): string {
  const s = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "");
  // Quote everything and neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
}

/** CSV of internship applications, newest first (optionally one status). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await can(user, "applications.review"))) return new Response("Unauthorized", { status: 401 });
  const status = APPLICATION_STATUSES.find((s) => s === new URL(request.url).searchParams.get("status"));
  const rows = await (await getDb()).select().from(internshipApplications).where(status ? eq(internshipApplications.status, status) : undefined).orderBy(desc(internshipApplications.createdAt));
  const header = ["Applied", "Status", "Name", "Email", "Phone", "Country", "City", "Graduate (said)", "Graduate (verified)", "Qualification", "Currently", "Area", "Experience", "Work mode", "Hours a week", "Laptop", "Internet", "Portfolio", "LinkedIn", "CV", "Motivation", "Heard from", "Notes"];
  const lines = rows.map((r) => [
    r.createdAt.toISOString(), STATUS_LABELS[r.status], r.name, r.email, r.phone, countryByCode(r.country)?.name ?? r.country, r.city, r.graduateClaimed, r.graduateVerified, r.qualification, r.currentStatus,
    r.skillArea, r.experience, MODE_LABELS[r.mode], r.hoursPerWeek, r.hasLaptop, r.hasInternet, r.portfolioUrl, r.linkedinUrl, r.cvUrl, r.motivation, r.heardFrom, r.adminNotes,
  ].map(csv).join(","));
  return new Response([header.map(csv).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="internship-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
