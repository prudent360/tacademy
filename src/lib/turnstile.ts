import "server-only";
import { clientAddress } from "@/lib/rate-limit";

/** Off until both keys are set, so local development and preview deploys work without Cloudflare. */
export function turnstileSiteKey(): string | null {
  return (process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY) || null;
}

/** Checks the token the Turnstile widget added to the form. Each token can be checked only once. */
export async function turnstilePassed(formData: FormData, action: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.TURNSTILE_SITE_KEY) return true;
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: await clientAddress() }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = (await res.json()) as { success?: boolean; action?: string; "error-codes"?: string[] };
    if (!result.success) {
      console.warn(`Turnstile rejected a ${action}: ${result["error-codes"]?.join(", ") || "no reason given"}`);
      return false;
    }
    return result.action === action;
  } catch (error) {
    console.error("Turnstile check failed", error);
    return false;
  }
}
