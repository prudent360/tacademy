/**
 * Illustrated default avatars for people without a photo: a head-and-shoulders figure based on the gender they
 * chose (or a neutral one), with the skin tone, hairstyle, clothes and background picked from their name so a
 * class list doesn't look like one face repeated.
 */
export type Gender = "female" | "male";

const BACKGROUNDS = ["#edecfb", "#e4f7fd", "#fef3c7", "#dcfce7", "#fde2e7", "#e9e7fb"];
const SKIN = ["#5c3a21", "#7a4a2a", "#8d5524", "#a86b3c", "#c68642", "#e0ac69"];
const CLOTHES = ["#4f3fd7", "#31c4f0", "#181340", "#10b981", "#f59e0b", "#6e61e3"];
const HAIR = ["#1d1626", "#2b1d16", "#3b2a20", "#1d1626"];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function AvatarArt({ seed, gender, className = "" }: { seed: string; gender?: Gender | null; className?: string }) {
  const h = hash(seed || "?");
  const pick = <T,>(list: T[], shift: number) => list[(h >>> shift) % list.length];
  const bg = pick(BACKGROUNDS, 0);
  const skin = pick(SKIN, 3);
  const clothes = pick(CLOTHES, 7);
  const hair = pick(HAIR, 11);
  const style = (h >>> 15) % 3;
  const id = `av${h.toString(36)}`;

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs><clipPath id={id}><circle cx="32" cy="32" r="32" /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        <rect width="64" height="64" fill={bg} />
        {!gender ? (
          // No gender chosen: a plain silhouette rather than a guess.
          <g fill={clothes} opacity=".55">
            <circle cx="32" cy="26" r="11" />
            <path d="M10 64c0-12.6 9.8-21.5 22-21.5S54 51.4 54 64z" />
          </g>
        ) : (
        <g transform="translate(32 40) scale(1.16) translate(-32 -36)">
        {/* Hair that falls behind the shoulders. */}
        {gender === "female" && style !== 1 && <path d="M18.5 31c0-10 6-17 13.5-17s13.5 7 13.5 17v19h-27z" fill={hair} />}
        {gender === "female" && style === 1 && <circle cx="32" cy="13.5" r="6.5" fill={hair} />}
        {/* Shoulders, collar and neck. */}
        <path d="M9 64c0-12.5 10.3-21 23-21s23 8.5 23 21z" fill={clothes} />
        <path d="M26 44.5l6 5.5 6-5.5" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="27.5" y="35" width="9" height="10" rx="3.5" fill={skin} />
        <rect x="27.5" y="35" width="9" height="10" rx="3.5" fill="#000" opacity=".14" />
        {/* Head and ears. */}
        <ellipse cx="21.6" cy="30" rx="2" ry="2.6" fill={skin} />
        <ellipse cx="42.4" cy="30" rx="2" ry="2.6" fill={skin} />
        <ellipse cx="32" cy="28.5" rx="10.4" ry="12" fill={skin} />
        {/* Hair on top. */}
        {gender === "female" ? (
          <path d="M21.4 29c-.6-9 4.9-14.6 10.6-14.6S43.2 20 42.6 29c-1.6-4.9-5.6-8.2-10.6-8.2s-9 3.3-10.6 8.2z" fill={hair} />
        ) : gender === "male" ? (
          style === 2 ? (
            <path d="M21.8 24.5c.6-6 4.8-9.6 10.2-9.6s9.6 3.6 10.2 9.6c-2.6-2.4-6.1-3.6-10.2-3.6s-7.6 1.2-10.2 3.6z" fill={hair} />
          ) : (
            <path d="M21.5 27c-.9-7.6 4.3-12.8 10.5-12.8S43.4 19.4 42.5 27c-1.7-3.9-5.4-6-10.5-6s-8.8 2.1-10.5 6z" fill={hair} />
          )
        ) : null}
        {/* A short beard for some. */}
        {gender === "male" && style === 1 && <path d="M23 31.5c.8 6.4 4.4 9.6 9 9.6s8.2-3.2 9-9.6c-2 2.6-5.2 3.8-9 3.8s-7-1.2-9-3.8z" fill={hair} opacity=".85" />}
        {/* Eyes and smile. */}
        <circle cx="28.2" cy="29.2" r="1.15" fill="#1d1626" />
        <circle cx="35.8" cy="29.2" r="1.15" fill="#1d1626" />
        <path d="M29.2 34.2c1.6 1.4 4 1.4 5.6 0" fill="none" stroke="#1d1626" strokeWidth="1.2" strokeLinecap="round" opacity=".75" />
        </g>
        )}
      </g>
    </svg>
  );
}
