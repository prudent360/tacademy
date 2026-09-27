import { redirect } from "next/navigation";

/** Email templates now live in Settings. */
export default function EmailsPage() {
  redirect("/admin/settings?tab=templates");
}
