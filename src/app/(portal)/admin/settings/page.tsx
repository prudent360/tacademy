import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsMobileNav, SettingsSectionNav } from "@/components/admin/settings-section-nav";
import { AiTab, AnnouncementTab, BrandingTab, SeoTab, VideoTab, EmailTab, GeneralTab, PaymentsTab, ReferralsTab, RemindersTab, TemplatesTab, WhatsAppTab } from "@/components/admin/settings-tabs";
import { CardIcon, CogIcon, FileIcon, MailIcon, SparkIcon } from "@/components/icons";
import { PageHeader, Tabs } from "@/components/ui";
import type { Settings } from "@/db/schema";
import { can, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Settings" };

type Part = { id: string; label: string; render: (s: Settings) => React.ReactNode };

/** Five tabs; related settings share a page, with quick links to each part. */
const GROUPS = [
  { key: "general", label: "General", icon: CogIcon, description: "Your academy's details, look and how it appears in search and when shared.", parts: [
    { id: "details", label: "Academy details", render: (s) => <GeneralTab s={s} /> },
    { id: "branding", label: "Branding", render: (s) => <BrandingTab s={s} /> },
    { id: "seo", label: "Search & sharing", render: (s) => <SeoTab s={s} /> },
  ] },
  { key: "payments", label: "Payments", icon: CardIcon, description: "How students pay, in which currencies, and what people earn for referring others.", parts: [
    { id: "methods", label: "Payment methods", render: (s) => <PaymentsTab s={s} /> },
    { id: "referrals", label: "Referrals", render: () => <ReferralsTab /> },
  ] },
  { key: "messages", label: "Messages", icon: MailIcon, description: "How the academy reaches people: email, reminders, WhatsApp and the dashboard pop-up.", parts: [
    { id: "email", label: "Email delivery", render: (s) => <EmailTab s={s} /> },
    { id: "reminders", label: "Reminders", render: () => <RemindersTab /> },
    { id: "whatsapp", label: "WhatsApp", render: (s) => <WhatsAppTab s={s} /> },
    { id: "popup", label: "Dashboard pop-up", render: (s) => <AnnouncementTab s={s} /> },
  ] },
  { key: "templates", label: "Email templates", icon: FileIcon, description: "The wording of every email the academy sends.", parts: [
    { id: "templates", label: "Email templates", render: () => <TemplatesTab /> },
  ] },
  { key: "integrations", label: "Integrations", icon: SparkIcon, description: "Video hosting and the AI features.", parts: [
    { id: "video", label: "Video", render: (s) => <VideoTab s={s} /> },
    { id: "ai", label: "AI", render: (s) => <AiTab s={s} /> },
  ] },
] satisfies { key: string; label: string; icon: unknown; description: string; parts: Part[] }[];

type GroupKey = (typeof GROUPS)[number]["key"];

/** Old tab names, so bookmarks and links still land in the right place. */
const LEGACY: Record<string, [GroupKey, string]> = {
  branding: ["general", "branding"],
  seo: ["general", "seo"],
  referrals: ["payments", "referrals"],
  email: ["messages", "email"],
  reminders: ["messages", "reminders"],
  whatsapp: ["messages", "whatsapp"],
  announcement: ["messages", "popup"],
  video: ["integrations", "video"],
  ai: ["integrations", "ai"],
};

const href = (key: string, part?: string) => `${key === "general" ? "/admin/settings" : `/admin/settings?tab=${key}`}${part ? `#${part}` : ""}`;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const [settingsAccess, emailAccess] = await Promise.all([can(user, "settings.manage"), can(user, "emails.manage")]);
  // Email templates have their own permission; everything else needs platform settings.
  const visible = GROUPS.filter((g) => (g.key === "templates" ? emailAccess : settingsAccess));
  if (!visible.length) redirect("/admin?denied=1");
  const { tab: raw } = await searchParams;
  if (raw && LEGACY[raw]) redirect(href(...LEGACY[raw]));
  const group = visible.find((g) => g.key === raw) ?? visible[0];
  const s = await getSettings();
  const parts: Part[] = group.parts;

  return (
    <>
      <PageHeader title="Settings" description={group.description} />
      <SettingsMobileNav current={group.key} groups={visible.map((g) => ({ key: g.key, label: g.label, href: href(g.key), parts: (g.parts as Part[]).map(({ id, label }) => ({ id, label })) }))} />
      <div className="hidden md:block"><Tabs current={group.key} items={visible.map((g) => ({ key: g.key, label: g.label, icon: g.icon, href: href(g.key) }))} /></div>
      {parts.length > 1 && <SettingsSectionNav label={`${group.label} sections`} parts={parts.map(({ id, label }) => ({ id, label }))} />}
      {parts.map((p, i) => (
        <section key={p.id} id={p.id} aria-labelledby={parts.length > 1 ? `${p.id}-heading` : undefined} className="flex scroll-mt-36 flex-col gap-5">
          {parts.length > 1 && (
            <div className={`flex items-center gap-3 ${i > 0 ? "pt-6" : ""}`}>
              <h2 id={`${p.id}-heading`} className="font-mono text-xs font-semibold uppercase tracking-[1.5px] text-accent">{p.label}</h2>
              <span aria-hidden="true" className="h-px grow bg-line" />
            </div>
          )}
          {p.render(s)}
        </section>
      ))}
    </>
  );
}
