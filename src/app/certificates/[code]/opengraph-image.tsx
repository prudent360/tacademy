import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { certificateByCode } from "@/lib/certificates";
import { getSettings } from "@/lib/data";
import { formatDateOnly } from "@/lib/time";

export const alt = "Certificate of Completion";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The picture LinkedIn (and other sites) show when a certificate link is shared. */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const fonts = join(process.cwd(), "src/assets/fonts");
  const [row, settings, regular, extraBold] = await Promise.all([certificateByCode(code), getSettings(), readFile(join(fonts, "PlusJakartaSans-Regular.woff")), readFile(join(fonts, "PlusJakartaSans-ExtraBold.woff"))]);
  const name = row?.student.name ?? "Certificate";
  const course = row?.course.title ?? settings.siteName;
  const issued = row ? formatDateOnly(row.certificate.issuedAt.toISOString().slice(0, 10)) : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", fontFamily: "Jakarta", background: "linear-gradient(135deg, #181340 0%, #2a2580 55%, #4f3fd7 100%)", padding: 36 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#ffffff", borderRadius: 6, border: "2px solid rgba(79,63,215,.25)", padding: "40px 64px", textAlign: "center" }}>
          <svg width="64" height="64" viewBox="-22 -1 44 44">
            <g transform="rotate(45)">
              <rect x="0" y="2" width="10" height="16.5" fill="#4F3FD7" />
              <rect x="11.5" y="0" width="18.5" height="10" fill="#4F3FD7" />
              <rect x="0" y="20" width="18.5" height="10" fill="#4F3FD7" />
              <rect x="20" y="11.5" width="10" height="16.5" fill="#31C4F0" />
            </g>
          </svg>
          <div style={{ marginTop: 14, fontSize: 20, letterSpacing: 6, textTransform: "uppercase", color: "#4F3FD7", fontWeight: 800 }}>{settings.siteName}</div>
          <div style={{ marginTop: 18, fontSize: 30, color: "#59576d" }}>Certificate of Completion</div>
          <div style={{ marginTop: 18, fontSize: 64, fontWeight: 800, color: "#181340", lineHeight: 1.1 }}>{name}</div>
          <div style={{ marginTop: 18, fontSize: 26, color: "#59576d" }}>has successfully completed</div>
          <div style={{ marginTop: 8, fontSize: 40, fontWeight: 800, color: "#4F3FD7", lineHeight: 1.2 }}>{course}</div>
          <div style={{ marginTop: 30, display: "flex", gap: 28, fontSize: 20, color: "#59576d" }}>
            {issued && <span>Issued {issued}</span>}
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#047857", fontWeight: 800 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
              Verified credential
            </span>
            {row && <span>ID {row.certificate.code}</span>}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Jakarta", data: regular, weight: 400, style: "normal" },
        { name: "Jakarta", data: extraBold, weight: 800, style: "normal" },
      ],
    },
  );
}
