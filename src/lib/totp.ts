import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// RFC 6238 time-based codes, compatible with Google Authenticator, Microsoft Authenticator, 1Password, etc.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = ALPHABET.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / STEP_SECONDS)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const n = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return n.toString().padStart(6, "0");
}

/** Accepts the current code and the ones either side, to allow for clock drift. */
export function verifyTotp(secret: string, code: string): boolean {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean) || !secret) return false;
  return [-1, 0, 1].some((drift) => timingSafeEqual(Buffer.from(totpCode(secret, Date.now() + drift * STEP_SECONDS * 1000)), Buffer.from(clean)));
}

/** The link an authenticator app reads from the QR code; `issuer` is the academy's name. */
export function otpauthUrl(issuer: string, account: string, secret: string): string {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

/** Groups a secret in fours for typing by hand. */
export const formatSecret = (secret: string) => secret.match(/.{1,4}/g)?.join(" ") ?? secret;
