import { redirect } from "next/navigation";
import { can, requireUser } from "@/lib/auth";

/** Instructors, administrators, and team members who manage courses (they open cohorts from the course pages). */
export default async function TeachLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== "instructor" && user.role !== "admin" && !(await can(user, "courses.manage"))) redirect(user.role === "student" ? "/dashboard" : "/admin?denied=1");
  return children;
}
