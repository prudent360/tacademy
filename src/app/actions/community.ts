"use server";

import { and, count, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { COMMUNITY_CATEGORIES, communityMemberships, communityPosts, communityReplies, users, type User } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { can, requirePermission, requireUser } from "@/lib/auth";
import { canPostInCommunity, COMMUNITY_LIMITS } from "@/lib/community";
import { communityAccess, grantMembership } from "@/lib/community-access";
import { rememberCheckout } from "@/lib/checkout-access";
import { startCommunityBankTransfer, startCommunityCheckout } from "@/lib/payments";
import { notify } from "@/lib/notify";
import { firstError, formValues, required, type FormState } from "@/lib/validation";

const revalidate = (postId?: number) => {
  revalidatePath("/community");
  if (postId) revalidatePath(`/community/${postId}`);
};

const postSchema = z.object({
  title: required("Title", 150),
  category: z.enum(COMMUNITY_CATEGORIES, "Choose a topic."),
  body: z.string().trim().min(10, "Add a little more detail so people can help.").max(10000, "Keep your post under 10,000 characters."),
});

const replySchema = z.object({
  body: z.string().trim().min(2, "Write a reply first.").max(5000, "Keep your reply under 5,000 characters."),
});

/** The reason this person can't post right now, or null if they can. */
async function postingBlocked(user: User, kind: "posts" | "replies"): Promise<string | null> {
  if (!canPostInCommunity(user)) return "Confirm your email address to post in the community. Check your inbox for the link.";
  if (!(await communityAccess(user)).member) return "Join the community to post and reply.";
  if (user.role !== "student") return null;
  const table = kind === "posts" ? communityPosts : communityReplies;
  const since = new Date(Date.now() - COMMUNITY_LIMITS.windowMinutes * 60_000);
  const [row] = await (await getDb()).select({ n: count() }).from(table).where(and(eq(table.authorId, user.id), gte(table.createdAt, since)));
  return (row?.n ?? 0) >= COMMUNITY_LIMITS[kind] ? "You've posted a lot in the last hour. Please wait a little before posting again." : null;
}

/** Authors can change their own posts and replies; moderators can change anyone's. */
async function canChange(user: User, authorId: number): Promise<boolean> {
  return user.id === authorId || (await can(user, "community.manage"));
}

// ---------- Posts ----------

export async function createCommunityPost(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const blocked = await postingBlocked(user, "posts");
  if (blocked) return { error: blocked };
  const parsed = postSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const [post] = await (await getDb()).insert(communityPosts).values({ ...parsed.data, authorId: user.id }).returning({ id: communityPosts.id });
  revalidate();
  redirect(`/community/${post.id}`);
}

export async function updateCommunityPost(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const db = await getDb();
  const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, id));
  if (!post || !(await canChange(user, post.authorId))) return { error: "This post no longer exists." };
  const parsed = postSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await db.update(communityPosts).set({ ...parsed.data, editedAt: new Date() }).where(eq(communityPosts.id, id));
  revalidate(id);
  redirect(`/community/${id}`);
}

export async function deleteCommunityPost(id: number): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, id));
  if (!post || !(await canChange(user, post.authorId))) return;
  await db.delete(communityPosts).where(eq(communityPosts.id, id));
  if (post.authorId !== user.id) {
    await logAudit(user, { action: "community.post_deleted", summary: `deleted the community post “${post.title}”`, target: { type: "community_post", id } });
  }
  revalidate();
  redirect("/community?deleted=1");
}

/** Moderators: pin a thread to the top, or lock it against new replies. */
export async function setCommunityPostFlag(id: number, flag: "pinned" | "locked", value: boolean): Promise<void> {
  const actor = await requirePermission("community.manage");
  const db = await getDb();
  const [post] = await db.update(communityPosts).set({ [flag]: value }).where(eq(communityPosts.id, id)).returning({ title: communityPosts.title });
  if (!post) return;
  const verb = flag === "pinned" ? (value ? "pinned" : "unpinned") : value ? "locked" : "unlocked";
  await logAudit(actor, { action: `community.${verb}`, summary: `${verb} the community post “${post.title}”`, target: { type: "community_post", id } });
  revalidate(id);
}

// ---------- Replies ----------

export async function createCommunityReply(postId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const db = await getDb();
  const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, postId));
  if (!post) return { error: "This post no longer exists." };
  if (post.locked && !(await can(user, "community.manage"))) return { error: "This thread is locked, so it can't take new replies." };
  const blocked = await postingBlocked(user, "replies");
  if (blocked) return { error: blocked };
  const parsed = replySchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const now = new Date();
  const [reply] = await db.insert(communityReplies).values({ postId, authorId: user.id, body: parsed.data.body, createdAt: now }).returning({ id: communityReplies.id });
  await db.update(communityPosts).set({ replyCount: sql`${communityPosts.replyCount} + 1`, lastActivityAt: now }).where(eq(communityPosts.id, postId));

  // Everyone already in the conversation hears about it, except the person replying.
  const others = await db.selectDistinct({ id: communityReplies.authorId }).from(communityReplies).where(and(eq(communityReplies.postId, postId), ne(communityReplies.authorId, user.id)));
  const recipients = [post.authorId, ...others.map((o) => o.id)].filter((id) => id !== user.id);
  await notify(recipients, {
    kind: "community",
    title: `${user.name} replied to “${post.title}”`,
    body: parsed.data.body.replace(/\s+/g, " ").slice(0, 140),
    href: `/community/${postId}#reply-${reply.id}`,
  });
  revalidate(postId);
  return { ok: "Reply posted." };
}

export async function deleteCommunityReply(id: number): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const [reply] = await db.select().from(communityReplies).where(eq(communityReplies.id, id));
  if (!reply || !(await canChange(user, reply.authorId))) return;
  await db.delete(communityReplies).where(eq(communityReplies.id, id));
  await db.update(communityPosts).set({ replyCount: sql`greatest(${communityPosts.replyCount} - 1, 0)` }).where(eq(communityPosts.id, reply.postId));
  if (reply.authorId !== user.id) {
    await logAudit(user, { action: "community.reply_deleted", summary: `deleted a reply in community post #${reply.postId}`, target: { type: "community_reply", id } });
  }
  revalidate(reply.postId);
}

// ---------- Membership ----------

/** Starts paying for community membership, online in the chosen currency or by bank transfer. */
export async function joinCommunity(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const access = await communityAccess(user);
  if (access.member && access.via !== "member") redirect("/community");
  const result = formData.get("method") === "bank"
    ? await startCommunityBankTransfer(user)
    : await startCommunityCheckout(user, String(formData.get("currency") ?? "").trim().toUpperCase().slice(0, 3));
  if ("error" in result) return { error: result.error };
  await rememberCheckout(result.reference);
  redirect(result.url);
}

/** The team gives someone membership without payment, e.g. a partner or a scholarship. */
export async function grantCommunityAccess(_state: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("community.manage");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const months = Number(formData.get("months"));
  if (!Number.isInteger(months) || months < 1 || months > 60) return { error: "Choose between 1 and 60 months." };
  const db = await getDb();
  const [person] = await db.select().from(users).where(eq(users.email, email));
  if (!person) return { error: "No account uses that email address. Ask them to sign up first." };
  const granted = await grantMembership(person.id, months, { grantedById: actor.id });
  if (!granted) return { error: "Couldn't add the membership. Try again." };
  const until = granted.endsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  await notify([person.id], { kind: "community", title: "You've been given community membership", body: `It runs until ${until}.`, href: "/community" });
  await logAudit(actor, { action: "community.granted", summary: `gave ${person.name} community membership until ${until}`, target: { type: "user", id: person.id }, details: { months } });
  revalidatePath("/admin/community");
  return { ok: `${person.name} is a member until ${until}.` };
}

/** Ends a period of membership straight away (it stays in the history). */
export async function revokeCommunityMembership(id: number): Promise<void> {
  const actor = await requirePermission("community.manage");
  const db = await getDb();
  const [row] = await db.update(communityMemberships).set({ revokedAt: new Date() }).where(and(eq(communityMemberships.id, id), isNull(communityMemberships.revokedAt))).returning({ userId: communityMemberships.userId });
  if (!row) return;
  const [person] = await db.select({ name: users.name }).from(users).where(eq(users.id, row.userId));
  await logAudit(actor, { action: "community.revoked", summary: `ended ${person?.name ?? "a member"}'s community membership`, target: { type: "user", id: row.userId } });
  revalidatePath("/admin/community");
}
