import "server-only";
import { getDb } from "@/db";
import { auditLogs, type User } from "@/db/schema";
import { clientAddress } from "./rate-limit";

type Entry = {
  action: string;
  /** Reads after the person's name, e.g. "confirmed the bank transfer TSU-…". */
  summary: string;
  target?: { type: string; id: string | number };
  details?: Record<string, unknown>;
};

/** Records who did what in the admin area. Never include passwords, codes or secrets in `details`. Never throws. */
export async function logAudit(actor: Pick<User, "id" | "name"> | null, entry: Entry): Promise<void> {
  try {
    await (await getDb()).insert(auditLogs).values({
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? "System",
      action: entry.action,
      summary: entry.summary,
      targetType: entry.target?.type ?? null,
      targetId: entry.target ? String(entry.target.id) : null,
      details: entry.details ?? null,
      ip: await clientAddress().catch(() => null),
    });
  } catch (error) {
    console.error("Audit log failed", error);
  }
}
