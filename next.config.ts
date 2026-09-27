import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
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
    ];
  },
  experimental: {
    // Uploads are capped at 4 MB in lib/storage.ts; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
