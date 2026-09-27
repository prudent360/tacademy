import { BellIcon, BuildingIcon, CheckIcon, MonitorIcon, PinIcon, VideoIcon } from "@/components/icons";

/** Decorative hero visual: one online class, one in-person class, and the feedback loop. */
export function ClassPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[520px] select-none pb-16 pt-6">
      <div className="absolute -inset-x-6 inset-y-0 -z-10 rounded-[28px] bg-[radial-gradient(circle_at_30%_20%,#e9dffb,transparent_60%),radial-gradient(circle_at_80%_90%,#d6f3fc,transparent_55%)]" />
      {/* Online class */}
      <div className="relative rounded-[18px] border border-edge bg-white p-5 shadow-[0_24px_48px_-24px_rgba(25,17,46,0.35)]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent"><MonitorIcon className="size-3.5" /> Live online</span>
          <span className="font-mono text-xs text-muted">Tonight · 18:00</span>
        </div>
        <p className="mt-4 font-display text-lg font-bold text-ink">Week 3: Data modelling & DAX</p>
        <p className="text-sm text-muted">Data Analytics with Power BI</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex -space-x-2">
            {["#7134d9", "#31c4f0", "#19112e", "#8e5ce6"].map((c, i) => (
              <span key={c} className="flex size-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white" style={{ background: c }}>{["AO", "KM", "TJ", "RB"][i]}</span>
            ))}
            <span className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-page text-[11px] font-semibold text-muted">+18</span>
          </div>
          <span className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-white"><VideoIcon className="size-4" /> Join class</span>
        </div>
      </div>
      {/* In-person class */}
      <div className="relative -mt-3 ml-8 rounded-[18px] border border-edge bg-white p-5 shadow-[0_24px_48px_-24px_rgba(25,17,46,0.35)] sm:ml-16">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-full bg-cyan-soft px-3 py-1 text-xs font-semibold text-cyan-ink"><BuildingIcon className="size-3.5" /> In person</span>
          <span className="font-mono text-xs text-muted">Sat · 10:00</span>
        </div>
        <p className="mt-4 font-display text-lg font-bold text-ink">Hands-on lab: dashboards</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><PinIcon className="size-4" /> Lab 2, Innovation Hub</p>
      </div>
      {/* Feedback + reminder chips */}
      <div className="absolute -left-2 bottom-0 flex items-center gap-3 rounded-2xl border border-edge bg-white px-4 py-3 shadow-lg sm:-left-8">
        <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckIcon className="size-5" /></span>
        <div>
          <p className="text-sm font-semibold text-ink">Feedback received</p>
          <p className="text-xs text-muted">Sales dashboard · 86/100</p>
        </div>
      </div>
      <div className="absolute -right-2 -top-1 flex items-center gap-2 rounded-full border border-edge bg-white px-3.5 py-2 text-xs font-semibold text-ink shadow-lg sm:-right-6">
        <BellIcon className="size-4 text-cyan" /> Class starts in 1 hour
      </div>
    </div>
  );
}
