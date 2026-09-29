import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Local-only upload folder, served by app/uploads/[...path]/route.ts. */
export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

/** Vercel caps request bodies at 4.5 MB, so larger work should be shared as a link. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};
export const DOCUMENT_TYPES: Record<string, string> = {
  ...IMAGE_TYPES,
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "text/plain": "txt",
  "text/csv": "csv",
};
/** Extensions browsers often report without a useful MIME type. */
const EXTENSION_FALLBACK: Record<string, string> = { ipynb: "ipynb", sql: "sql", py: "py", csv: "csv", txt: "txt", zip: "zip", pbix: "pbix" };

export class UploadError extends Error {}

export type UploadFolder = "images" | "courses" | "branding" | "avatars" | "assignments" | "submissions" | "applications";

/**
 * True when a Vercel Blob store is connected. Older stores provide BLOB_READ_WRITE_TOKEN;
 * newer ones provide BLOB_STORE_ID and authenticate with the deployment's OIDC token.
 */
export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

/** True when a form's file input was left empty. */
export function isEmptyFile(value: FormDataEntryValue | null): boolean {
  return !value || typeof value === "string" || value.size === 0;
}

function extensionFor(file: File, kind: "image" | "document"): string | undefined {
  if (kind === "image") return IMAGE_TYPES[file.type];
  const byType = DOCUMENT_TYPES[file.type];
  if (byType) return byType;
  const ext = path.extname(file.name).slice(1).toLowerCase();
  return EXTENSION_FALLBACK[ext];
}

/**
 * Stores an uploaded file and returns its public URL.
 * Uses Vercel Blob when a store is connected, otherwise .data/uploads/ (local only).
 */
export async function saveUpload(file: File, folder: UploadFolder, kind: "image" | "document" = "image"): Promise<string> {
  const ext = extensionFor(file, kind);
  if (!ext) {
    throw new UploadError(kind === "image" ? "Upload a JPG, PNG, WebP, GIF or AVIF image." : "Upload a PDF, Office document, image, ZIP, CSV, text or notebook file.");
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Files must be 4 MB or smaller. Share larger work as a link instead.");

  const name = `${folder}/${randomUUID()}.${ext}`;

  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    try {
      const blob = await put(name, file, { access: "public", contentType: file.type || "application/octet-stream" });
      return blob.url;
    } catch (error) {
      console.error("Blob upload failed", error);
      const detail = error instanceof Error ? error.message : String(error);
      throw new UploadError(`The upload was rejected by Vercel Blob: ${detail}`);
    }
  }

  if (process.env.VERCEL) {
    throw new UploadError("Uploads need a Vercel Blob store. Connect one in the Vercel dashboard.");
  }
  const target = path.join(LOCAL_UPLOAD_DIR, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}

/**
 * Deletes a file previously returned by saveUpload. Best effort: failures are logged, not thrown,
 * so a storage hiccup never blocks saving content.
 */
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    if (url.startsWith("/uploads/")) {
      const target = path.resolve(LOCAL_UPLOAD_DIR, url.slice("/uploads/".length));
      if (target.startsWith(LOCAL_UPLOAD_DIR + path.sep)) await unlink(target);
    } else if (blobConfigured() && new URL(url).hostname.endsWith(".blob.vercel-storage.com")) {
      const { del } = await import("@vercel/blob");
      await del(url);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("Could not delete upload", url, error);
  }
}

/** Removes the previous file once a field has been saved with a different value. */
export async function deleteIfReplaced(previous: string | null | undefined, next: string | null | undefined): Promise<void> {
  if (previous && previous !== next) await deleteUpload(previous);
}
