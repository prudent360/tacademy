import type { Metadata } from "next";
import { createCourse } from "@/app/actions/admin";
import { CourseForm } from "@/components/admin/course-form";
import { Card, PageHeader } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  const ai = await aiAvailable("writing");
  return (
    <>
      <PageHeader back={{ href: "/admin/courses", label: "Courses" }} title="New course" description="Create the course first, then add one or more cohorts." />
      <Card><CourseForm action={createCourse} ai={ai} /></Card>
    </>
  );
}
