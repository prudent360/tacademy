import type { Metadata } from "next";
import Image from "next/image";
import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { CertificateActions } from "@/components/portal/certificate-actions";
import { CheckCircleIcon } from "@/components/icons";
import { getDb } from "@/db";
import { certificates, cohorts, courses, enrollments, users } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { formatDateOnly } from "@/lib/time";
import { absoluteUrl } from "@/lib/site";
import QRCode from "qrcode";

export const metadata: Metadata = { title: "Certificate verification", robots: { index: true, follow: false } };

export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [row] = await (await getDb())
    .select({ certificate: certificates, student: users, course: courses, cohort: cohorts })
    .from(certificates)
    .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
    .innerJoin(users, eq(users.id, enrollments.userId))
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(certificates.code, code), isNull(certificates.revokedAt)));
  if (!row) notFound();
  const settings = await getSettings();
  const qr = await QRCode.toDataURL(absoluteUrl(`/certificates/${row.certificate.code}`), { width: 180, margin: 1, color: { dark: "#19112e", light: "#ffffff" } });
  return (
    <main className="certificate-page min-h-dvh bg-page px-4 py-8 sm:px-8">
      <div className="certificate-toolbar mx-auto mb-5 flex max-w-[1120px] items-center justify-between gap-4"><p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircleIcon className="size-5" /> Verified credential</p><CertificateActions /></div>
      <article className="certificate-sheet relative mx-auto flex aspect-[1.414/1] max-w-[1120px] flex-col items-center justify-center overflow-hidden border border-edge bg-white px-10 py-12 text-center shadow-[0_24px_70px_-35px_rgba(25,17,46,.35)]">
        <div className="absolute inset-4 border border-accent/30" />
        <div className="absolute inset-7 border border-cyan/25" />
        <BrandMark className="relative size-14" />
        <p className="relative mt-4 font-mono text-xs font-semibold uppercase tracking-[3px] text-accent">{settings.siteName}</p>
        <h1 className="relative mt-6 font-display text-4xl font-bold tracking-tight text-ink sm:text-6xl">Certificate of Completion</h1>
        <p className="relative mt-7 text-base text-muted">This certifies that</p>
        <p className="relative mt-2 border-b border-accent/35 px-8 pb-2 font-display text-3xl font-bold text-ink sm:text-5xl">{row.student.name}</p>
        <p className="relative mt-6 max-w-2xl text-base leading-7 text-muted">has successfully completed the requirements for</p>
        <p className="relative mt-2 font-display text-2xl font-bold text-accent sm:text-3xl">{row.course.title}</p>
        <p className="relative mt-2 text-sm text-muted">{row.cohort.name}</p>
        <div className="relative mt-8 grid w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-8 border-t border-line pt-5 text-sm"><div><p className="font-semibold text-ink">{formatDateOnly(row.certificate.issuedAt.toISOString().slice(0, 10))}</p><p className="text-muted">Date issued</p></div><div><Image src={qr} width={80} height={80} unoptimized alt="Scan to verify this certificate" /></div><div><p className="font-mono font-semibold text-ink">{row.certificate.code}</p><p className="text-muted">Certificate ID · scan to verify</p></div></div>
      </article>
    </main>
  );
}
