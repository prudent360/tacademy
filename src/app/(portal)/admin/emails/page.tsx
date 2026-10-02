import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";

/** Email templates now live in Settings. */
export default async function EmailsPage() {
  await requirePermission("emails.manage");
  redirect("/admin/settings?tab=templates");
}
