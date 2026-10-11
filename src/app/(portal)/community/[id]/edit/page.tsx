import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { updateCommunityPost } from "@/app/actions/community";
import { CommunityPostForm } from "@/components/community/post-form";
import { Card, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { communityPosts } from "@/db/schema";
import { can, requireUser } from "@/lib/auth";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditCommunityPostPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id: raw }, user] = await Promise.all([params, requireUser()]);
  const id = idParam(raw);
  if (!id) notFound();
  const [post] = await (await getDb()).select().from(communityPosts).where(eq(communityPosts.id, id));
  if (!post || (post.authorId !== user.id && !(await can(user, "community.manage")))) notFound();
  return (
    <>
      <PageHeader back={{ href: `/community/${id}`, label: "Back to post" }} title="Edit post" />
      <Card className="max-w-3xl">
        <CommunityPostForm action={updateCommunityPost.bind(null, id)} initial={post} submitLabel="Save changes" />
      </Card>
    </>
  );
}
