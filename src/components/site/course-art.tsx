/** Generated cover art for courses without an image, varied by id so cards don't look identical. */
const PALETTES = [
  { bg: "#edecfb", a: "#4f3fd7", b: "#a69ef0", c: "#31c4f0" },
  { bg: "#181340", a: "#6e61e3", b: "#a69ef0", c: "#31c4f0" },
  { bg: "#e4f7fd", a: "#31c4f0", b: "#8fdff7", c: "#4f3fd7" },
  { bg: "#252147", a: "#31c4f0", b: "#6e61e3", c: "#edecfb" },
];

export function CourseArt({ seed, className }: { seed: number; className?: string }) {
  const p = PALETTES[seed % PALETTES.length];
  const variant = seed % 3;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      <rect width="320" height="180" fill={p.bg} />
      {variant === 0 && (
        <>
          <rect x="36" y="100" width="28" height="50" rx="4" fill={p.b} />
          <rect x="76" y="76" width="28" height="74" rx="4" fill={p.a} />
          <rect x="116" y="56" width="28" height="94" rx="4" fill={p.b} />
          <rect x="156" y="34" width="28" height="116" rx="4" fill={p.a} />
          <circle cx="252" cy="70" r="38" fill="none" stroke={p.c} strokeWidth="14" strokeDasharray="150 90" />
        </>
      )}
      {variant === 1 && (
        <>
          <rect x="40" y="40" width="96" height="60" rx="10" fill={p.a} />
          <rect x="184" y="80" width="96" height="60" rx="10" fill={p.b} />
          <path d="M136 70 C 170 70, 150 110, 184 110" stroke={p.c} strokeWidth="5" fill="none" />
          <circle cx="88" cy="140" r="14" fill={p.c} />
          <circle cx="232" cy="44" r="10" fill={p.a} />
        </>
      )}
      {variant === 2 && (
        <>
          <path d="M20 140 L90 90 L150 115 L220 50 L300 80" stroke={p.a} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {[[90, 90], [150, 115], [220, 50]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="10" fill={p.bg} stroke={p.c} strokeWidth="6" />)}
          <rect x="40" y="30" width="70" height="10" rx="5" fill={p.b} />
          <rect x="40" y="48" width="44" height="10" rx="5" fill={p.b} opacity=".6" />
        </>
      )}
    </svg>
  );
}
