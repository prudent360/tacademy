import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/teach", "/admin", "/account", "/notifications", "/checkout", "/api/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
