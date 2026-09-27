import { readFile } from "node:fs/promises";
import path from "node:path";
import { LOCAL_UPLOAD_DIR } from "@/lib/storage";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif", pdf: "application/pdf",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip", txt: "text/plain; charset=utf-8", csv: "text/csv; charset=utf-8",
  ipynb: "application/octet-stream", sql: "text/plain; charset=utf-8", py: "text/plain; charset=utf-8", pbix: "application/octet-stream",
};
const INLINE = new Set(["jpg", "png", "webp", "gif", "avif", "pdf"]);

/** Serves files saved by the local upload fallback. Production uploads live on Vercel Blob. */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path;
  const file = path.resolve(LOCAL_UPLOAD_DIR, ...segments);
  const ext = path.extname(file).slice(1).toLowerCase();
  const type = TYPES[ext];
  if (!type || !file.startsWith(LOCAL_UPLOAD_DIR + path.sep)) return new Response("Not found", { status: 404 });

  try {
    const body = await readFile(file);
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": INLINE.has(ext) ? "inline" : "attachment",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
