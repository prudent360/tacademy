/**
 * The Tekskillup mark: four blocks on a 45° grid, three purple and one cyan.
 * `tone="reversed"` draws the purple blocks white for dark or purple backgrounds;
 * `tone="mono"` draws everything in the current text colour.
 */
export function BrandMark({ className = "size-9", tone = "primary" }: { className?: string; tone?: "primary" | "reversed" | "mono" }) {
  const main = tone === "primary" ? "#4F3FD7" : tone === "reversed" ? "#FFFFFF" : "currentColor";
  const highlight = tone === "mono" ? "currentColor" : "#31C4F0";
  return (
    <svg viewBox="-22 -1 44 44" aria-hidden="true" className={className}>
      <g transform="rotate(45)">
        <rect x="0" y="2" width="10" height="16.5" fill={main} />
        <rect x="11.5" y="0" width="18.5" height="10" fill={main} />
        <rect x="0" y="20" width="18.5" height="10" fill={main} />
        <rect x="20" y="11.5" width="10" height="16.5" fill={highlight} />
      </g>
    </svg>
  );
}
