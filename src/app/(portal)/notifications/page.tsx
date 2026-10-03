import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { markAllRead } from "@/app/actions/account";
import { ActionButton } from "@/components/forms";
import { BellIcon, CardIcon, ClipboardIcon, ClockIcon, MegaphoneIcon, MessageIcon, CalendarIcon, BookIcon, type Icon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { relativeTime } from "@/lib/time";
import { NotificationLink } from "@/components/portal/notification-link";

export const metadata: Metadata = { title: "Notifications" };

const ICONS: Record<string, Icon> = {
  reminder: ClockIcon, assignment: ClipboardIcon, assignment_due: ClipboardIcon, feedback: MessageIcon, submission: ClipboardIcon,
  announcement: MegaphoneIcon, payment: CardIcon, enrollment: BookIcon, session: CalendarIcon,
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await (await getDb()).select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(100);
  const unread = rows.filter((r) => !r.readAt).length;

  return (
    <>
      <PageHeader title="Notifications" description="Reminders, feedback and updates from your classes." actions={unread > 0 && <ActionButton action={markAllRead} pendingText="Marking…">Mark all as read</ActionButton>} />
      {rows.length ? (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[14px] border border-edge bg-surface">
          {rows.map((n) => {
            const IconComponent = ICONS[n.kind] ?? BellIcon;
            const content = (
              <div className="flex gap-4 px-5 py-4">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${n.readAt ? "bg-page text-muted" : "bg-accent-soft text-accent-ink"}`}><IconComponent className="size-5" /></span>
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  <p className={`text-[15px] ${n.readAt ? "text-body" : "font-semibold text-ink"}`}>{n.title}</p>
                  {n.body && <p className="text-sm text-muted">{n.body}</p>}
                  <p className="text-xs text-muted">{relativeTime(n.createdAt)}</p>
                </div>
                {!n.readAt && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-cyan" aria-label="Unread" />}
              </div>
            );
            return <li key={n.id}>{n.href ? <NotificationLink id={n.id} href={n.href} unread={!n.readAt}>{content}</NotificationLink> : content}</li>;
          })}
        </ul>
      ) : (
        <EmptyState icon={BellIcon} title="No notifications yet">Class reminders, new assignments and feedback will show up here.</EmptyState>
      )}
      {rows.length === 100 && <p className="text-sm text-muted">Showing your latest 100 notifications. <Link href="/dashboard" className="text-accent-ink">Back to dashboard</Link></p>}
    </>
  );
}
