import type { Metadata } from "next";
import { markAllRead } from "@/app/actions/account";
import { logout, resendVerification } from "@/app/actions/auth";
import { ActionButton } from "@/components/forms";
import { PortalShell } from "@/components/portal/shell";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { latestNotifications, toGradeCount, unreadCount } from "@/lib/portal";
import { relativeTime } from "@/lib/time";
import { studentId } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, unread, toGrade, recent] = await Promise.all([getSettings(), unreadCount(user.id), toGradeCount(user), latestNotifications(user.id)]);
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: settings.timezone, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date());

  return (
    <PortalShell
      role={user.role}
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
      siteName={settings.siteName}
      logoUrl={settings.logoUrl}
      unread={unread}
      toGrade={toGrade}
      today={today}
      studentId={user.role === "student" ? studentId(user) : undefined}
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
      {children}
    </PortalShell>
  );
}
