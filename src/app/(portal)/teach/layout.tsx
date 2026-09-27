import { requireRole } from "@/lib/auth";

export default async function TeachLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin", "instructor");
  return children;
}
