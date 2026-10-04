import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { can, getCurrentUser } from "@/lib/auth";
import { countryByCode } from "@/lib/countries";
import { peopleOrder, peopleWhere, readPeopleFilter, type PeopleSort } from "@/lib/people";
import { studentId } from "@/lib/utils";

function csv(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  // Quote everything and neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
}

/** CSV of the People list: the ticked people (?ids=1,2,3) or everyone matching the filters. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await can(user, "users.view"))) return new Response("Unauthorized", { status: 401 });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const ids = (params.ids ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const where = ids.length ? inArray(users.id, ids) : peopleWhere(readPeopleFilter(params));
  const rows = await (await getDb()).select().from(users).where(where).orderBy(...peopleOrder(params.sort as PeopleSort));
  const header = ["Student ID", "Name", "Email", "Phone", "Gender", "Country", "Role", "Status", "Joined", "Last signed in"];
  const status = (u: (typeof rows)[number]) => (!u.active ? "Deactivated" : !u.passwordHash ? "Invitation sent" : u.emailVerifiedAt ? "Verified" : "Email unverified");
  const lines = rows.map((u) => [u.role === "student" ? studentId(u) : "", u.name, u.email, u.phone, u.gender ?? "", countryByCode(u.country)?.name ?? "", u.role, status(u), u.createdAt.toISOString().slice(0, 10), u.lastLoginAt?.toISOString().slice(0, 10) ?? ""].map(csv).join(","));
  return new Response(`﻿${[header.map(csv).join(","), ...lines].join("\r\n")}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="people-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
