import "server-only";
import type { Metadata } from "next";
import type { Settings, SeoSettings } from "@/db/schema";
import { getSettings } from "./data";

export const DEFAULT_SEO: SeoSettings = {
  titleTemplate: "",
  homeTitle: "",
  homeDescription: "",
  defaultDescription: "",
  coursesDescription: "",
  internshipsDescription: "",
  shareImageUrl: null,
  twitterHandle: "",
  googleVerification: "",
  bingVerification: "",
  allowIndexing: true,
  socialProfiles: [],
};

export type ResolvedSeo = SeoSettings & { siteName: string; description: string };

/** Settings > SEO with fallbacks: the template defaults to "%s | Site name", the description to the tagline. */
export async function seoConfig(settings?: Settings): Promise<ResolvedSeo> {
  const s = settings ?? (await getSettings());
  const seo = { ...DEFAULT_SEO, ...(s.seo ?? {}) };
  return {
    ...seo,
    titleTemplate: seo.titleTemplate.includes("%s") ? seo.titleTemplate : `%s | ${s.siteName}`,
    siteName: s.siteName,
    description: seo.defaultDescription || s.tagline || s.heroSubtitle,
  };
}

/** Title, description and social cards for one public page. */
export function pageMetadata(seo: ResolvedSeo, page: { title?: string; absoluteTitle?: string; description?: string; path: string; image?: string | null }): Metadata {
  const description = page.description || seo.description;
  const title = page.absoluteTitle ? { absolute: page.absoluteTitle } : page.title;
  const socialTitle = page.absoluteTitle ?? (page.title ? seo.titleTemplate.replace("%s", page.title) : seo.siteName);
  const image = page.image || seo.shareImageUrl;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: page.path },
    openGraph: { title: socialTitle, description, url: page.path, siteName: seo.siteName, type: "website", locale: "en_GB", ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title: socialTitle, description, ...(image ? { images: [image] } : {}), ...(seo.twitterHandle ? { site: seo.twitterHandle } : {}) },
  };
}
