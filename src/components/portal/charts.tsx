/**
 * Small server-rendered SVG charts for the portal. No client JavaScript: hovering a point shows its value
 * through the browser's own tooltip.
 */

export const CHART_COLORS = {
  accent: "var(--color-accent)",
  cyan: "var(--color-cyan)",
  amber: "#f59e0b",
  green: "#10b981",
  red: "#ef4444",
  muted: "var(--color-edge-strong)",
} as const;
type ChartColor = keyof typeof CHART_COLORS;

function Legend({ items }: { items: { label: string; color: ChartColor; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: CHART_COLORS[item.color] }} />
          {item.label}{item.value !== undefined && <strong className="font-semibold text-ink">{item.value}</strong>}
        </li>
      ))}
    </ul>
  );
}

/** A tidy axis top with four whole-number steps (4, 8, 20, 40, 100…). */
function niceMax(value: number): number {
  const rough = Math.max(1, value / 4);
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((m) => m >= rough) ?? 10 * power;
  return step * 4;
}

/**
 * One or more series over the same labels, drawn as lines (the first one with a soft fill underneath).
 * `max` fixes the top of the scale, e.g. 100 for percentages.
 */
export function LineChart({ labels, series, max, format = (v) => String(v), height = 220, width = 640 }: {
  labels: string[];
  series: { label: string; color: ChartColor; values: (number | null)[] }[];
  max?: number;
  format?: (value: number) => string;
  height?: number;
  /** Drawing width; use less for narrower panels so the text stays readable. */
  width?: number;
}) {
  const pad = { top: 12, right: 12, bottom: 28, left: 40 };
  const top = max ?? niceMax(Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0))));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => top * f);
  // Gaps (null) split a line into separate runs.
  const runs = (values: (number | null)[]) => values.reduce<{ i: number; v: number }[][]>((acc, v, i) => {
    if (v === null) acc.push([]);
    else acc[acc.length - 1].push({ i, v });
    return acc;
  }, [[]]).filter((run) => run.length > 0);
  const every = Math.ceil(labels.length / 7);

  return (
    <div className="flex flex-col gap-3">
      {series.length > 1 && <Legend items={series.map((s) => ({ label: s.label, color: s.color, value: format(s.values.reduce<number>((sum, v) => sum + (v ?? 0), 0)) }))} />}
      {/* Keeps a readable size on phones, scrolling sideways inside the panel instead of shrinking.
          Right-to-left on the wrapper only makes it start scrolled to the newest week. */}
      <div className="-mx-1 overflow-x-auto px-1 [direction:rtl]">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[440px] [direction:ltr]" role="img" aria-label={series.map((s) => s.label).join(", ")}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted text-[11px]">{format(Math.round(t))}</text>
          </g>
        ))}
        {/* Counted back from the latest week, so the newest label always shows and none overlap. */}
        {labels.map((label, i) => (labels.length - 1 - i) % every === 0 && (
          <text key={label + i} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"} className="fill-muted text-[11px]">{label}</text>
        ))}
        {series.map((s, si) => runs(s.values).map((run, ri) => {
          const line = run.map((p, k) => `${k ? "L" : "M"}${x(p.i)},${y(p.v)}`).join(" ");
          return (
            <g key={`${s.label}-${ri}`}>
              {si === 0 && run.length > 1 && <path d={`${line} L${x(run[run.length - 1].i)},${y(0)} L${x(run[0].i)},${y(0)} Z`} fill={CHART_COLORS[s.color]} opacity={0.1} />}
              <path d={line} fill="none" stroke={CHART_COLORS[s.color]} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {run.map((p) => (
                <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={3.5} fill="#fff" stroke={CHART_COLORS[s.color]} strokeWidth={2}>
                  <title>{`${labels[p.i]} · ${s.label}: ${format(p.v)}`}</title>
                </circle>
              ))}
            </g>
          );
        }))}
      </svg>
      </div>
    </div>
  );
}

/** A ring split into parts, with the total in the middle and a legend beside it. */
export function DonutChart({ parts, centerLabel }: { parts: { label: string; value: number; color: ChartColor }[]; centerLabel: string }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg viewBox="0 0 140 140" className="size-40 shrink-0 -rotate-90" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(", ")}>
        <circle cx={70} cy={70} r={r} fill="none" stroke="var(--color-page)" strokeWidth={18} />
        {total > 0 && parts.filter((p) => p.value > 0).map((p) => {
          const length = (p.value / total) * c;
          const dash = <circle key={p.label} cx={70} cy={70} r={r} fill="none" stroke={CHART_COLORS[p.color]} strokeWidth={18} strokeDasharray={`${length} ${c - length}`} strokeDashoffset={-offset}><title>{`${p.label}: ${p.value}`}</title></circle>;
          offset += length;
          return dash;
        })}
        <g className="rotate-90" style={{ transformOrigin: "70px 70px" }}>
          <text x={70} y={68} textAnchor="middle" className="fill-ink font-display text-[26px] font-bold">{total}</text>
          <text x={70} y={88} textAnchor="middle" className="fill-muted text-[11px]">{centerLabel}</text>
        </g>
      </svg>
      <ul className="flex flex-col gap-2.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2.5">
            <span className="size-3 rounded-full" style={{ background: CHART_COLORS[p.color] }} />
            <span className="text-body">{p.label}</span>
            <strong className="ml-auto pl-4 font-semibold text-ink">{p.value}</strong>
            <span className="w-10 text-right text-xs text-muted">{total ? `${Math.round((p.value / total) * 100)}%` : "–"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One row per item with a bar for each measure (all on a 0–100 scale), e.g. courses compared. */
export function GroupedBars({ rows, measures }: {
  rows: { label: string; detail?: string; values: number[] }[];
  measures: { label: string; color: ChartColor }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <Legend items={measures} />
      <ul className="flex flex-col gap-4">
        {rows.map((row) => (
          <li key={row.label} className="flex flex-col gap-1.5">
            <p className="flex items-baseline justify-between gap-3 text-sm"><span className="truncate font-semibold text-ink">{row.label}</span>{row.detail && <span className="shrink-0 text-xs text-muted">{row.detail}</span>}</p>
            <div className="flex flex-col gap-1">
              {measures.map((m, i) => (
                <div key={m.label} className="flex items-center gap-2" title={`${m.label}: ${row.values[i]}%`}>
                  <div className="h-2.5 grow overflow-hidden rounded-full bg-page">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, row.values[i]))}%`, background: CHART_COLORS[m.color] }} />
                  </div>
                  <span className="w-9 text-right text-xs font-semibold text-body">{row.values[i]}%</span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
