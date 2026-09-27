import "server-only";
import { isEmptyFile, saveUpload, UploadError, type UploadFolder } from "./storage";

/**
 * Resolves a file input on save: a new upload replaces the current URL,
 * a ticked "remove" box clears it, otherwise the current URL is kept.
 */
export async function resolveFileField(
  formData: FormData,
  opts: { file: string; remove: string; current: string | null; folder: UploadFolder; kind?: "image" | "document" },
): Promise<string | null> {
  const value = formData.get(opts.file);
  if (!isEmptyFile(value)) return saveUpload(value as File, opts.folder, opts.kind);
  if (formData.get(opts.remove) === "on") return null;
  return opts.current;
}

export function uploadErrorMessage(error: unknown): string | null {
  return error instanceof UploadError ? error.message : null;
}
