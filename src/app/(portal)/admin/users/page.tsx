import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { inviteUser } from "@/app/actions/admin";
import { ActionForm, Input, ModalButton, Select, SubmitButton } from "@/components/forms";
import { CapIcon, DownloadIcon, LayersIcon, PlusIcon, ShieldIcon, UsersIcon } from "@/components/icons";
import { StatTile } from "@/components/portal/dash";
import { Badge, buttonClass, DataTable, EmptyState, PageHeader, Pagination, PersonCell, TableToolbar } from "@/components/ui";
import { getDb } from "@/db";
import { enrollments, ROLES, users, type Role } from "@/db/schema";
import { relativeTime } from "@/lib/time";
import { parseStudentId, studentId } from "@/lib/utils";
import { can, requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "People" };

const PAGE_SIZE = 25;
const ROLE_TONE = { admin: "navy", instructor: "cyan", student: "accent", staff: "green" } as const;

type Search = { role?: string; q?: string; page?: string };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requirePermission("users.view");
  const canImport = await can(viewer, "users.manage");
  const params = await searchParams;
  const role = ROLES.find((r) => r === params.role) as Role | undefined;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const filters: SQL[] = [];
  if (role) filters.push(eq(users.role, role));
  const idFromQuery = parseStudentId(q);
  if (q) filters.push(idFromQuery ? eq(users.id, idFromQuery) : or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`))!);
  const where = filters.length ? and(...filters) : undefined;
  const db = await getDb();

  const [rows, [{ n: total }], byRole] = await Promise.all([
    db.select().from(users).where(where).orderBy(desc(users.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(users).where(where),
    db.select({ role: users.role, n: count() }).from(users).groupBy(users.role),
  ]);
  const ids = rows.map((r) => r.id);
  const courseCounts = ids.length
    ? await db.select({ userId: enrollments.userId, n: count() }).from(enrollments).where(and(inArray(enrollments.userId, ids), inArray(enrollments.status, ["active", "completed"]))).groupBy(enrollments.userId)
    : [];
  const roleCount = (r: Role) => byRole.find((b) => b.role === r)?.n ?? 0;
  const everyone = byRole.reduce((a, b) => a + b.n, 0);

  const url = (next: Partial<Search>) => {
    const merged = { role, q: q || undefined, page: undefined as string | undefined, ...next };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  };

  return (
    <>
      <PageHeader
        title="People"
        description="Students, instructors and admins. Students usually sign up themselves; invite staff here."
        actions={<>
          {canImport && <Link href="/admin/users/import" className={buttonClass.secondary}><DownloadIcon className="size-4 rotate-180" /> Import students</Link>}
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

      <TableToolbar
        action="/admin/users"
        q={q}
        placeholder="Search by name, email or student ID…"
        hidden={{ role }}
        filters={[
          { label: "Everyone", href: url({ role: undefined }), active: !role },
          { label: "Students", href: url({ role: "student" }), active: role === "student" },
          { label: "Instructors", href: url({ role: "instructor" }), active: role === "instructor" },
          { label: "Admins", href: url({ role: "admin" }), active: role === "admin" },
          { label: "Team", href: url({ role: "staff" }), active: role === "staff" },
        ]}
      />

      {rows.length ? (
        <>
          <DataTable>
            <thead><tr><th>Name</th><th>Role</th><th>Courses</th><th>Account</th><th>Joined</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td><PersonCell name={u.name} email={u.email} src={u.avatarUrl} gender={u.gender} href={`/admin/users/${u.id}`} /></td>
                  <td><Badge tone={ROLE_TONE[u.role]} className="capitalize">{u.role}</Badge>{u.role === "student" && <span className="mt-1 block font-mono text-xs text-muted">{studentId(u)}</span>}</td>
                  <td className="text-body">{courseCounts.find((c) => c.userId === u.id)?.n ?? 0}</td>
                  <td>{!u.active ? <Badge tone="red">Deactivated</Badge> : !u.passwordHash ? <Badge tone="amber">Invitation sent</Badge> : u.emailVerifiedAt ? <Badge tone="green">Verified</Badge> : <Badge>Email unverified</Badge>}</td>
                  <td className="whitespace-nowrap text-muted">{relativeTime(u.createdAt)}</td>
                  <td className="text-right"><Link href={`/admin/users/${u.id}`} className="inline-flex h-9 items-center rounded-lg border border-edge-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-page">Manage</Link></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} href={(n) => url({ page: String(n) })} />
        </>
      ) : (
        <EmptyState icon={UsersIcon} title="No one found">Try a different search or filter.</EmptyState>
      )}
    </>
  );
}
