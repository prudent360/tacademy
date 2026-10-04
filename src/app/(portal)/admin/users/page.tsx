import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, inArray, isNotNull } from "drizzle-orm";
import { inviteUser } from "@/app/actions/admin";
import { PeopleFilters, PeopleTable, type PersonRow } from "@/components/admin/people-table";
import { ActionForm, Input, ModalButton, Select, SubmitButton } from "@/components/forms";
import { CapIcon, DownloadIcon, LayersIcon, PlusIcon, ShieldIcon, UsersIcon } from "@/components/icons";
import { StatTile } from "@/components/portal/dash";
import { buttonClass, EmptyState, Notice, PageHeader, Pagination, TableToolbar } from "@/components/ui";
import { getDb } from "@/db";
import { emailLog, enrollments, users, type Role } from "@/db/schema";
import { countryByCode, flag } from "@/lib/countries";
import { INVITE_TEMPLATES, PEOPLE_SORTS, PEOPLE_STATUSES, peopleOrder, peopleWhere, readPeopleFilter, type PeopleSort } from "@/lib/people";
import { relativeTime } from "@/lib/time";
import { studentId } from "@/lib/utils";
import { can, requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "People" };

const PAGE_SIZE = 25;

type Search = { role?: string; status?: string; country?: string; sort?: string; q?: string; page?: string; deleted?: string };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requirePermission("users.view");
  const canManage = await can(viewer, "users.manage");
  const params = await searchParams;
  const filter = readPeopleFilter(params);
  const { role, status, q, country } = filter;
  const sort = PEOPLE_SORTS.find((s) => s.value === params.sort)?.value as PeopleSort | undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const where = peopleWhere(filter);
  const db = await getDb();

  const [rows, [{ n: total }], byRole, countryRows] = await Promise.all([
    db.select().from(users).where(where).orderBy(...peopleOrder(sort)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(users).where(where),
    db.select({ role: users.role, n: count() }).from(users).groupBy(users.role),
    db.selectDistinct({ country: users.country }).from(users).where(isNotNull(users.country)),
  ]);
  const ids = rows.map((r) => r.id);
  const courseCounts = ids.length
    ? await db.select({ userId: enrollments.userId, n: count() }).from(enrollments).where(and(inArray(enrollments.userId, ids), inArray(enrollments.status, ["active", "completed"]))).groupBy(enrollments.userId)
    : [];
  // Whether the latest set-password email to each invited person went out.
  const invitedEmails = rows.filter((u) => u.active && !u.passwordHash).map((u) => u.email);
  const inviteLog = invitedEmails.length
    ? await db.select({ to: emailLog.to, status: emailLog.status }).from(emailLog).where(and(inArray(emailLog.to, invitedEmails), inArray(emailLog.template, INVITE_TEMPLATES))).orderBy(desc(emailLog.id))
    : [];
  const inviteStatus = new Map<string, string>();
  for (const l of inviteLog) if (!inviteStatus.has(l.to)) inviteStatus.set(l.to, l.status);
  const roleCount = (r: Role) => byRole.find((b) => b.role === r)?.n ?? 0;
  const everyone = byRole.reduce((a, b) => a + b.n, 0);
  const countries = countryRows.map((c) => countryByCode(c.country)).filter((c) => c !== undefined).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ code: c.code, label: `${flag(c.code)} ${c.name}` }));
  const people: PersonRow[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    gender: u.gender,
    role: u.role,
    studentId: u.role === "student" ? studentId(u) : null,
    courses: courseCounts.find((c) => c.userId === u.id)?.n ?? 0,
    status: !u.active ? "deactivated" : !u.passwordHash ? (inviteStatus.get(u.email) === "failed" ? "invite_failed" : inviteStatus.get(u.email) === "queued" ? "invite_queued" : "invited") : u.emailVerifiedAt ? "verified" : "unverified",
    country: u.country ? flag(u.country) : null,
    joined: relativeTime(u.createdAt),
    lastLogin: u.lastLoginAt ? relativeTime(u.lastLoginAt) : null,
  }));
  const filtered = Boolean(role || status || q || country);

  const url = (next: Partial<Search>) => {
    const merged: Search = { role, status, country, sort, q, page: undefined, ...next };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  };

  return (
    <>
      <PageHeader
        title="People"
        description="Students, instructors and admins. Students usually sign up themselves; invite staff here."
        actions={<>
          {canManage && <Link href="/admin/users/import" className={buttonClass.secondary}><DownloadIcon className="size-4 rotate-180" /> Import students</Link>}
          <ModalButton label="Invite someone" title="Invite someone" icon={<PlusIcon className="size-4" />}>
            <ActionForm action={inviteUser}>
              <Input label="Full name" name="name" required />
              <Input label="Email" name="email" type="email" required />
              <Select label="Role" name="role" defaultValue="instructor" options={[{ value: "instructor", label: "Instructor" }, { value: "admin", label: "Admin" }, { value: "student", label: "Student" }]} />
              <p className="text-[13px] text-muted">They&apos;ll get an email with a link to set their password (valid for 7 days).</p>
              <SubmitButton pendingText="Inviting…">Send invitation</SubmitButton>
            </ActionForm>
          </ModalButton>
        </>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Everyone" value={everyone} icon={UsersIcon} tone="purple" href="/admin/users" />
        <StatTile label="Students" value={roleCount("student")} icon={CapIcon} tone="cyan" href={url({ role: "student" })} />
        <StatTile label="Instructors" value={roleCount("instructor")} icon={LayersIcon} tone="green" href={url({ role: "instructor" })} />
        <StatTile label="Admins" value={roleCount("admin")} icon={ShieldIcon} tone="navy" href={url({ role: "admin" })} />
      </div>

      {params.deleted && <Notice>Account deleted.</Notice>}

      <TableToolbar
        action="/admin/users"
        q={q}
        placeholder="Search by name, email, phone or student ID…"
        hidden={{ role, status, country, sort }}
        filters={[
          { label: "Everyone", href: url({ role: undefined }), active: !role },
          { label: "Students", href: url({ role: "student" }), active: role === "student" },
          { label: "Instructors", href: url({ role: "instructor" }), active: role === "instructor" },
          { label: "Admins", href: url({ role: "admin" }), active: role === "admin" },
          { label: "Team", href: url({ role: "staff" }), active: role === "staff" },
        ]}
        right={<PeopleFilters status={status} sort={sort} country={country} countries={countries} statuses={PEOPLE_STATUSES} sorts={PEOPLE_SORTS} />}
      />

      {filtered && (
        <p className="-mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          {total.toLocaleString()} {total === 1 ? "person matches" : "people match"}{q ? <> “{q}”</> : null}.
          <Link href="/admin/users" className="font-semibold text-accent-ink hover:underline">Clear filters</Link>
        </p>
      )}

      {people.length ? (
        <>
          <PeopleTable rows={people} total={total} filter={{ role, status, q, country }} canManage={canManage} />
          <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} href={(n) => url({ page: String(n) })} />
        </>
      ) : (
        <EmptyState icon={UsersIcon} title="No one found">Try a different search or filter.</EmptyState>
      )}
    </>
  );
}
