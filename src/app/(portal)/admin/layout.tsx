import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/data";

/** The admin area is for administrators and team members whose role allows it; each page checks its own permission too. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission("admin.access");
  // When the academy requires it, the team sets up two-factor sign-in before using the admin area.
  if (!user.totpEnabledAt && (await getSettings()).requireStaffTwoFactor) redirect("/account?twofactor=required#two-factor");
  return children;
}
