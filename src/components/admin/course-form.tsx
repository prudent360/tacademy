import { ActionForm, Checkbox, FileField, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { draftCourseText } from "@/app/actions/ai";
import { AiDraftButton } from "@/components/ai/draft-button";
import type { Course } from "@/db/schema";
import type { FormState } from "@/lib/validation";
import { RichTextEditor } from "@/components/rich-text-editor";

type Kind = "course" | "internship";

/** Shared by courses and internship programmes; internships add the courses whose graduates join free. */
export function CourseForm({ action, course, ai = false, kind = "course", linkable = [], linked = [] }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  course?: Course;
  ai?: boolean;
  kind?: Kind;
  /** Internships only: courses that can be linked, and those already linked. */
  linkable?: { id: number; title: string }[];
  linked?: number[];
}) {
  const internship = kind === "internship";
  const noun = internship ? "internship" : "course";
  return (
    <ActionForm action={action}>
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-5 md:grid-cols-2">
        <Input label="Title" name="title" defaultValue={course?.title} required />
        <Input label="Web address" name="slug" defaultValue={course?.slug} hint="Leave empty to generate from the title." />
      </div>
      <Textarea label="Summary" name="summary" defaultValue={course?.summary} rows={2} required hint={`One or two sentences for ${noun} cards and search results.`} />
      <RichTextEditor label="Full description" name="description" defaultValue={course?.description} minHeight={280} placeholder={internship ? "Describe the internship: who it's for, the projects interns work on and what they'll leave with." : "Describe the course: who it's for, what they'll do and what they'll leave with."} hint={`Shown on the ${noun} page.`} />
      {ai && <AiDraftButton draft={draftCourseText.bind(null, "description")} label="Draft description with AI" />}
      <Textarea label="Learning outcomes" name="outcomes" defaultValue={course?.outcomes.join("\n")} rows={5} hint="One per line." />
      {ai && <AiDraftButton draft={draftCourseText.bind(null, "outcomes")} label="Draft outcomes with AI" />}
      {internship && (
        <fieldset className="flex flex-col gap-3 rounded-[5px] border border-edge bg-panel p-4">
          <legend className="px-1 text-sm font-semibold text-ink">Linked courses</legend>
          <p className="text-[13px] text-muted">Graduates of these courses join this internship&apos;s “free for graduates” intakes without paying. Leave all unticked to let graduates of any course join free.</p>
          {linkable.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {linkable.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-edge bg-white px-3.5 py-2.5 text-sm font-semibold text-ink hover:bg-page has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                  <input type="checkbox" name="linkedCourseIds" value={c.id} defaultChecked={linked.includes(c.id)} className="size-4 accent-accent" />{c.title}
                </label>
              ))}
            </div>
          ) : <p className="text-sm text-muted">No courses yet. Create courses first to link them.</p>}
        </fieldset>
      )}
      <Textarea label={internship ? "Programme outline" : "Curriculum"} name="curriculum" defaultValue={course?.curriculum.map((module) => `${module.title}${module.summary ? ` | ${module.summary}` : ""}`).join("\n")} rows={7} hint="One module per line: Module title | short description" />
      {ai && <AiDraftButton draft={draftCourseText.bind(null, "curriculum")} label="Draft curriculum with AI" />}
      <div className="grid gap-5 md:grid-cols-2">
        <Textarea label="Portfolio projects" name="portfolioProjects" defaultValue={course?.portfolioProjects.join("\n")} rows={4} hint="One practical project per line." />
        <Textarea label="Relevant job roles" name="jobRoles" defaultValue={course?.jobRoles.join("\n")} rows={4} hint="One role per line." />
      </div>
      <div className="grid gap-5 md:grid-cols-4">
        <Input label="Category" name="category" defaultValue={course?.category} placeholder="Data" />
        <Select label="Level" name="level" defaultValue={course?.level ?? "Beginner"} options={["Beginner", "Intermediate", "Advanced", "All levels"].map((v) => ({ value: v, label: v }))} />
        <Input label="Duration (weeks)" name="durationWeeks" type="number" min={1} max={200} defaultValue={course?.durationWeeks ?? ""} />
        <Input label="Sort order" name="sortOrder" type="number" defaultValue={course?.sortOrder ?? 0} hint="Lower shows first." />
      </div>
      <FileField label="Cover image" name="image" current={course?.imageUrl} removeName="removeImage" hint={`Used on ${noun} cards and in the page hero. 16:9 works best. Without one, generated artwork is used.`} />
      <FileField label="Hero background photo" name="heroImage" current={course?.heroImageUrl} removeName="removeHeroImage" hint="Optional. Fills the whole top of the page behind the title, with a purple gradient over it. Use a wide landscape photo, at least 1600px across, with the busy part away from the left." />
      {!internship && <FileField label="Curriculum document" name="curriculumFile" current={course?.curriculumUrl} accept=".pdf,.doc,.docx,application/pdf" removeName="removeCurriculum" hint="PDF recommended, up to 4 MB. Visitors get it after leaving their name, email and phone under “View curriculum”." />}
      <fieldset className="flex flex-col gap-4 rounded-[5px] border border-edge bg-panel p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Certificate requirements</legend>
        <Checkbox label="Issue a certificate on completion" name="certificateEnabled" defaultChecked={course?.certificateEnabled ?? true} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Minimum attendance %" name="certificateMinAttendance" type="number" min={0} max={100} defaultValue={course?.certificateMinAttendance ?? 70} />
          <Input label="Assignments completed %" name="certificateMinAssignments" type="number" min={0} max={100} defaultValue={course?.certificateMinAssignments ?? 80} />
          <Input label="Minimum average score %" name="certificateMinScore" type="number" min={0} max={100} defaultValue={course?.certificateMinScore ?? 50} />
        </div>
        <Input label="Minimum average quiz score %" name="certificateMinQuizScore" type="number" min={0} max={100} defaultValue={course?.certificateMinQuizScore ?? 0} hint="Average of each lesson quiz's best score (quizzes not attempted count as 0). Use 0 if quizzes shouldn't count." className="max-w-[320px]" />
      </fieldset>
      <fieldset className="flex flex-col gap-4 rounded-[5px] border border-edge bg-panel p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Search engines</legend>
        <Input label="Search title" name="seoTitle" defaultValue={course?.seoTitle} maxLength={70} placeholder={course?.title ?? "e.g. Data Analytics Course in Lagos"} hint={`Optional. The headline in Google results; the academy name is added after it. Aim for under 60 characters. Uses the ${noun} title when empty.`} />
        <Textarea label="Meta description" name="seoDescription" defaultValue={course?.seoDescription} rows={2} maxLength={200} placeholder={course?.summary} hint="Optional. The text under the headline in Google and when the link is shared. Aim for 120–160 characters. Uses the summary when empty. The cover image is used as the share image." />
      </fieldset>
      <div className="flex flex-col gap-3">
        <Checkbox label="Published" name="published" defaultChecked={course?.published ?? false} hint="Visible on the website and open for enrolment." />
        {!internship && <Checkbox label="Featured on the home page" name="featured" defaultChecked={course?.featured ?? false} />}
      </div>
      <SubmitButton>{course ? `Save ${noun}` : `Create ${noun}`}</SubmitButton>
    </ActionForm>
  );
}
