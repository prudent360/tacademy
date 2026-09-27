import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { AwardIcon, ExternalIcon } from "@/components/icons";
import { DataTable, EmptyState, PageHeader, PersonCell, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { certificates, cohorts, courses, enrollments, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDateOnly } from "@/lib/time";

export const metadata: Metadata = { title: "Certificates" };

export default async function AdminCertificatesPage() {
  await requireRole("admin");
  const rows = await (await getDb())
    .select({ certificate: certificates, student: users, course: courses, cohort: cohorts })
    .from(certificates)
    .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
    .innerJoin(users, eq(users.id, enrollments.userId))
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .orderBy(desc(certificates.issuedAt));

  return (
    <>
      <PageHeader title="Certificates" description="Issued course credentials and their public verification status." />
      {rows.length ? (
        <DataTable>
          <thead><tr><th>Student</th><th>Course</th><th>Certificate ID</th><th>Issued</th><th>Status</th><th className="text-right">View</th></tr></thead>
          <tbody>
            {rows.map(({ certificate, student, course, cohort }) => (
              <tr key={certificate.id}>
                <td><PersonCell name={student.name} email={student.email} src={student.avatarUrl} href={`/admin/users/${student.id}`} /></td>
                <td><span className="font-semibold text-ink">{course.title}</span><span className="block text-xs text-muted">{cohort.name}</span></td>
                <td className="font-mono text-xs text-muted">{certificate.code}</td>
                <td className="whitespace-nowrap text-muted">{formatDateOnly(certificate.issuedAt.toISOString().slice(0, 10))}</td>
                <td><StatusBadge status={certificate.revokedAt ? "cancelled" : "completed"} label={certificate.revokedAt ? "Revoked" : "Verified"} /></td>
                <td className="text-right"><Link href={`/certificates/${certificate.code}`} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-[5px] border border-edge-strong bg-white px-3 text-sm font-semibold text-ink hover:border-accent-muted hover:text-accent">Open <ExternalIcon className="size-3.5" /></Link></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : <EmptyState icon={AwardIcon} title="No certificates issued">Certificates appear here after students are marked as completed.</EmptyState>}
    </>
  );
}
