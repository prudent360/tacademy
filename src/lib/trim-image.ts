import "server-only";
import sharp from "sharp";
import { isEmptyFile } from "./storage";

/**
 * Crops the empty border off an uploaded logo (transparent or the corner colour), so the logo fills the
 * space it's shown in instead of shrinking to fit its padding. Leaves anything it can't process unchanged.
 */
export async function trimLogo(value: FormDataEntryValue | null): Promise<FormDataEntryValue | null> {
  if (isEmptyFile(value)) return value;
  const file = value as File;
  if (!["image/png", "image/webp", "image/jpeg"].includes(file.type)) return file;
  try {
    const trimmed = await sharp(Buffer.from(await file.arrayBuffer())).trim({ threshold: 12 }).png().toBuffer();
    return new File([new Uint8Array(trimmed)], file.name.replace(/\.\w+$/, "") + ".png", { type: "image/png" });
  } catch {
    // A blank image or an unreadable file: store it as uploaded and let the usual checks handle it.
    return file;
  }
}
