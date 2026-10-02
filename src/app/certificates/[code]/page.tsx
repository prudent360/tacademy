import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { CertificateActions } from "@/components/portal/certificate-actions";
import { CheckCircleIcon } from "@/components/icons";
import { LinkedInButtons } from "@/components/linkedin-buttons";
import { getCurrentUser } from "@/lib/auth";
import { certificateByCode } from "@/lib/certificates";
import { getSettings } from "@/lib/data";
import { formatDateOnly } from "@/lib/time";
import { absoluteUrl } from "@/lib/site";
import QRCode from "qrcode";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const row = await certificateByCode((await params).code);
  if (!row) return { title: "Certificate verification", robots: { index: false } };
  const settings = await getSettings();
  const title = `${row.student.name}: ${row.course.title}`;
  const description = `${row.student.name} completed ${row.course.title} at ${settings.siteName}. Verified certificate ${row.certificate.code}.`;
  return { title, description, robots: { index: true, follow: false }, openGraph: { title, description, type: "website", siteName: settings.siteName } };
}

export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const row = await certificateByCode(code);
  if (!row) notFound();
  const [settings, viewer] = await Promise.all([getSettings(), getCurrentUser()]);
  const url = absoluteUrl(`/certificates/${row.certificate.code}`);
  const qr = await QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: "#181340", light: "#ffffff" } });
  const issued = formatDateOnly(row.certificate.issuedAt.toISOString().slice(0, 10));
  const MODE = { virtual: "Live online", physical: "In person", hybrid: "Hybrid" } as const;
  const dates = row.cohort.startDate && row.cohort.endDate ? `${formatDateOnly(row.cohort.startDate)} – ${formatDateOnly(row.cohort.endDate)}` : "";
  const programme = [row.cohort.name, dates, MODE[row.cohort.deliveryMode], row.course.durationWeeks ? `${row.course.durationWeeks}-week programme` : ""].filter(Boolean).join(" · ");
  const details: [string, string][] = [
    ["Issued to", row.student.name],
    ["Course", row.course.title],
    ["Cohort", row.cohort.name],
    ["Date issued", issued],
    ["Certificate ID", row.certificate.code],
  ];

  return (
    <main className="certificate-page min-h-dvh bg-page px-3 py-6 sm:px-8 sm:py-8">
      <div className="certificate-toolbar mx-auto mb-5 flex max-w-[1140px] flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircleIcon className="size-5 text-emerald-600" /> Verified credential
        </p>
        <CertificateActions />
      </div>

      {viewer?.id === row.student.id && (
        <div className="certificate-toolbar mx-auto mb-5 flex max-w-[1140px] flex-wrap items-center justify-between gap-3 rounded-[5px] border border-[#0a66c2]/20 bg-white px-4 py-3 shadow-xs">
          <p className="text-sm text-body">
            <strong className="text-ink">Congratulations!</strong> Add it to your LinkedIn profile or share it with your network.
          </p>
          <LinkedInButtons course={row.course.title} organisation={settings.siteName} issuedAt={row.certificate.issuedAt} url={url} code={row.certificate.code} />
        </div>
      )}

      {/* Landscape A4 from small tablets up (and when printing); on phones it stacks and grows to fit. */}
      <article className="certificate-sheet relative mx-auto flex max-w-[1140px] flex-col overflow-hidden border border-edge bg-white text-left shadow-[0_24px_70px_-30px_rgba(24,19,64,.35)] sm:aspect-[1.414/1] sm:flex-row">
        {/* Main panel */}
        <div className="relative flex flex-1 flex-col px-7 py-8 sm:px-[6%] sm:py-[5.5%]">
          <div className="pointer-events-none absolute inset-3 border border-ink/10 sm:inset-5" aria-hidden="true" />

          <header className="relative flex items-center gap-3">
            <BrandMark className="size-8 sm:size-10" />
            <span className="font-display text-base font-bold tracking-tight text-ink sm:text-lg">{settings.siteName}</span>
          </header>

          <div className="relative flex flex-1 flex-col justify-center py-8 sm:py-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[.32em] text-accent sm:text-[13px]">Certificate of completion</p>
            <p className="mt-5 text-sm text-muted sm:mt-[3.5%] sm:text-base">This is to certify that</p>
            <h1 className="mt-1.5 font-display text-[34px] font-bold leading-[1.05] tracking-tight text-ink sm:text-[clamp(2.5rem,5.6vw,4.4rem)]">{row.student.name}</h1>
            <div className="mt-4 flex items-center gap-1.5 sm:mt-[2.5%]" aria-hidden="true">
              <span className="h-1 w-14 bg-accent" />
              <span className="h-1 w-5 bg-cyan" />
            </div>
            <p className="mt-4 text-sm text-muted sm:mt-[2.5%] sm:text-base">has successfully completed</p>
            <p className="mt-1 max-w-[30ch] font-display text-2xl font-bold leading-tight text-accent sm:text-[clamp(1.5rem,3vw,2.35rem)]">{row.course.title}</p>
            {programme && <p className="mt-2 text-sm text-body sm:mt-3 sm:text-[15px]">{programme}</p>}
          </div>

          <dl className="relative grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4 text-sm sm:grid-cols-3 sm:pt-5">
            <div><dt className="text-xs text-muted">Issued by</dt><dd className="mt-0.5 font-semibold text-ink">{settings.siteName}</dd></div>
            <div><dt className="text-xs text-muted">Date issued</dt><dd className="mt-0.5 font-semibold text-ink">{issued}</dd></div>
            <div className="col-span-2 sm:col-span-1"><dt className="text-xs text-muted">Certificate ID</dt><dd className="mt-0.5 font-mono font-semibold text-ink">{row.certificate.code}</dd></div>
          </dl>
        </div>

        {/* Brand panel: seal and verification */}
        <aside className="relative flex flex-row items-center justify-between gap-5 overflow-hidden bg-navy px-7 py-6 text-white sm:w-[29%] sm:flex-col sm:justify-between sm:px-[3.2%] sm:py-[5.5%]">
          <span className="absolute inset-y-0 left-0 hidden w-1.5 bg-gradient-to-b from-accent to-cyan sm:block" aria-hidden="true" />
          <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-accent to-cyan sm:hidden" aria-hidden="true" />
          <DiamondLattice />
          <div className="relative flex flex-col items-center">
            <Seal siteName={settings.siteName} />
            <p className="mt-3 hidden font-mono text-[10px] font-semibold uppercase tracking-[.25em] text-cyan sm:block">Verified credential</p>
          </div>
          <div className="relative flex flex-col items-center text-center">
            <div className="rounded-[4px] bg-white p-1.5">
              <Image src={qr} width={200} height={200} unoptimized alt="Scan to verify this certificate" className="size-20 sm:size-[clamp(5rem,9vw,7rem)]" />
            </div>
            <p className="mt-2.5 text-xs font-semibold text-white">Scan to verify</p>
            <p className="mt-0.5 hidden font-mono text-[10px] leading-snug text-white/60 sm:block">
              {new URL(url).host}
              <br />
              /certificates/{row.certificate.code}
            </p>
          </div>
        </aside>
      </article>

      {/* For someone who scanned the QR code to check it: the facts, plainly. */}
      <section aria-labelledby="verification-heading" className="certificate-toolbar mx-auto mt-6 max-w-[1140px] rounded-[5px] border border-emerald-200 bg-white p-5 sm:p-6 shadow-xs">
        <h2 id="verification-heading" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <CheckCircleIcon className="size-5 text-emerald-600" /> This certificate is valid
        </h2>
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

/** The brand's 45° diamond grid, very faint, behind the navy panel. */
function DiamondLattice() {
  return (
    <svg className="pointer-events-none absolute inset-0 size-full opacity-[0.07]" aria-hidden="true">
      <defs>
        <pattern id="cert-diamonds" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect x="3" y="3" width="10" height="10" fill="none" stroke="#ffffff" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#cert-diamonds)" />
    </svg>
  );
}

/** Round seal: the academy's name set around the rim (stretched to fit any name), the mark in the middle. */
function Seal({ siteName }: { siteName: string }) {
  const r = 41;
  return (
    <svg viewBox="0 0 120 120" className="relative size-24 shrink-0 sm:size-[clamp(7rem,12vw,9.5rem)]" role="img" aria-label={`${siteName} seal`}>
      <defs>
        <path id="cert-seal-ring" d={`M 60 60 m -${r} 0 a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r} ${r} 0 1 1 -${r * 2} 0`} />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="#31C4F0" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="53" fill="#4F3FD7" />
      <circle cx="60" cy="60" r="31" fill="#181340" stroke="#31C4F0" strokeWidth="1" />
      <text fontSize="8.4" fontWeight="700" fill="#ffffff" letterSpacing="1.5">
        <textPath href="#cert-seal-ring" startOffset="0" textLength={2 * Math.PI * r - 6} lengthAdjust="spacing">
          {`${siteName.toUpperCase()} · VERIFIED CREDENTIAL ·`}
        </textPath>
      </text>
      <g transform="translate(60 56) scale(0.62) translate(0 -21)">
        <g transform="rotate(45)">
          <rect x="0" y="2" width="10" height="16.5" fill="#ffffff" />
          <rect x="11.5" y="0" width="18.5" height="10" fill="#ffffff" />
          <rect x="0" y="20" width="18.5" height="10" fill="#ffffff" />
          <rect x="20" y="11.5" width="10" height="16.5" fill="#31C4F0" />
        </g>
      </g>
    </svg>
  );
}
