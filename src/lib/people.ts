import "server-only";
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { ROLES, users, type Role } from "@/db/schema";
import { parseStudentId } from "./utils";

export const PEOPLE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "invited", label: "Invitation sent" },
  { value: "unverified", label: "Email unverified" },
  { value: "deactivated", label: "Deactivated" },
] as const;
export type PeopleStatus = (typeof PEOPLE_STATUSES)[number]["value"];

export const PEOPLE_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "active", label: "Last signed in" },
] as const;
export type PeopleSort = (typeof PEOPLE_SORTS)[number]["value"];

export type PeopleFilter = { role?: Role; status?: PeopleStatus; q?: string; country?: string };

/** Reads the People page's filters from its search params, ignoring anything unknown. */
export function readPeopleFilter(params: { role?: string; status?: string; q?: string; country?: string }): PeopleFilter {
  return {
    role: ROLES.find((r) => r === params.role),
    status: PEOPLE_STATUSES.find((s) => s.value === params.status)?.value,
    q: params.q?.trim() || undefined,
    country: params.country && /^[A-Z]{2}$/.test(params.country) ? params.country : undefined,
  };
}

export function peopleWhere({ role, status, q, country }: PeopleFilter): SQL | undefined {
  const filters: SQL[] = [];
  if (role) filters.push(eq(users.role, role));
  if (status === "active") filters.push(eq(users.active, true));
  if (status === "deactivated") filters.push(eq(users.active, false));
  if (status === "invited") filters.push(and(eq(users.active, true), isNull(users.passwordHash))!);
  if (status === "unverified") filters.push(and(eq(users.active, true), isNotNull(users.passwordHash), isNull(users.emailVerifiedAt))!);
  if (country) filters.push(eq(users.country, country));
  if (q) {
    const id = parseStudentId(q);
    filters.push(id ? eq(users.id, id) : or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.phone, `%${q}%`))!);
  }
  return filters.length ? and(...filters) : undefined;
}

export function peopleOrder(sort: PeopleSort | undefined) {
  if (sort === "oldest") return [asc(users.createdAt)];
  if (sort === "name") return [asc(users.name)];
  if (sort === "active") return [sql`${users.lastLoginAt} desc nulls last`, desc(users.createdAt)];
  return [desc(users.createdAt)];
}
