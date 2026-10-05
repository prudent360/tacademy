import type { Metadata } from "next";
import { cookies } from "next/headers";
import { markAllRead } from "@/app/actions/account";
import { AnnouncementModal } from "@/components/portal/announcement-modal";
import { logout, resendVerification } from "@/app/actions/auth";
import { ActionButton } from "@/components/forms";
import { PortalShell, type Theme } from "@/components/portal/shell";
import { permissionsFor, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { latestNotifications, toGradeCount, unreadCount } from "@/lib/portal";
import { relativeTime } from "@/lib/time";
import { studentId } from "@/lib/utils";
import { xpForUser } from "@/lib/xp";
import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { instructorApplications, jobApplications, internshipApplications } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, unread, toGrade, recent] = await Promise.all([getSettings(), unreadCount(user.id), toGradeCount(user), latestNotifications(user.id)]);
  const xp = user.role === "student" ? await xpForUser(user.id, 0) : null;
  const perms = await permissionsFor(user);
  const savedTheme = (await cookies()).get("tk-theme")?.value;
  const theme: Theme = savedTheme === "dark" || savedTheme === "system" ? savedTheme : "light";
  const newApplications = perms.has("applications.review") ? (await (await getDb()).select({ n: count() }).from(internshipApplications).where(eq(internshipApplications.status, "new")))[0]?.n ?? 0 : 0;
  const newJobApplications = perms.has("careers.manage") ? (await (await getDb()).select({ n: count() }).from(jobApplications).where(eq(jobApplications.status, "new")))[0]?.n ?? 0 : 0;
  const newInstructorApplications = perms.has("instructors.review") ? (await (await getDb()).select({ n: count() }).from(instructorApplications).where(eq(instructorApplications.status, "new")))[0]?.n ?? 0 : 0;

  // The admin's dashboard pop-up, until this person closes this version of it.
  const a = settings.announcement ?? {};
  const announcement = a.enabled && a.version && a.title && user.announcementSeen !== a.version && (a.audience === "everyone" || user.role === "student")
    ? { title: a.title, body: a.body ?? "", buttonLabel: a.buttonLabel ?? "", buttonUrl: a.buttonUrl ?? "", version: a.version }
    : null;

  return (
    <PortalShell
      role={user.role}
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl, gender: user.gender }}
      siteName={settings.siteName}
      logoUrl={settings.logoUrl}
      logoDarkUrl={settings.logoDarkUrl}
      theme={theme}
      unread={unread}
      toGrade={toGrade}
      newApplications={newApplications}
      newInstructorApplications={newInstructorApplications}
      newJobApplications={newJobApplications}
      permissions={[...perms]}
      referrals={settings.referrals?.enabled === true}
      studentId={user.role === "student" ? studentId(user) : undefined}
      xp={xp ? { level: xp.level, total: xp.total, percent: xp.percent, toNext: xp.next - xp.total } : undefined}
      notifications={recent.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, read: Boolean(n.readAt), when: relativeTime(n.createdAt) }))}
      logout={logout}
      markAllRead={markAllRead}
    >
      {!user.emailVerifiedAt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-900">
          <p>Please confirm your email address (<strong>{user.email}</strong>) so reminders and feedback reach you.</p>
          <ActionButton action={resendVerification} pendingText="Sending…" doneText="Sent. Check your inbox">Resend confirmation email</ActionButton>
        </div>
      )}
      {announcement && <AnnouncementModal {...announcement} />}
      {children}
    </PortalShell>
  );
}
