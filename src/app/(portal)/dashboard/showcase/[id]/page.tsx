import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { saveShowcaseProject, withdrawShowcaseProject } from "@/app/actions/showcase";
import { ActionButton, ActionForm, FileField, Input, Textarea } from "@/components/forms";
import { ExternalIcon } from "@/components/icons";
import { Badge, buttonClass, Card, Notice, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { courses, showcaseProjects, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { SHOWCASE_STATUS_LABEL, SHOWCASE_STATUS_TONE } from "@/lib/showcase";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Showcase project" };

export default async function ShowcaseProjectEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ published?: string }> }) {
  const [{ id: raw }, { published }, user] = await Promise.all([params, searchParams, requireUser()]);
  const id = idParam(raw);
  if (!id) notFound();
  const db = await getDb();
  const [row] = await db.select({ project: showcaseProjects, courseTitle: courses.title, instructor: users.name }).from(showcaseProjects).leftJoin(courses, eq(courses.id, showcaseProjects.courseId)).leftJoin(users, eq(users.id, showcaseProjects.invitedById)).where(and(eq(showcaseProjects.id, id), eq(showcaseProjects.userId, user.id)));
  if (!row) notFound();
  const { project: p } = row;
  const live = p.status === "published";
  const button = "inline-flex h-11 cursor-pointer items-center justify-center rounded-lg px-6 text-[15px] font-semibold disabled:opacity-70";

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/showcase", label: "Showcase" }}
        title={p.title}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={SHOWCASE_STATUS_TONE[p.status]}>{SHOWCASE_STATUS_LABEL[p.status]}</Badge>{row.courseTitle}</span>}
        actions={live ? <Link href={`/projects/${p.slug}`} target="_blank" className={buttonClass.secondary}><ExternalIcon className="size-4" /> View on the Projects page</Link> : undefined}
      />
      {published && <Notice>Published! Share the link on LinkedIn and your CV.</Notice>}
      {p.status === "hidden" && <Notice tone="amber">The team has hidden this project from the Projects page. Contact us if you think that&apos;s a mistake.</Notice>}
      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Your project">
          <ActionForm action={saveShowcaseProject.bind(null, id)}>
            <Input label="Project title" name="title" defaultValue={p.title} required maxLength={120} hint="Make it about the result, e.g. “Which products drive Lagos sales? A Power BI dashboard”." />
            <Textarea label="Description" name="summary" defaultValue={p.summary} required rows={6} maxLength={1500} hint="A few sentences: the question or problem, what you built, and what you found. Write for an employer." />
            <Input label="Tools and skills" name="tools" defaultValue={p.tools.join(", ")} maxLength={300} placeholder="Power BI, DAX, Power Query" hint="Separate with commas." />
            <Input label="Link to your work" name="linkUrl" type="url" defaultValue={p.linkUrl ?? ""} placeholder="https://…" hint="A published dashboard, GitHub repo, notebook or slides. Make sure anyone with the link can view it." />
            <FileField label="Cover image" name="image" current={p.imageUrl} removeName="removeImage" hint="A screenshot of your dashboard or results. Landscape works best." previewClassName="h-20 w-32 rounded-md object-cover" />
            <div className="flex flex-wrap gap-3">
              {live ? (
                <button type="submit" name="intent" value="save" className={`${button} bg-accent text-white hover:bg-accent-dark`}>Save changes</button>
              ) : p.status !== "hidden" && (
                <>
                  <button type="submit" name="intent" value="publish" className={`${button} bg-accent text-white hover:bg-accent-dark`}>Publish</button>
                  <button type="submit" name="intent" value="save" className={`${button} border border-edge-strong bg-surface text-ink hover:bg-page`}>Save draft</button>
                </>
              )}
            </div>
          </ActionForm>
        </Card>
        <div className="flex flex-col gap-6">
          {(row.instructor || p.inviteNote) && (
            <Card title="Why it was picked">
              {p.inviteNote ? <blockquote className="border-l-2 border-accent pl-3 text-[15px] italic text-body">“{p.inviteNote}”</blockquote> : null}
              {row.instructor && <p className="mt-2 text-sm text-muted">Invited by {row.instructor}</p>}
            </Card>
          )}
          <Card title="What gets shown">
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-body">
              <li>Your name, the project title, description, tools, link and cover image.</li>
              <li>The course it was for, and a link to verify your certificate once you&apos;ve earned it.</li>
              <li>Never your email, phone number, grade or instructor feedback.</li>
            </ul>
          </Card>
          {(p.status === "invited" || live) && (
            <Card title={live ? "Take it down" : "Not for you?"}>
              <p className="mb-4 text-sm text-muted">{live ? "Removes it from the Projects page. You can publish it again later." : "Decline the invitation. You can change your mind later."}</p>
              <ActionButton action={withdrawShowcaseProject.bind(null, id)} variant="danger" pendingText="Saving…">{live ? "Unpublish" : "Decline"}</ActionButton>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
