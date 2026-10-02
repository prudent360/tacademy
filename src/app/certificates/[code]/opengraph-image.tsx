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

  // Same layout as the certificate: white main panel, navy brand panel with the seal.
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", fontFamily: "Jakarta", background: "#ffffff" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "56px 64px", position: "relative" }}>
          <div style={{ position: "absolute", top: 18, left: 18, right: 18, bottom: 18, border: "1.5px solid rgba(24,19,64,.1)", display: "flex" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="40" height="40" viewBox="-22 -1 44 44"><g transform="rotate(45)"><rect x="0" y="2" width="10" height="16.5" fill="#4F3FD7" /><rect x="11.5" y="0" width="18.5" height="10" fill="#4F3FD7" /><rect x="0" y="20" width="18.5" height="10" fill="#4F3FD7" /><rect x="20" y="11.5" width="10" height="16.5" fill="#31C4F0" /></g></svg>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#181340" }}>{settings.siteName}</span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 17, letterSpacing: 6, textTransform: "uppercase", color: "#4F3FD7", fontWeight: 800 }}>Certificate of completion</div>
            <div style={{ marginTop: 18, fontSize: 70, fontWeight: 800, color: "#181340", lineHeight: 1.05, letterSpacing: -1.5 }}>{name}</div>
            <div style={{ marginTop: 18, display: "flex", gap: 6 }}>
              <div style={{ width: 64, height: 5, background: "#4F3FD7" }} />
              <div style={{ width: 22, height: 5, background: "#31C4F0" }} />
            </div>
            <div style={{ marginTop: 18, fontSize: 22, color: "#59576d" }}>has successfully completed</div>
            <div style={{ marginTop: 4, fontSize: 40, fontWeight: 800, color: "#4F3FD7", lineHeight: 1.15 }}>{course}</div>
          </div>
          <div style={{ display: "flex", gap: 40, fontSize: 18, color: "#59576d", borderTop: "1.5px solid #e8e6f0", paddingTop: 16 }}>
            {issued && <span>Issued {issued}</span>}
            {row && <span>ID {row.certificate.code}</span>}
          </div>
        </div>
        <div style={{ width: 330, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#181340", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 8, background: "linear-gradient(180deg, #4F3FD7, #31C4F0)", display: "flex" }} />
          <div style={{ width: 190, height: 190, borderRadius: 999, border: "3px solid #31C4F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 172, height: 172, borderRadius: 999, background: "#4F3FD7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 104, height: 104, borderRadius: 999, background: "#181340", border: "2px solid #31C4F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="58" height="58" viewBox="-22 -1 44 44"><g transform="rotate(45)"><rect x="0" y="2" width="10" height="16.5" fill="#ffffff" /><rect x="11.5" y="0" width="18.5" height="10" fill="#ffffff" /><rect x="0" y="20" width="18.5" height="10" fill="#ffffff" /><rect x="20" y="11.5" width="10" height="16.5" fill="#31C4F0" /></g></svg>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#31C4F0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
            Verified credential
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
