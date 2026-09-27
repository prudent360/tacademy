import type { Metadata } from "next";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";

// Content is edited from the admin, so render on each request to always show the latest.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description = settings.tagline || settings.heroSubtitle;
  return {
    title: { default: settings.siteName, template: `%s | ${settings.siteName}` },
    description,
    openGraph: { title: settings.siteName, description, type: "website", siteName: settings.siteName, locale: "en_GB" },
    twitter: { card: "summary_large_image", title: settings.siteName, description },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <SiteHeader settings={settings} user={user} />
      <main id="main">{children}</main>
      <SiteFooter settings={settings} />
    </>
  );
}
