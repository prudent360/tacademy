import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { createCommunityReply, deleteCommunityPost, deleteCommunityReply, setCommunityPostFlag } from "@/app/actions/community";
import { ActionButton, ActionForm, DeleteButton, SubmitButton, Textarea } from "@/components/forms";
import { EditIcon, LockIcon, PinIcon, UsersIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { Avatar, Badge, buttonClass, Card, Notice, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { communityPosts, communityReplies, users, type Role } from "@/db/schema";
import { can, requireUser } from "@/lib/auth";
import { canPostInCommunity, COMMUNITY_CATEGORY_INFO, COMMUNITY_ROLE_BADGE } from "@/lib/community";
import { communityAccess } from "@/lib/community-access";
import { relativeTime } from "@/lib/time";
import { plural } from "@/lib/utils";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Community" };

type Author = { id: number; name: string; role: Role; avatarUrl: string | null; gender: "female" | "male" | null };

function Byline({ author, at, editedAt }: { author: Author; at: Date; editedAt: Date | null }) {
  const roleBadge = COMMUNITY_ROLE_BADGE[author.role];
  return (
    <div className="flex items-center gap-3">
      <Avatar name={author.name} src={author.avatarUrl} gender={author.gender} size="sm" />
      <div className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">{author.name}{roleBadge && <Badge tone="navy">{roleBadge}</Badge>}</span>
        <span className="text-xs text-muted" title={at.toISOString()}>{relativeTime(at)}{editedAt && " · edited"}</span>
      </div>
    </div>
  );
}

export default async function CommunityPostPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id: raw }, user] = await Promise.all([params, requireUser()]);
  const id = idParam(raw);
  if (!id) notFound();
  const db = await getDb();
  const author = { id: users.id, name: users.name, role: users.role, avatarUrl: users.avatarUrl, gender: users.gender };
  const [[row], replies, moderator, access] = await Promise.all([
    db.select({ post: communityPosts, author }).from(communityPosts).innerJoin(users, eq(users.id, communityPosts.authorId)).where(eq(communityPosts.id, id)),
    db.select({ reply: communityReplies, author }).from(communityReplies).innerJoin(users, eq(users.id, communityReplies.authorId)).where(eq(communityReplies.postId, id)).orderBy(asc(communityReplies.createdAt), asc(communityReplies.id)),
    can(user, "community.manage"),
    communityAccess(user),
  ]);
  if (!row) notFound();
  const { post: p } = row;
  const info = COMMUNITY_CATEGORY_INFO[p.category];
  const mayChangePost = moderator || p.authorId === user.id;
  const mayReply = canPostInCommunity(user) && (!p.locked || moderator);
  // Non-members get the title and who started it; the conversation itself is for members.
  const preview = !access.member && p.authorId !== user.id;

  return (
    <>
      <PageHeader
        back={{ href: "/community", label: "Community" }}
        title={p.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/community?topic=${p.category}`}><Badge tone={info.tone}>{info.label}</Badge></Link>
            {p.pinned && <Badge tone="accent"><PinIcon className="size-3.5" /> Pinned</Badge>}
            {p.locked && <Badge><LockIcon className="size-3.5" /> Locked</Badge>}
          </span>
        }
        actions={moderator ? (
          <>
            <ActionButton action={setCommunityPostFlag.bind(null, id, "pinned", !p.pinned)} pendingText="Saving…">{p.pinned ? "Unpin" : "Pin to top"}</ActionButton>
            <ActionButton action={setCommunityPostFlag.bind(null, id, "locked", !p.locked)} pendingText="Saving…">{p.locked ? "Unlock" : "Lock"}</ActionButton>
          </>
        ) : undefined}
      />

      {preview ? (
        <div className="flex max-w-3xl flex-col gap-4">
          <Card>
            <div className="flex flex-col gap-5">
              <Byline author={row.author} at={p.createdAt} editedAt={p.editedAt} />
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-edge-strong bg-panel px-6 py-10 text-center">
                <LockIcon className="size-8 text-muted" />
                <p className="font-display text-lg font-bold text-ink">This conversation is for members</p>
                <p className="max-w-md text-sm text-muted">{replies.length ? `${plural(replies.length, "reply", "replies")} so far. ` : ""}Join to read the post, reply and start your own threads. Membership is free with any course.</p>
                <Link href="/community/join" className={buttonClass.primary}><UsersIcon className="size-4" /> {access.via === "none" && access.endedAt ? "Renew membership" : "Join the community"}</Link>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="flex max-w-3xl flex-col gap-4">
          <Card>
            <div className="flex flex-col gap-4">
              <Byline author={row.author} at={p.createdAt} editedAt={p.editedAt} />
              <div className="break-words"><Markdown>{p.body}</Markdown></div>
              {mayChangePost && (
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <Link href={`/community/${id}/edit`} className={buttonClass.small}><EditIcon className="size-4" /> Edit</Link>
                  <DeleteButton action={deleteCommunityPost.bind(null, id)} label="Delete post" />
                </div>
              )}
            </div>
          </Card>

          <h2 className="mt-2 font-display text-lg font-bold text-ink">{replies.length ? plural(replies.length, "reply", "replies") : "No replies yet"}</h2>
          {replies.map(({ reply: r, author: a }) => (
            <Card key={r.id} id={`reply-${r.id}`} className="scroll-mt-24 target:ring-2 target:ring-accent/40">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <Byline author={a} at={r.createdAt} editedAt={r.editedAt} />
                  {(moderator || r.authorId === user.id) && <DeleteButton action={deleteCommunityReply.bind(null, r.id)} />}
                </div>
                <div className="break-words"><Markdown>{r.body}</Markdown></div>
              </div>
            </Card>
          ))}

          {p.locked && !moderator ? (
            <Notice tone="amber">This thread is locked, so it can&apos;t take new replies.</Notice>
          ) : mayReply && access.member ? (
            <Card title="Reply">
              <ActionForm action={createCommunityReply.bind(null, id)} resetOnSuccess>
                <Textarea label="Your reply" name="body" required rows={5} maxLength={5000} hint="Markdown works. Everyone in this thread is notified." />
                <SubmitButton pendingText="Posting…">Post reply</SubmitButton>
              </ActionForm>
            </Card>
          ) : (
            <Notice tone="amber">{access.member ? "Confirm your email address to reply." : "Your membership has ended. Renew to reply."}</Notice>
          )}
        </div>
      )}
    </>
  );
}
