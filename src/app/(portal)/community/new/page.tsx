import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createCommunityPost } from "@/app/actions/community";
import { CommunityPostForm } from "@/components/community/post-form";
import { Card, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { canPostInCommunity } from "@/lib/community";
import { communityAccess } from "@/lib/community-access";

export const metadata: Metadata = { title: "New post" };

export default async function NewCommunityPostPage() {
  const user = await requireUser();
  if (!(await communityAccess(user)).member) redirect("/community/join");
  return (
    <>
      <PageHeader back={{ href: "/community", label: "Community" }} title="New post" description="Start a thread. People who reply are notified when the conversation continues." />
      {!canPostInCommunity(user) && <Notice tone="amber">Confirm your email address before posting. Use the link at the top of the page to resend it.</Notice>}
      <Card className="max-w-3xl">
        <CommunityPostForm action={createCommunityPost} submitLabel="Post" />
      </Card>
    </>
  );
}
