import type { Metadata } from "next";
import { asc, inArray } from "drizzle-orm";
import { changeMemberRole, createRole, deleteRole, inviteTeamMember, removeFromTeam, resendTeamInvite, resetMemberTwoFactor, saveRolePermissions, setMemberActive, setTeamTwoFactorRequired } from "@/app/actions/team";
import { RoleSelect } from "@/components/admin/team-forms";
import { ActionButton, ActionForm, DeleteButton, Input, Select, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Card, DataTable, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { staffRoles, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Team & roles" };

export default async function TeamPage() {
  const me = await requirePermission("team.manage");
  const db = await getDb();
  const [roles, members, { timezone, requireStaffTwoFactor: requireTwoFactor }] = await Promise.all([
    db.select().from(staffRoles).orderBy(asc(staffRoles.createdAt), asc(staffRoles.name)),
    db.select().from(users).where(inArray(users.role, ["admin", "staff"])).orderBy(asc(users.createdAt)),
    getSettings(),
  ]);
  const roleOptions = [{ value: "admin", label: "Administrator" }, ...roles.map((r) => ({ value: r.key, label: r.name }))];
  const memberCount = (key: string) => members.filter((m) => m.role === "staff" && m.staffRoleKey === key).length;
  const roleName = (m: (typeof members)[number]) => (m.role === "admin" ? "Administrator" : roles.find((r) => r.key === m.staffRoleKey)?.name ?? "No role");

  return (
    <>
      <PageHeader title="Team & roles" description="Invite people to help run the academy, choose their roles and control what each role can do. Instructors are managed from cohorts, not here." />

      <Card title={`Team members (${members.length})`} padded={false}>
        <DataTable>
          <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Two-factor</th><th>Last sign-in</th><th className="text-right"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {members.map((m) => {
              const self = m.id === me.id;
              const status = !m.active ? { tone: "neutral" as const, label: "Deactivated" } : m.passwordHash ? { tone: "green" as const, label: "Active" } : { tone: "amber" as const, label: "Invited" };
              return (
                <tr key={m.id}>
                  <td>
                    <span className="flex items-center gap-3">
                      <Avatar name={m.name} src={m.avatarUrl} gender={m.gender} size="sm" />
                      <span className="flex min-w-0 flex-col"><span className="flex items-center gap-2 font-semibold text-ink">{m.name}{self && <Badge tone="accent">You</Badge>}</span><span className="truncate text-xs text-muted">{m.email}</span></span>
                    </span>
                  </td>
                  <td>{self || !m.active ? <span className="font-semibold text-ink">{roleName(m)}</span> : <RoleSelect action={changeMemberRole.bind(null, m.id)} current={m.role === "admin" ? "admin" : m.staffRoleKey ?? ""} roles={roleOptions} label={`Role for ${m.name}`} />}</td>
                  <td><Badge tone={status.tone}>{status.label}</Badge></td>
                  <td>{m.totpEnabledAt ? <Badge tone="green">On</Badge> : <Badge tone={requireTwoFactor ? "amber" : "neutral"}>Not set</Badge>}</td>
                  <td className="whitespace-nowrap text-sm text-muted">{m.lastLoginAt ? formatDateTime(m.lastLoginAt, timezone, { zone: false }) : "Never"}</td>
                  <td>
                    {!self && (
                      <span className="flex flex-wrap justify-end gap-2">
                        {m.totpEnabledAt && <DeleteButton action={resetMemberTwoFactor.bind(null, m.id)} label="Reset two-factor" />}
                        {m.active && !m.passwordHash && <ActionButton action={resendTeamInvite.bind(null, m.id)} pendingText="Sending…" doneText="Sent">Resend invite</ActionButton>}
                        {m.active
                          ? <DeleteButton action={setMemberActive.bind(null, m.id, false)} label="Deactivate" />
                          : <ActionButton action={setMemberActive.bind(null, m.id, true)} pendingText="…">Reactivate</ActionButton>}
                        {m.role === "staff" && <DeleteButton action={removeFromTeam.bind(null, m.id)} label="Remove from team" />}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
        <p className="border-t border-line px-5 py-3 text-xs text-muted md:px-6">Deactivating signs someone out straight away. There must always be at least one active administrator. Resetting two-factor helps someone who lost their phone; they set it up again next time.</p>
      </Card>

      <Card title="Two-factor sign-in" action={<Badge tone={requireTwoFactor ? "green" : "neutral"}>{requireTwoFactor ? "Required" : "Optional"}</Badge>}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-[720px] text-sm text-body">
            {requireTwoFactor
              ? "Administrators and team members must use a code from an authenticator app as well as their password. Anyone without it is asked to set it up before they can use the admin area."
              : `Anyone can switch on two-factor sign-in from their Account page. Requiring it protects payments and student data if a password leaks. ${members.filter((m) => m.active && m.totpEnabledAt).length} of ${members.filter((m) => m.active).length} active team members have it on.`}
          </p>
          {requireTwoFactor
            ? <DeleteButton action={setTeamTwoFactorRequired.bind(null, false)} label="Stop requiring it" />
            : me.totpEnabledAt
              ? <ActionButton action={setTeamTwoFactorRequired.bind(null, true)} variant="primary" pendingText="Saving…">Require it for the team</ActionButton>
              : <a href="/account#two-factor" className="inline-flex h-10 items-center rounded-lg border border-edge-strong px-4 text-sm font-semibold text-ink hover:bg-page">Set it up for yourself first</a>}
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card title="Invite a team member">
          <ActionForm action={inviteTeamMember} resetOnSuccess>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Full name" name="name" required />
              <Input label="Email address" name="email" type="email" required />
            </div>
            <Select label="Role" name="role" defaultValue={roles[0]?.key ?? "admin"} options={roleOptions} hint="They get an email to set their password. Someone who already has a student or instructor account keeps it and gains team access." />
            <div><SubmitButton>Send invitation</SubmitButton></div>
          </ActionForm>
        </Card>
        <Card title="Create a role">
          <ActionForm action={createRole} resetOnSuccess>
            <Input label="Role name" name="name" required placeholder="e.g. Marketing" />
            <Input label="What they do (optional)" name="description" placeholder="e.g. Course pages, discount codes and leads" />
            {roles.length > 0 && <Select label="Start from" name="copyFrom" defaultValue="" options={[{ value: "", label: "Nothing ticked" }, ...roles.map((r) => ({ value: r.key, label: `${r.name}'s permissions` }))]} />}
            <div><SubmitButton>Create role</SubmitButton></div>
          </ActionForm>
          {roles.length > 0 && (
            <ul className="mt-6 flex flex-col divide-y divide-line border-t border-line">
              {roles.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-4 py-3">
                  <span className="min-w-0"><span className="block font-semibold text-ink">{r.name}</span><span className="block text-xs text-muted">{r.description || "No description"} · {memberCount(r.key)} member{memberCount(r.key) === 1 ? "" : "s"}</span></span>
                  {memberCount(r.key) === 0 && <DeleteButton action={deleteRole.bind(null, r.key)} label="Delete" />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="What each role can do" padded={false}>
        <ActionForm action={saveRolePermissions} className="flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-panel text-left">
                  <th className="px-5 py-3 font-semibold text-muted md:px-6">Permission</th>
                  <th className="w-[110px] px-3 py-3 text-center font-semibold text-ink">Administrator</th>
                  {roles.map((r) => <th key={r.key} className="w-[110px] px-3 py-3 text-center font-semibold text-ink">{r.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group) => (
                  <PermissionGroupRows key={group.title} title={group.title} items={group.items} roles={roles} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 md:px-6">
            <p className="text-xs text-muted">Administrators always have everything. A role needs “Open the admin area” for anything else to work.</p>
            <SubmitButton>Save permissions</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}

function PermissionGroupRows({ title, items, roles }: { title: string; items: (typeof PERMISSION_GROUPS)[number]["items"]; roles: { key: string; name: string; permissions: string[] }[] }) {
  return (
    <>
      <tr className="border-b border-line"><td colSpan={roles.length + 2} className="bg-page/60 px-5 pb-1.5 pt-4 font-mono text-[11px] font-semibold uppercase tracking-[1.4px] text-accent md:px-6">{title}</td></tr>
      {items.map((item) => (
        <tr key={item.key} className="border-b border-line last:border-0 hover:bg-panel/60">
          <td className="px-5 py-3 md:px-6"><span className="block font-semibold text-ink">{item.label}</span><span className="block text-xs text-muted">{item.hint}</span></td>
          <td className="px-3 py-3 text-center"><input type="checkbox" checked readOnly disabled aria-label={`Administrator: ${item.label}`} className="size-4 accent-accent opacity-60" /></td>
          {roles.map((r) => (
            <td key={r.key} className="px-3 py-3 text-center">
              <input type="checkbox" name={`${r.key}:${item.key}`} defaultChecked={r.permissions.includes(item.key)} aria-label={`${r.name}: ${item.label}`} className="size-4 cursor-pointer accent-accent" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
