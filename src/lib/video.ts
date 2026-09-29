import "server-only";
import { createHash } from "node:crypto";
import { getSettings } from "./data";
import { decryptSecret } from "./secrets";

export type VideoProvider = "bunny" | "youtube" | "vimeo" | "loom";
export type EmbeddedVideo = { provider: VideoProvider; embedUrl: string };

/** How long a signed Bunny Stream link stays valid; long enough to watch a lesson, short enough that shared links stop working. */
const BUNNY_TOKEN_SECONDS = 6 * 60 * 60;

type Parsed = { provider: VideoProvider; id: string; libraryId?: string; hash?: string };

/** Recognises links people paste from Bunny Stream, YouTube, Vimeo and Loom; anything else stays a plain link. */
export function parseVideoUrl(raw: string | null | undefined): Parsed | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  // Bunny Stream: player/iframe.mediadelivery.net/embed|play/{library}/{video}, video.bunnycdn.com/play/{library}/{video}
  if (/(^|\.)mediadelivery\.net$/.test(host) || host === "video.bunnycdn.com") {
    const at = parts.findIndex((p) => p === "embed" || p === "play");
    const [libraryId, id] = at >= 0 ? parts.slice(at + 1, at + 3) : [];
    return libraryId && id && /^\d+$/.test(libraryId) ? { provider: "bunny", libraryId, id } : null;
  }
  if (host === "youtu.be") return parts[0] ? { provider: "youtube", id: parts[0] } : null;
  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const id = url.searchParams.get("v") ?? (["embed", "shorts", "live"].includes(parts[0]) ? parts[1] : undefined);
    return id ? { provider: "youtube", id } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const at = parts.findIndex((p) => /^\d+$/.test(p));
    if (at < 0) return null;
    // Unlisted Vimeo links carry a privacy hash: vimeo.com/{id}/{hash} or ?h={hash}.
    const hash = url.searchParams.get("h") ?? (parts[at + 1] && /^[0-9a-f]+$/i.test(parts[at + 1]) ? parts[at + 1] : undefined);
    return { provider: "vimeo", id: parts[at], hash };
  }
  if (host.endsWith("loom.com")) {
    const at = parts.findIndex((p) => p === "share" || p === "embed");
    return at >= 0 && parts[at + 1] ? { provider: "loom", id: parts[at + 1] } : null;
  }
  return null;
}

/** An embeddable player URL for a lesson video, with Bunny links signed when token authentication is set up. */
export async function lessonVideo(raw: string | null | undefined): Promise<EmbeddedVideo | null> {
  const video = parseVideoUrl(raw);
  if (!video) return null;
  const safeId = encodeURIComponent(video.id);
  switch (video.provider) {
    case "youtube":
      return { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${safeId}?rel=0&modestbranding=1` };
    case "vimeo":
      return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${safeId}${video.hash ? `?h=${encodeURIComponent(video.hash)}` : ""}` };
    case "loom":
      return { provider: "loom", embedUrl: `https://www.loom.com/embed/${safeId}` };
    case "bunny": {
      const base = `https://player.mediadelivery.net/embed/${video.libraryId}/${safeId}`;
      const key = decryptSecret((await getSettings()).video?.bunnyTokenKey);
      if (!key) return { provider: "bunny", embedUrl: `${base}?responsive=true` };
      // Bunny's embed token: SHA256 hex of (token key + video id + expiry in UNIX seconds).
      const expires = Math.floor(Date.now() / 1000) + BUNNY_TOKEN_SECONDS;
      const token = createHash("sha256").update(`${key}${video.id}${expires}`).digest("hex");
      return { provider: "bunny", embedUrl: `${base}?token=${token}&expires=${expires}&responsive=true` };
    }
  }
}
