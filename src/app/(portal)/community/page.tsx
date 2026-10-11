import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { LockIcon, MessageIcon, PinIcon, PlusIcon, UsersIcon } from "@/components/icons";
import { Avatar, Badge, buttonClass, EmptyState, Notice, PageHeader, Pagination, TableToolbar } from "@/components/ui";
import { getDb } from "@/db";
import { COMMUNITY_CATEGORIES, communityPosts, users, type CommunityCategory } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { canPostInCommunity, COMMUNITY_CATEGORY_INFO, COMMUNITY_ROLE_BADGE } from "@/lib/community";
import { communityAccess } from "@/lib/community-access";
import { relativeTime } from "@/lib/time";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Community" };

const PAGE_SIZE = 20;

/** A one-line plain-text preview: code blocks dropped, Markdown symbols removed. */
const excerpt = (body: string) => body.replace(/```[\s\S]*?(```|$)/g, " ").replace(/[#*`>~]|\[|\]\([^)]*\)/g, "").replace(/\s+/g, " ").trim();

type Search = { topic?: string; q?: string; page?: string; deleted?: string; joined?: string };

export default async function CommunityPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [params, user] = await Promise.all([searchParams, requireUser()]);
  const access = await communityAccess(user);
  const topic = (COMMUNITY_CATEGORIES as readonly string[]).includes(params.topic ?? "") ? params.topic as CommunityCategory : undefined;
  const q = params.q?.trim().slice(0, 100) ?? "";
  const page = Math.max(1, Number(params.page) || 1);

  const filters: SQL[] = [];
  if (topic) filters.push(eq(communityPosts.category, topic));
  // Non-members search titles only, so post contents don't leak through the results.
  if (q) filters.push(access.member ? or(ilike(communityPosts.title, `%${q}%`), ilike(communityPosts.body, `%${q}%`))! : ilike(communityPosts.title, `%${q}%`));
  const where = filters.length ? and(...filters) : undefined;

  const db = await getDb();
  const [rows, [{ n: total }]] = await Promise.all([
    db.select({ post: communityPosts, author: { name: users.name, role: users.role, avatarUrl: users.avatarUrl, gender: users.gender } })
      .from(communityPosts).innerJoin(users, eq(users.id, communityPosts.authorId)).where(where)
      .orderBy(desc(communityPosts.pinned), desc(communityPosts.lastActivityAt), desc(communityPosts.id))
      .limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(communityPosts).where(where),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (next: Partial<Search>) => {
    const merged: Search = { topic, q: q || undefined, ...next };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/community?${qs}` : "/community";
  };

  return (
    <>
      <PageHeader
        title="Community"
        description="Ask questions, share wins and help each other. Open to every student, graduate and instructor at the academy."
        actions={access.member
          ? <Link href="/community/new" className={buttonClass.primary}><PlusIcon className="size-4" /> New post</Link>
          : <Link href="/community/join" className={buttonClass.primary}><UsersIcon className="size-4" /> Join the community</Link>}
      />
      {params.deleted && <Notice>Post deleted.</Notice>}
      {params.joined && access.member && <Notice>Welcome to the community! Introduce yourself in General.</Notice>}
      {!access.member && (
        <Notice tone="accent">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>{access.endedAt ? "Your membership has ended. Renew to read posts and join the conversation." : "You're seeing a preview. Join to read every post, ask questions and reply."} Membership is free with any course.</span>
            <Link href="/community/join" className="font-semibold text-accent-ink">{access.endedAt ? "Renew" : "See membership"} →</Link>
          </span>
        </Notice>
      )}
      {access.member && !canPostInCommunity(user) && <Notice tone="amber">Confirm your email address to post and reply. You can still read everything.</Notice>}
      <TableToolbar
        action="/community"
        q={q}
        placeholder="Search posts"
        hidden={{ topic }}
        filters={[
          { label: "All", href: href({ topic: undefined }), active: !topic },
          ...COMMUNITY_CATEGORIES.map((c) => ({ label: COMMUNITY_CATEGORY_INFO[c].label, href: href({ topic: c }), active: topic === c })),
        ]}
      />
      {rows.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-[5px] border border-edge bg-surface shadow-[0_1px_2px_rgba(24,19,64,.025)]">
          {rows.map(({ post: p, author }) => {
            const info = COMMUNITY_CATEGORY_INFO[p.category];
            const roleBadge = COMMUNITY_ROLE_BADGE[author.role];
            return (
              <li key={p.id}>
                <Link href={`/community/${p.id}`} className="flex gap-4 px-5 py-4 transition-colors hover:bg-accent-soft/25">
                  <Avatar name={author.name} src={author.avatarUrl} gender={author.gender} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {p.pinned && <><PinIcon className="size-4 text-accent-ink" /><span className="sr-only">Pinned:</span></>}
                      {p.locked && <><LockIcon className="size-4 text-muted" /><span className="sr-only">Locked:</span></>}
                      <span className="min-w-0 break-words">{p.title}</span>
                    </p>
                    {access.member && <p className="line-clamp-1 text-sm text-muted">{excerpt(p.body)}</p>}
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <Badge tone={info.tone}>{info.label}</Badge>
                      <span>{author.name}</span>
                      {roleBadge && <Badge tone="navy">{roleBadge}</Badge>}
                      <span aria-hidden>·</span>
                      <span>{p.replyCount ? `last reply ${relativeTime(p.lastActivityAt)}` : relativeTime(p.createdAt)}</span>
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 self-center text-sm font-semibold text-muted" title={plural(p.replyCount, "reply", "replies")}>
                    <MessageIcon className="size-4" /> {p.replyCount}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={MessageIcon}
          title={q || topic ? "No posts match" : "Start the conversation"}
          action={access.member ? <Link href="/community/new" className={buttonClass.primary}><PlusIcon className="size-4" /> New post</Link> : undefined}
        >
          {q || topic ? "Try another search or topic, or start a new thread." : "Be the first to post: introduce yourself, ask a question or share something you've learned."}
        </EmptyState>
      )}
      <Pagination page={page} pages={pages} href={(n) => href({ page: n > 1 ? String(n) : undefined })} />
    </>
  );
}
