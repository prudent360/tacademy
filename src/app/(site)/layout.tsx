import type { Metadata } from "next";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { CourseAdvisor } from "@/components/site/course-advisor";
import { aiAvailable } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { seoConfig } from "@/lib/seo";

// Content is edited from the admin, so render on each request to always show the latest.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await seoConfig();
  const image = seo.shareImageUrl;
  return {
    title: { default: seo.siteName, template: seo.titleTemplate },
    description: seo.description,
    openGraph: { title: seo.siteName, description: seo.description, type: "website", siteName: seo.siteName, locale: "en_GB", ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title: seo.siteName, description: seo.description, ...(image ? { images: [image] } : {}), ...(seo.twitterHandle ? { site: seo.twitterHandle } : {}) },
    ...(seo.googleVerification || seo.bingVerification ? { verification: { ...(seo.googleVerification ? { google: seo.googleVerification } : {}), ...(seo.bingVerification ? { other: { "msvalidate.01": seo.bingVerification } } : {}) } } : {}),
    ...(seo.allowIndexing ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, user, advisor] = await Promise.all([getSettings(), getCurrentUser(), aiAvailable("advisor")]);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <SiteHeader settings={settings} user={user} />
      <main id="main">{children}</main>
      <SiteFooter settings={settings} />
      {advisor && <CourseAdvisor />}
    </>
  );
}
