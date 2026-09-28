import type { Metadata } from "next";
import { AiTab, BrandingTab, EmailTab, GeneralTab, PaymentsTab, RemindersTab, TemplatesTab } from "@/components/admin/settings-tabs";
import { CardIcon, ClockIcon, CogIcon, FileIcon, MailIcon, PaletteIcon, SparkIcon } from "@/components/icons";
import { PageHeader, Tabs } from "@/components/ui";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { key: "general", label: "General", icon: CogIcon },
  { key: "branding", label: "Branding", icon: PaletteIcon },
  { key: "payments", label: "Payments", icon: CardIcon },
  { key: "email", label: "Email", icon: MailIcon },
  { key: "templates", label: "Email templates", icon: FileIcon },
  { key: "reminders", label: "Reminders", icon: ClockIcon },
  { key: "ai", label: "AI", icon: SparkIcon },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.find((t) => t.key === raw)?.key ?? "general";
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Settings" description="Configure your academy: details, branding, payments, email and reminders." />
      <Tabs current={tab} items={TABS.map((t) => ({ key: t.key, label: t.label, icon: t.icon, href: t.key === "general" ? "/admin/settings" : `/admin/settings?tab=${t.key}` }))} />
      {tab === "general" && <GeneralTab s={s} />}
      {tab === "branding" && <BrandingTab s={s} />}
      {tab === "payments" && <PaymentsTab s={s} />}
      {tab === "email" && <EmailTab s={s} />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "reminders" && <RemindersTab />}
      {tab === "ai" && <AiTab s={s} />}
    </>
  );
}
