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
  const qr = await QRCode.toDataURL(absoluteUrl(`/certificates/${row.certificate.code}`), { width: 180, margin: 1, color: { dark: "#181340", light: "#ffffff" } });
  const issued = formatDateOnly(row.certificate.issuedAt.toISOString().slice(0, 10));
  const details: [string, string][] = [
    ["Issued to", row.student.name],
    ["Course", row.course.title],
    ["Cohort", row.cohort.name],
    ["Date issued", issued],
    ["Certificate ID", row.certificate.code],
  ];
  return (
    <main className="certificate-page min-h-dvh bg-page px-4 py-6 sm:px-8 sm:py-8">
      <div className="certificate-toolbar mx-auto mb-5 flex max-w-[1120px] flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircleIcon className="size-5" /> Verified credential</p>
        <CertificateActions />
      </div>

      {/* The landscape A4 layout from small tablets up (and when printing); on phones it grows to fit its content instead of being cropped. */}
      <article className="certificate-sheet relative mx-auto flex max-w-[1120px] flex-col items-center justify-center overflow-hidden border border-edge bg-white px-6 py-10 text-center shadow-[0_24px_70px_-35px_rgba(24,19,64,.35)] sm:aspect-[1.414/1] sm:px-10 sm:py-12">
        <div className="absolute inset-2 border border-accent/30 sm:inset-4" />
        <div className="absolute inset-3.5 border border-cyan/25 sm:inset-7" />
        <BrandMark className="relative size-10 sm:size-14" />
        <p className="relative mt-3 font-mono text-[10px] font-semibold uppercase tracking-[3px] text-accent sm:mt-4 sm:text-xs">{settings.siteName}</p>
        <h1 className="relative mt-4 font-display text-[26px] font-bold leading-tight tracking-tight text-ink sm:mt-6 sm:text-6xl">Certificate of Completion</h1>
        <p className="relative mt-5 text-sm text-muted sm:mt-7 sm:text-base">This certifies that</p>
        <p className="relative mt-2 border-b border-accent/35 px-4 pb-2 font-display text-[28px] font-bold leading-tight text-ink sm:px-8 sm:text-5xl">{row.student.name}</p>
        <p className="relative mt-5 max-w-2xl text-sm leading-6 text-muted sm:mt-6 sm:text-base sm:leading-7">has successfully completed the requirements for</p>
        <p className="relative mt-2 font-display text-xl font-bold leading-snug text-accent sm:text-3xl">{row.course.title}</p>
        <p className="relative mt-1.5 text-sm text-muted sm:mt-2">{row.cohort.name}</p>
        <div className="relative mt-7 grid w-full max-w-3xl items-center gap-4 border-t border-line pt-5 text-sm sm:mt-8 sm:grid-cols-[1fr_auto_1fr] sm:gap-8">
          <div className="order-2 sm:order-none"><p className="font-semibold text-ink">{issued}</p><p className="text-muted">Date issued</p></div>
          <div className="order-1 flex justify-center sm:order-none"><Image src={qr} width={80} height={80} unoptimized alt="Scan to verify this certificate" /></div>
          <div className="order-3 sm:order-none"><p className="font-mono font-semibold text-ink">{row.certificate.code}</p><p className="text-muted">Certificate ID</p></div>
        </div>
      </article>

      {/* For someone who scanned the QR code to check it: the facts, plainly. */}
      <section aria-labelledby="verification-heading" className="certificate-toolbar mx-auto mt-6 max-w-[1120px] rounded-[14px] border border-emerald-200 bg-white p-5 sm:p-6">
        <h2 id="verification-heading" className="flex items-center gap-2 font-display text-lg font-bold text-ink"><CheckCircleIcon className="size-5 text-emerald-600" /> This certificate is valid</h2>
        <p className="mt-1 text-sm text-muted">Issued by {settings.siteName} and recorded in our system. It hasn&apos;t been revoked.</p>
        <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {details.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5 border-t border-line pt-3">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
              <dd className={`text-[15px] font-semibold text-ink ${label === "Certificate ID" ? "break-all font-mono" : ""}`}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
