import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { freeClasses } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { buildEventIcs } from "@/lib/ics";
import { absoluteUrl } from "@/lib/site";

/** Calendar file for a free class. The meeting link isn't in it: that's only emailed to people who signed up. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [fc] = await (await getDb()).select().from(freeClasses).where(and(eq(freeClasses.slug, slug), ne(freeClasses.status, "draft")));
  if (!fc) return new Response("Not found", { status: 404 });
  const settings = await getSettings();
  const url = absoluteUrl(`/free-classes/${fc.slug}`);
  const ics = buildEventIcs({
    uid: `free-class-${fc.id}`,
    title: `${fc.title} (free class)`,
    description: `${fc.summary}\n\n${fc.mode === "virtual" ? "Your joining link is in your confirmation email." : ""}`.trim(),
    startsAt: fc.startsAt,
    endsAt: fc.endsAt,
    location: fc.mode === "virtual" ? "Online (link in your confirmation email)" : fc.venue,
    url,
  }, settings.siteName);
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${fc.slug}.ics"` } });
}
