"use client";

import { useEffect, useRef, useState } from "react";
import { AwardIcon, BellIcon, CalendarIcon, CheckIcon, ClipboardIcon, MegaphoneIcon, PlayIcon, UsersIcon, VideoIcon } from "@/components/icons";

type View = { title: string; text: string; scene: React.ReactNode };
type Audience = "students" | "instructors";

const bar = (width: string, tone = "bg-line") => <span className={`block h-1.5 rounded-full ${tone} ${width}`} />;

/** A small app window: the main picture in each view. */
function Window({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`absolute overflow-hidden rounded-[14px] bg-white shadow-[0_30px_70px_-30px_rgba(24,19,64,.45)] ring-1 ring-black/5 ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-line px-3.5 py-2.5">
        <span className="size-2 rounded-full bg-red-400" /><span className="size-2 rounded-full bg-amber-400" /><span className="size-2 rounded-full bg-emerald-400" />
        <span className="ml-auto text-[10px] font-semibold text-muted">{label}</span>
      </div>
      <div className="flex flex-col gap-2.5 bg-panel p-3.5">{children}</div>
    </div>
  );
}

/** A floating card around the window; `delay` staggers them in. */
function Float({ className, delay = 0, children }: { className: string; delay?: number; children: React.ReactNode }) {
  return (
    <div className={`showcase-float absolute ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="showcase-bob flex items-center gap-2 rounded-[12px] bg-white px-3 py-2 text-[11px] font-bold text-ink shadow-[0_16px_34px_-14px_rgba(24,19,64,.5)] ring-1 ring-black/5" style={{ animationDelay: `${delay + 600}ms` }}>{children}</div>
    </div>
  );
}

function Fill({ pct, tone = "bg-accent" }: { pct: number; tone?: string }) {
  return <span className="block h-1.5 overflow-hidden rounded-full bg-accent-soft"><span className="showcase-fill block h-full origin-left rounded-full" style={{ width: `${pct}%` }}><span className={`block size-full rounded-full ${tone}`} /></span></span>;
}

const card = "rounded-[10px] bg-white p-3 shadow-[0_1px_2px_rgba(24,19,64,.06)]";

const STUDENT_VIEWS: View[] = [
  {
    title: "Your dashboard",
    text: "Your next live class, your progress and your XP, the moment you sign in.",
    scene: <>
      <Window label="Dashboard" className="left-[40px] top-[40px] w-[400px]">
        <div className="flex items-center justify-between">
          <span className="flex flex-col gap-1"><span className="text-[13px] font-bold text-ink">Good evening, Ada</span><span className="text-[10px] text-muted">Data Analytics with Power BI</span></span>
          <span className="relative flex size-12 items-center justify-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="#e9e7fb" strokeWidth="3.5" /><circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" className="showcase-ring text-accent" strokeDasharray="94.2" style={{ ["--ring-to" as string]: "30" }} /></svg>
            <span className="text-[11px] font-bold text-accent">Lv 4</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className={card}><p className="text-[10px] text-muted">Next live class</p><p className="mt-1 text-[12px] font-bold text-ink">Tue · 18:00</p><p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><VideoIcon className="size-3" /> Starts in 2 hours</p></div>
          <div className={card}><p className="text-[10px] text-muted">Assignment due</p><p className="mt-1 text-[12px] font-bold text-ink">Sales dashboard</p><p className="mt-0.5 text-[10px] font-semibold text-amber-700">Due Friday</p></div>
        </div>
        <div className={`${card} flex flex-col gap-2`}>
          <div className="flex justify-between text-[10px]"><span className="font-semibold text-ink">Lessons</span><span className="text-muted">12 of 20</span></div>
          <Fill pct={60} />
          <div className="flex justify-between text-[10px]"><span className="font-semibold text-ink">Attendance</span><span className="text-muted">92%</span></div>
          <Fill pct={92} tone="bg-cyan" />
        </div>
      </Window>
      <Float className="right-[30px] top-[2px]" delay={300}><span className="flex size-5 items-center justify-center rounded-full bg-accent text-[9px] text-white">XP</span> +50 XP earned</Float>
      <Float className="bottom-[34px] left-[8px]" delay={700}><CalendarIcon className="size-4 text-accent" /> Added to your calendar</Float>
    </>,
  },
  {
    title: "Lessons & quizzes",
    text: "Watch lessons at your own pace, then check what you've learned with quick quizzes.",
    scene: <>
      <Window label="Week 2: Data modelling" className="left-[30px] top-[36px] w-[300px]">
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[10px] bg-[linear-gradient(135deg,#211a5c,#3d2fb8)]">
          <PlayIcon className="size-10 text-white/90" />
          <span className="absolute bottom-2 left-2 right-2"><span className="block h-1 overflow-hidden rounded-full bg-white/25"><span className="showcase-fill block h-full w-[45%] origin-left rounded-full bg-white" /></span></span>
        </div>
        {["Relationships", "Star schemas", "DAX basics"].map((t, i) => (
          <div key={t} className={`${card} flex items-center gap-2.5 py-2`}>
            <span className={`flex size-5 items-center justify-center rounded-full ${i < 2 ? "bg-emerald-500 text-white" : "border border-edge-strong"}`}>{i < 2 && <CheckIcon className="size-3" />}</span>
            <span className="text-[11px] font-semibold text-ink">{t}</span>
          </div>
        ))}
      </Window>
      <Window label="Quiz" className="right-[26px] top-[120px] w-[190px]">
        <div className="flex flex-col items-center gap-1.5 py-2">
          <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50 font-display text-lg font-bold text-emerald-700">92%</span>
          <span className="text-[12px] font-bold text-ink">You passed!</span>
          <span className="text-[10px] text-muted">11 of 12 correct</span>
        </div>
      </Window>
      <Float className="right-[40px] top-[40px]" delay={500}><CheckIcon className="size-4 text-emerald-600" /> Lesson complete</Float>
    </>,
  },
  {
    title: "SQL practice",
    text: "Write and run real SQL in your browser, and get it marked straight away.",
    scene: <>
      <Window label="Question 4 of 5" className="left-[40px] top-[36px] w-[420px]">
        <p className="text-[11px] font-semibold text-ink">Top five customers by spend, highest first.</p>
        <div className="rounded-[10px] bg-white p-3 font-mono text-[10.5px] leading-[1.7] ring-1 ring-line">
          <p><span className="text-accent">SELECT</span> c.name, <span className="text-cyan-ink">SUM</span>(o.total)</p>
          <p><span className="text-accent">FROM</span> customers c <span className="text-accent">JOIN</span> orders o</p>
          <p className="text-muted">  … <span className="text-accent">ORDER BY</span> 2 <span className="text-accent">DESC LIMIT</span> 5</p>
        </div>
        <div className="flex items-center gap-2"><span className="rounded-md bg-navy px-2.5 py-1 text-[10px] font-bold text-white">Run query</span><span className="text-[10px] text-muted">5 rows · 12 ms</span></div>
        <div className="showcase-rows overflow-hidden rounded-[10px] bg-white text-[10px] ring-1 ring-line">
          {[["Sarah Williams", "4,306.80"], ["David Adeyemi", "4,079.77"], ["Blessing Obi", "3,217.46"]].map(([n, v], i) => (
            <div key={n} className="flex justify-between border-b border-line px-3 py-1.5 font-mono last:border-0" style={{ animationDelay: `${300 + i * 150}ms` }}><span className="text-ink">{n}</span><span className="text-body">{v}</span></div>
          ))}
        </div>
      </Window>
      <Float className="right-[18px] top-0" delay={900}><span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white"><CheckIcon className="size-3" /></span> Correct · +20 XP</Float>
    </>,
  },
  {
    title: "Certificates",
    text: "Finish the course and get a certificate employers can verify with a QR code.",
    scene: <>
      <div className="absolute left-[60px] top-[44px] flex w-[400px] flex-col items-center gap-1.5 rounded-[6px] bg-white px-8 py-7 text-center shadow-[0_30px_70px_-30px_rgba(24,19,64,.45)] ring-1 ring-black/5">
        <div className="pointer-events-none absolute inset-2 rounded-[4px] border border-accent/25" />
        <AwardIcon className="size-7 text-accent" />
        <p className="font-display text-[17px] font-bold text-ink">Certificate of Completion</p>
        <p className="text-[9px] text-muted">This certifies that</p>
        <p className="border-b border-accent/30 px-4 pb-1 font-display text-[18px] font-bold text-ink">Ada Okafor</p>
        <p className="mt-1 text-[11px] font-bold text-accent">Data Analytics with Power BI</p>
        <div className="mt-3 grid w-full grid-cols-3 items-center border-t border-line pt-3 text-[9px]">
          <span className="text-muted">Issued 16 Nov</span>
          <span className="mx-auto grid size-10 grid-cols-5 gap-px rounded-sm bg-white p-0.5 ring-1 ring-line">{Array.from({ length: 25 }, (_, i) => <span key={i} className={[0, 1, 3, 5, 7, 8, 11, 12, 14, 16, 18, 19, 21, 23, 24].includes(i) ? "bg-ink" : ""} />)}</span>
          <span className="font-mono text-muted">TSU-2026-…</span>
        </div>
      </div>
      <Float className="right-[24px] top-[24px]" delay={400}><span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white"><CheckIcon className="size-3" /></span> Verified credential</Float>
      <Float className="bottom-[30px] left-[20px]" delay={800}><AwardIcon className="size-4 text-accent" /> Share on LinkedIn</Float>
    </>,
  },
];

const INSTRUCTOR_VIEWS: View[] = [
  {
    title: "Cohort overview",
    text: "Your next live class, your to-dos and every student's progress in one place.",
    scene: <>
      <Window label="Autumn cohort" className="left-[40px] top-[40px] w-[400px]">
        <div className="flex gap-1.5 text-[10px] font-semibold">{["Overview", "Live classes", "Lessons", "Students"].map((t, i) => <span key={t} className={`rounded-md px-2 py-1 ${i === 0 ? "bg-accent-soft text-accent" : "text-muted"}`}>{t}</span>)}</div>
        <div className={card}><p className="text-[10px] text-muted">Next live class</p><p className="mt-1 text-[12px] font-bold text-ink">DAX fundamentals · Thu 18:00</p></div>
        <div className={`${card} flex flex-col gap-2`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">To do</p>
          {[["2 live classes need attendance", "Take attendance"], ["5 submissions to grade", "Grade"]].map(([t, a]) => (
            <div key={t} className="flex items-center justify-between text-[11px]"><span className="font-semibold text-ink">{t}</span><span className="font-semibold text-accent">{a} →</span></div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">{[["24", "Students"], ["91%", "Attendance"], ["8/12", "Classes held"]].map(([v, l]) => <div key={l} className={card}><p className="font-display text-[15px] font-bold text-ink">{v}</p><p className="text-[9px] text-muted">{l}</p></div>)}</div>
      </Window>
      <Float className="right-[20px] top-[2px]" delay={500}><UsersIcon className="size-4 text-accent" /> 3 new students this week</Float>
    </>,
  },
  {
    title: "Attendance in one tap",
    text: "Everyone starts as present. Change the few who weren't, then save.",
    scene: <>
      <Window label="Week 3 · Attendance" className="left-[50px] top-[36px] w-[400px]">
        {[["Ada Okafor", 0], ["Kofi Mensah", 0], ["Tunde Bello", 1], ["Grace Eze", 0]].map(([name, status]) => (
          <div key={name as string} className={`${card} flex items-center justify-between py-2`}>
            <span className="text-[11px] font-semibold text-ink">{name}</span>
            <span className="flex gap-1">{["Present", "Late", "Absent"].map((s, i) => <span key={s} className={`rounded-md px-2 py-1 text-[9.5px] font-bold ${i === status ? "bg-accent text-white" : "text-muted ring-1 ring-edge-strong"}`}>{s}</span>)}</span>
          </div>
        ))}
        <span className="w-fit rounded-md bg-accent px-3 py-1.5 text-[10px] font-bold text-white">Save attendance</span>
      </Window>
      <Float className="bottom-[26px] right-[16px]" delay={700}><span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white"><CheckIcon className="size-3" /></span> Attendance saved for 24 students</Float>
    </>,
  },
  {
    title: "Grading & feedback",
    text: "Score each submission and leave written feedback students can act on.",
    scene: <>
      <Window label="Sales dashboard · Ada Okafor" className="left-[40px] top-[36px] w-[420px]">
        <div className={`${card} flex items-center gap-2.5`}><ClipboardIcon className="size-5 text-accent" /><span className="flex flex-col gap-1">{bar("w-28", "bg-edge-strong")}{bar("w-16")}</span><span className="ml-auto text-[10px] font-semibold text-accent">Open file</span></div>
        <div className={`${card} flex items-center gap-3`}><span className="text-[11px] font-semibold text-ink">Score</span><span className="rounded-md px-2 py-1 font-display text-[14px] font-bold text-ink ring-1 ring-accent">88</span><span className="text-[11px] text-muted">/ 100</span></div>
        <div className={`${card} flex flex-col gap-1.5`}><p className="text-[10px] font-semibold text-ink">Feedback</p>{bar("w-full", "bg-edge-strong")}{bar("w-[85%]")}{bar("w-[60%]")}</div>
        <span className="w-fit rounded-md bg-accent px-3 py-1.5 text-[10px] font-bold text-white">Save grade</span>
      </Window>
      <Float className="right-[16px] top-0" delay={600}><MegaphoneIcon className="size-4 text-accent" /> Feedback sent to Ada</Float>
    </>,
  },
  {
    title: "Announcements & reminders",
    text: "Post to your cohort by email and in the app. Reminders go out before every class.",
    scene: <>
      <Window label="New announcement" className="left-[40px] top-[40px] w-[360px]">
        <div className={card}><p className="text-[12px] font-bold text-ink">Extra lab this Saturday</p></div>
        <div className={`${card} flex flex-col gap-1.5`}>{bar("w-full", "bg-edge-strong")}{bar("w-[90%]")}{bar("w-[70%]")}</div>
        <div className="flex items-center gap-2 text-[10px] text-body"><span className="flex size-3.5 items-center justify-center rounded-sm bg-accent text-white"><CheckIcon className="size-2.5" /></span> Also email every student</div>
        <span className="w-fit rounded-md bg-accent px-3 py-1.5 text-[10px] font-bold text-white">Post</span>
      </Window>
      <Float className="right-[20px] top-[70px]" delay={500}><MegaphoneIcon className="size-4 text-accent" /> Sent to 24 students</Float>
      <Float className="bottom-[40px] right-[40px]" delay={900}><BellIcon className="size-4 text-amber-500" /> Reminder: class in 1 hour</Float>
    </>,
  },
];

/** The dashboard, shown off: students' and instructors' views, drawn in code, with cards that float in as it plays. */
export function ProductShowcase() {
  const [audience, setAudience] = useState<Audience>("students");
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const views = audience === "students" ? STUDENT_VIEWS : INSTRUCTOR_VIEWS;

  // Only animate once it's on screen, so the first view isn't over before anyone sees it.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function choose(next: Audience) {
    setAudience(next);
    setIndex(0);
  }

  return (
    <div ref={root} className="flex flex-col gap-8">
      <div role="tablist" aria-label="Who it's for" className="mx-auto flex rounded-full bg-accent-soft p-1">
        {(["students", "instructors"] as const).map((a) => (
          <button key={a} type="button" role="tab" aria-selected={audience === a} onClick={() => choose(a)} className={`h-10 cursor-pointer rounded-full px-5 text-sm font-semibold transition ${audience === a ? "bg-white text-accent shadow-[0_4px_14px_-6px_rgba(79,63,215,.5)]" : "text-body hover:text-ink"}`}>
            For {a}
          </button>
        ))}
      </div>

      <div className="grid items-center gap-10 lg:grid-cols-[.85fr_1.15fr] lg:gap-14">
        <ol className="group/steps flex flex-col gap-2">
          {views.map((view, i) => {
            const active = i === index;
            return (
              <li key={`${audience}-${view.title}`}>
                <button type="button" onClick={() => setIndex(i)} aria-current={active ? "true" : undefined} className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-[5px] border p-4 text-left transition sm:p-5 ${active ? "border-edge bg-white shadow-[0_20px_45px_-30px_rgba(24,19,64,.45)]" : "border-transparent hover:bg-panel"}`}>
                  <span className={`font-display text-lg font-bold ${active ? "text-accent" : "text-ink"}`}>{view.title}</span>
                  <span className={`text-[15px] leading-relaxed text-muted ${active ? "" : "line-clamp-1 lg:line-clamp-none"}`}>{view.text}</span>
                  {active && (
                    <span className="mt-2 block h-1 overflow-hidden rounded-full bg-accent-soft">
                      {/* The bar filling moves on to the next view; it waits while off screen and while the list is hovered. */}
                      <span key={`${audience}-${index}`} onAnimationEnd={() => setIndex((index + 1) % views.length)} className={`step-progress block h-full rounded-full bg-accent group-hover/steps:[animation-play-state:paused] ${visible ? "" : "[animation-play-state:paused]"}`} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="relative order-first flex items-center justify-center overflow-hidden rounded-[5px] border border-accent/10 bg-[linear-gradient(135deg,#f1efff_0%,#eefafe_100%)] px-4 py-10 sm:py-12 lg:order-none">
          <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />
          {/* Drawn at 520×400 and scaled down on narrow screens; the outer box reserves the scaled size. */}
          <div aria-hidden="true" className="relative h-[231px] w-[300px] sm:h-[400px] sm:w-[520px]">
            <div className="absolute left-0 top-0 h-[400px] w-[520px] origin-top-left scale-[.577] sm:scale-100">
              {visible && <div key={`${audience}-${index}`} className="scene-in absolute inset-0">{views[index].scene}</div>}
            </div>
          </div>
          <p className="sr-only" aria-live="polite">{views[index].title}: {views[index].text}</p>
        </div>
      </div>
    </div>
  );
}
