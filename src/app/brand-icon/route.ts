import { getSettings } from "@/lib/data";

/**
 * The browser-tab and home-screen icon. Points to the favicon uploaded in Settings > Branding, or the
 * built-in mark. A route rather than an app/icon file so a new upload shows up without a redeploy.
 */
export async function GET(request: Request) {
  const apple = new URL(request.url).searchParams.has("apple");
  const { faviconUrl } = await getSettings().catch(() => ({ faviconUrl: null }));
  const target = new URL(faviconUrl ?? (apple ? "/apple-icon.png" : "/icon.svg"), request.url);
  return new Response(null, { status: 307, headers: { Location: target.toString(), "Cache-Control": "public, max-age=300" } });
}
