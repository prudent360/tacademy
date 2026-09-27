import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts API keys saved from the admin (AES-256-GCM, key derived from SESSION_SECRET),
 * so a database dump alone doesn't expose them. Changing SESSION_SECRET makes saved keys
 * unreadable; they then need re-entering.
 */
function key(): Buffer {
  return createHash("sha256").update(`academy-secrets:${process.env.SESSION_SECRET ?? ""}`).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

export function decryptSecret(stored: string | undefined): string {
  if (!stored) return "";
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !data) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/** "sk_live_…a1b2" for display; never send full secrets to the browser. */
export function maskSecret(stored: string | undefined): string {
  const plain = decryptSecret(stored);
  if (!plain) return "";
  return `${plain.slice(0, Math.min(8, Math.floor(plain.length / 3)))}••••${plain.slice(-4)}`;
}
