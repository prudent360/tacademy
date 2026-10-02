import type { NextConfig } from "next";

// The old WordPress site (Tutor LMS + WooCommerce) moves here when this app takes the root domain.
const LEGACY_SITE = "https://learn.tekskillup.com";

// Old WordPress paths that should keep working on the legacy site: blog posts, the old
// self-paced courses and their students' accounts, and certificate verification links.
const legacyPaths = [
  // Blog posts and categories
  "/learn-data-analytics-in-enugu-tekskillup-academy",
  "/data-analytics-webinar-tekskillup",
  "/learn-data-analysis-in-enugu",
  "/a-new-chapter-for-tekskillup-relocating-to-uyo",
  "/data-analytics",
  "/uncategorized",
  "/category/:path*",
  "/tag/:path*",
  "/author/:path*",
  "/feed",
  // Tutor LMS courses, bundles and certificates
  "/courses/adobe-photoshop-essentials-a-beginner-to-advanced-course",
  "/courses/smartphone-graphic-design-blueprint",
  "/courses/ecommerce-website-development",
  "/courses/ultimate-dropshipping-blueprint",
  "/courses/data-analytics-internship-tekskillup",
  "/courses/power-bi-dashboard-design-course-project-focused",
  "/courses/introduction-to-python-programming",
  "/courses/data-analysis-using-sql",
  "/courses/data-analysis-in-ms-excel",
  "/course-bundle/:path*",
  "/course-category/:path*",
  "/tutor-certificate",
  "/tutor-certificate-verification",
  "/instructor-registration",
  "/congratulations",
  // WooCommerce
  "/shop",
  "/cart",
  "/cart-2",
  "/checkout",
  "/my-account/:path*",
  // Landing and sales pages linked from ads and social posts
  "/ui-ux-course-sales-page",
  "/data-analysis-using-sql-daus",
  "/dausql_sales_page",
  "/data-analytics-sql-excel-power-bi",
  "/data-analysis-training-enugu-virtual",
  "/digital-skills-acquisition-simplified",
  "/tekskillup-program-brochure",
  "/application-interns",
  "/workspace-in-enugu",
  "/ecommerce",
  "/baby-product",
  "/oig",
  // WordPress internals, so old image links and logins still resolve
  "/wp-content/:path*",
  "/wp-includes/:path*",
  "/wp-admin/:path*",
  "/wp-json/:path*",
  "/wp-login.php",
  "/sitemap_index.xml",
  "/post-sitemap.xml",
  "/page-sitemap.xml",
  "/courses-sitemap.xml",
  "/course-bundle-sitemap.xml",
  "/category-sitemap.xml",
  "/course-category-sitemap.xml",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // The certificate share image reads its fonts from disk; make sure they ship with that route.
  outputFileTracingIncludes: {
    "/certificates/*/opengraph-image": ["./src/assets/fonts/PlusJakartaSans-*.woff"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  // Common sign-in addresses people try from habit.
  async redirects() {
    return [
      { source: "/admin/login", destination: "/login", permanent: false },
      { source: "/signin", destination: "/login", permanent: false },
      { source: "/sign-in", destination: "/login", permanent: false },
      { source: "/signup", destination: "/register", permanent: false },
      { source: "/sign-up", destination: "/register", permanent: false },
      // Old WordPress pages that have an equivalent here.
      { source: "/about-us", destination: "/", permanent: true },
      { source: "/contact-us", destination: "/contact", permanent: true },
      { source: "/all-courses", destination: "/courses", permanent: true },
      { source: "/training", destination: "/courses", permanent: true },
      { source: "/student-registration", destination: "/register", permanent: true },
      ...legacyPaths.map((source) => ({
        source,
        destination: `${LEGACY_SITE}${source}`,
        permanent: true,
      })),
    ];
  },
  experimental: {
    // Uploads are capped at 4 MB in lib/storage.ts; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
