"use client";

import Link from "next/link";
import { markRead } from "@/app/actions/account";

/** Opens a notification's target and marks it read. */
export function NotificationLink({ id, href, unread, children }: { id: number; href: string; unread: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={() => { if (unread) void markRead(id); }} className="block hover:bg-panel">
      {children}
    </Link>
  );
}
