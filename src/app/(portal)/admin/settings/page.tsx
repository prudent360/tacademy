import type { Metadata } from "next";
import { AiTab, BrandingTab, SeoTab, VideoTab, EmailTab, GeneralTab, PaymentsTab, ReferralsTab, RemindersTab, TemplatesTab } from "@/components/admin/settings-tabs";
import { CardIcon, ClockIcon, CogIcon, FileIcon, MailIcon, PaletteIcon, SearchIcon, SparkIcon, UsersIcon, VideoIcon } from "@/components/icons";
import { PageHeader, Tabs } from "@/components/ui";
import { redirect } from "next/navigation";
import { can, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { key: "general", label: "General", icon: CogIcon },
  { key: "branding", label: "Branding", icon: PaletteIcon },
  { key: "payments", label: "Payments", icon: CardIcon },
  { key: "email", label: "Email", icon: MailIcon },
  { key: "templates", label: "Email templates", icon: FileIcon },
  { key: "reminders", label: "Reminders", icon: ClockIcon },
  { key: "referrals", label: "Referrals", icon: UsersIcon },
  { key: "seo", label: "SEO", icon: SearchIcon },
  { key: "video", label: "Video", icon: VideoIcon },
  { key: "ai", label: "AI", icon: SparkIcon },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const [settingsAccess, emailAccess] = await Promise.all([can(user, "settings.manage"), can(user, "emails.manage")]);
  // Email templates have their own permission; every other tab needs platform settings.
  const visible = TABS.filter((t) => (t.key === "templates" ? emailAccess : settingsAccess));
  if (!visible.length) redirect("/admin?denied=1");
  const { tab: raw } = await searchParams;
  const tab: Tab = visible.find((t) => t.key === raw)?.key ?? visible[0].key;
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Settings" description="Configure your academy: details, branding, payments, email and reminders." />
      <Tabs current={tab} items={visible.map((t) => ({ key: t.key, label: t.label, icon: t.icon, href: t.key === "general" ? "/admin/settings" : `/admin/settings?tab=${t.key}` }))} />
      {tab === "general" && <GeneralTab s={s} />}
      {tab === "branding" && <BrandingTab s={s} />}
      {tab === "payments" && <PaymentsTab s={s} />}
      {tab === "email" && <EmailTab s={s} />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "reminders" && <RemindersTab />}
      {tab === "referrals" && <ReferralsTab />}
      {tab === "seo" && <SeoTab s={s} />}
      {tab === "video" && <VideoTab s={s} />}
      {tab === "ai" && <AiTab s={s} />}
    </>
  );
}
