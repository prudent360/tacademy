import { Brand } from "@/components/site/brand";
import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <Brand settings={settings} />
      <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-[14px] border border-edge bg-white p-7 md:p-8">{children}</div>
    </div>
  );
}
