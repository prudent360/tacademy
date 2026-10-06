import type { MetadataRoute } from "next";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { freeClasses, jobOpenings } from "@/db/schema";
import { isAccepting } from "@/lib/careers";
import { publishedProjects } from "@/lib/showcase-data";
import { getPublishedCourses } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, jobs, classes, projects] = await Promise.all([getPublishedCourses(), (await getDb()).select().from(jobOpenings).where(eq(jobOpenings.status, "open")), (await getDb()).select().from(freeClasses).where(and(eq(freeClasses.status, "open"), gt(freeClasses.endsAt, new Date()))), publishedProjects()]);
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/courses"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/internships"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/internships/apply"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/teach-with-us"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/teach-with-us/apply"), changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/careers"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/free-classes"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/projects"), changeFrequency: "weekly", priority: 0.7 },
    ...projects.map(({ project: p }) => ({ url: absoluteUrl(`/projects/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...classes.map((c) => ({ url: absoluteUrl(`/free-classes/${c.slug}`), lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    { url: absoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.5 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/refund-policy"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/cookies"), changeFrequency: "yearly", priority: 0.3 },
    ...jobs.filter((j) => isAccepting(j)).map((j) => ({ url: absoluteUrl(`/careers/${j.slug}`), lastModified: j.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...courses.map((c) => ({ url: absoluteUrl(`/courses/${c.slug}`), lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
