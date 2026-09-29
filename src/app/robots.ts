import type { MetadataRoute } from "next";
import { seoConfig } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

// Follows Settings > SEO, so indexing can be switched off without a deploy.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!(await seoConfig()).allowIndexing) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/teach", "/admin", "/account", "/notifications", "/checkout", "/api/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
