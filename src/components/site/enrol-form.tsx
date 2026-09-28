"use client";

import Link from "next/link";
import { startTransition, useActionState, useId, useMemo, useRef, useState } from "react";
import { enrol, type EnrolState } from "@/app/actions/enroll";
import { ArrowLeft } from "@/components/icons";
import { COUNTRIES, PhoneInput } from "@/components/phone-input";
import type { DeliveryMode, PriceMap } from "@/db/schema";
import { formatMoney, gatewayFor } from "@/lib/money";
import { availablePlans, PLAN_LABEL, quote, type EnrolPlan } from "@/lib/pricing";
import { MODE_LABEL, QUALIFICATIONS } from "@/lib/utils";

export type EnrolCohort = {
  id: number;
  courseId: number;
  courseTitle: string;
  name: string;
  dates: string;
  deliveryMode: DeliveryMode;
  free: boolean;
  prices: PriceMap;
  registrationFees: PriceMap;
  depositPercent: number | null;
  registrationOnly: boolean;
  /** Currencies this cohort can be paid in, and how. */
  currencies: { code: string; online: boolean; bank: boolean }[];
};

type Prefill = { firstName: string; lastName: string; email: string; dial: string; phone: string; dateOfBirth: string; qualification: string };

const inputClass = "h-12 w-full rounded-[5px] border border-edge-strong bg-white px-3.5 text-[15px] text-ink transition placeholder:text-[#8b8598] hover:border-accent-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10 read-only:bg-panel read-only:text-muted";

function Field({ label, htmlFor, required, children, className = "" }: { label: string; htmlFor: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}{required && <span className="text-red-600" aria-hidden="true"> *</span>}</label>
      {children}
    </div>
  );
}

function Choice({ name, value, checked, onChange, children }: { name: string; value: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-[8px] border p-4 transition ${checked ? "border-accent bg-accent-soft/60 ring-2 ring-accent/15" : "border-edge-strong hover:border-accent-muted"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1 size-4 shrink-0 accent-accent" />
      <span className="flex min-w-0 grow flex-col gap-0.5">{children}</span>
    </label>
  );
}

/** Two-step enrolment: the student's details, then course, cohort and payment, with a live summary. */
export function EnrolForm({ cohorts, preferred, initialCohortId, signedIn, phoneCountry }: {
  cohorts: EnrolCohort[];
  preferred: string[];
  initialCohortId: number | null;
  signedIn: Prefill | null;
  phoneCountry?: string;
}) {
  const id = useId();
  const top = useRef<HTMLDivElement>(null);
  const [state, formAction, pending] = useActionState<EnrolState, FormData>(enrol, undefined);
  const [step, setStep] = useState<1 | 2>(1);

  const courses = useMemo(() => [...new Map(cohorts.map((c) => [c.courseId, c.courseTitle])).entries()], [cohorts]);
  const initial = cohorts.find((c) => c.id === initialCohortId);
  const [courseId, setCourseId] = useState<number | null>(initial?.courseId ?? null);
  const [cohortId, setCohortId] = useState<number | null>(initial?.id ?? null);
  const cohort = cohorts.find((c) => c.id === cohortId) ?? null;

  const rank = (code: string) => { const i = preferred.indexOf(code); return i === -1 ? 99 : i; };
  const currencies = cohort ? [...cohort.currencies].sort((a, b) => rank(a.code) - rank(b.code)) : [];
  const [currencyChoice, setCurrency] = useState("");
  const currency = currencies.find((c) => c.code === currencyChoice) ?? currencies[0];
  const plans = cohort && currency ? availablePlans(cohort, currency.code) : ["full" as const];
  const [planChoice, setPlan] = useState<EnrolPlan>("full");
  const plan = plans.includes(planChoice) ? planChoice : "full";
  const [methodChoice, setMethod] = useState<"online" | "bank">("online");
  const method = currency?.online && currency?.bank ? methodChoice : currency?.bank ? "bank" : "online";
  const q = cohort && currency && !cohort.free ? quote(cohort, currency.code, plan) : null;
  const money = (minor: number) => (currency ? formatMoney(minor, currency.code) : "—");

  function chooseCourse(value: string) {
    const next = Number(value) || null;
    setCourseId(next);
    const own = cohorts.filter((c) => c.courseId === next);
    setCohortId(own.length === 1 ? own[0].id : null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      setStep(2);
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const payLabel = !cohort ? "Choose a cohort" : cohort.free ? "Confirm my place" : method === "bank" ? `Get transfer details · ${money(q?.dueNow ?? 0)}` : `Pay ${money(q?.dueNow ?? 0)}`;
  const phoneDefault = signedIn?.dial ? COUNTRIES.find((c) => c.dial === signedIn.dial)?.code : undefined;

  return (
    <div ref={top} className="grid scroll-mt-24 items-start gap-6 lg:grid-cols-[1.45fr_1fr]">
      <form id={`${id}-form`} onSubmit={onSubmit} aria-busy={pending} className="rounded-[24px] bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,.6)] sm:p-10">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <ol className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[1px]" aria-label="Progress">
            <li className={step === 1 ? "text-accent" : "text-muted"} aria-current={step === 1 ? "step" : undefined}>1. Your details</li>
            <li aria-hidden="true" className="h-px w-8 bg-edge-strong" />
            <li className={step === 2 ? "text-accent" : "text-muted"} aria-current={step === 2 ? "step" : undefined}>2. Course &amp; payment</li>
          </ol>
          <h2 className="font-display text-2xl font-bold tracking-tight text-accent sm:text-[30px]">{step === 1 ? "Your journey into tech starts here" : "Choose your course"}</h2>
        </div>

        {/* Step 1 stays mounted while hidden so its values are submitted with step 2. */}
        <div className={step === 1 ? "flex flex-col gap-6" : "hidden"}>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="First Name" htmlFor={`${id}-first`} required><input id={`${id}-first`} name="firstName" required maxLength={60} autoComplete="given-name" placeholder="Enter first name" defaultValue={signedIn?.firstName} className={inputClass} /></Field>
            <Field label="Last Name" htmlFor={`${id}-last`} required><input id={`${id}-last`} name="lastName" required maxLength={60} autoComplete="family-name" placeholder="Enter last name" defaultValue={signedIn?.lastName} className={inputClass} /></Field>
          </div>
          <Field label="Email Address" htmlFor={`${id}-email`} required>
            <input id={`${id}-email`} name="email" type="email" required maxLength={200} autoComplete="email" placeholder="Enter email address" defaultValue={signedIn?.email} readOnly={Boolean(signedIn)} className={inputClass} />
          </Field>
          <Field label="Phone Number (WhatsApp preferred)" htmlFor={`${id}-phone`} required>
            <PhoneInput id={`${id}-phone`} defaultCountry={phoneDefault ?? phoneCountry} defaultValue={signedIn?.phone} />
          </Field>
          <Field label="Date of Birth" htmlFor={`${id}-dob`} required>
            <input id={`${id}-dob`} name="dateOfBirth" type="date" required min="1920-01-01" max={new Date().toISOString().slice(0, 10)} defaultValue={signedIn?.dateOfBirth} className={inputClass} />
          </Field>
          <Field label="Highest academic qualification" htmlFor={`${id}-qual`}>
            <select id={`${id}-qual`} name="qualification" defaultValue={signedIn?.qualification ?? ""} className={`${inputClass} cursor-pointer`}>
              <option value="">Select an option</option>
              {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </Field>
          {!signedIn && <p className="text-sm text-muted">Already a student? <Link href="/login?next=/enroll" className="font-semibold text-accent hover:text-accent-dark">Sign in</Link> to enrol with your account.</p>}
          <div className="border-t border-line pt-6">
            <button type="submit" className="flex h-13 w-full cursor-pointer items-center justify-center rounded-[8px] bg-accent text-[16px] font-semibold text-white shadow-[0_12px_28px_-14px_rgba(113,52,217,.9)] transition hover:bg-accent-dark">Next</button>
          </div>
        </div>

        {step === 2 && (
          <div className="flex flex-col gap-7">
            <Field label="Course" htmlFor={`${id}-course`} required>
              <select id={`${id}-course`} value={courseId ?? ""} onChange={(e) => chooseCourse(e.target.value)} required className={`${inputClass} cursor-pointer`}>
                <option value="">Select a course</option>
                {courses.map(([cid, title]) => <option key={cid} value={cid}>{title}</option>)}
              </select>
            </Field>

            {courseId && (
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2 text-sm font-medium text-ink">Cohort<span className="text-red-600" aria-hidden="true"> *</span></legend>
                {cohorts.filter((c) => c.courseId === courseId).map((c) => (
                  <Choice key={c.id} name="cohortChoice" value={String(c.id)} checked={cohortId === c.id} onChange={() => setCohortId(c.id)}>
                    <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-ink">{c.name}</span><span className="rounded-full bg-page px-2.5 py-0.5 text-xs font-semibold text-body">{MODE_LABEL[c.deliveryMode]}</span></span>
                    <span className="text-sm text-muted">{c.dates}</span>
                  </Choice>
                ))}
              </fieldset>
            )}
            {cohort && <input type="hidden" name="cohortId" value={cohort.id} />}

            {cohort && !cohort.free && currencies.length > 1 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium text-ink">Pay in</legend>
                <div className="flex flex-wrap gap-2">
                  {currencies.map((c) => (
                    <label key={c.code} className={`flex h-10 cursor-pointer items-center rounded-[8px] border px-4 text-sm font-semibold ${currency?.code === c.code ? "border-accent bg-accent-soft text-accent" : "border-edge-strong text-body hover:border-accent"}`}>
                      <input type="radio" name="currencyChoice" value={c.code} checked={currency?.code === c.code} onChange={() => setCurrency(c.code)} className="sr-only" />{c.code}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {currency && <input type="hidden" name="currency" value={currency.code} />}

            {cohort && !cohort.free && currency && plans.length > 1 && (
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2 text-sm font-medium text-ink">Payment plan</legend>
                {plans.map((p) => {
                  const pq = quote(cohort, currency.code, p);
                  return (
                    <Choice key={p} name="planChoice" value={p} checked={plan === p} onChange={() => setPlan(p)}>
                      <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-ink">{p === "full" ? "Pay in full" : p === "deposit" ? `Pay a ${cohort.depositPercent}% deposit` : "Pay the registration fee now"}</span><span className="font-semibold text-ink">{money(pq.dueNow)} now</span></span>
                      <span className="text-sm text-muted">{p === "full" ? "Everything settled today." : `${money(pq.later)} tuition balance due before the cohort starts, payable from your dashboard.`}</span>
                    </Choice>
                  );
                })}
              </fieldset>
            )}
            <input type="hidden" name="plan" value={plan} />

            {cohort && !cohort.free && currency?.online && currency.bank && (
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2 text-sm font-medium text-ink">Payment method</legend>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Choice name="methodChoice" value="online" checked={method === "online"} onChange={() => setMethod("online")}><span className="font-semibold text-ink">Pay online</span><span className="text-sm text-muted">{gatewayFor(currency.code) === "paystack" ? "Card, bank transfer or USSD via Paystack" : "Secure card payment via Stripe"}</span></Choice>
                  <Choice name="methodChoice" value="bank" checked={method === "bank"} onChange={() => setMethod("bank")}><span className="font-semibold text-ink">Direct bank transfer</span><span className="text-sm text-muted">Confirmed once we receive it</span></Choice>
                </div>
              </fieldset>
            )}
            <input type="hidden" name="method" value={method} />

            {cohort && !cohort.free && method === "online" && (
              <Field label="Discount code" htmlFor={`${id}-discount`}>
                <input id={`${id}-discount`} name="discountCode" maxLength={40} placeholder="Optional" className={`${inputClass} uppercase placeholder:normal-case`} />
              </Field>
            )}

            <div aria-live="polite" className="empty:hidden">
              {!pending && state?.error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {state.error}{state.signIn && <> <Link href={state.signIn} className="font-semibold underline">{state.signIn.startsWith("/login") ? "Sign in" : "Go to my class"}</Link></>}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row">
              <button type="button" onClick={() => setStep(1)} className="flex h-13 cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-edge-strong px-6 font-semibold text-ink hover:bg-page"><ArrowLeft className="size-4" /> Back</button>
              <button type="submit" disabled={pending || !cohort} className="flex h-13 grow cursor-pointer items-center justify-center rounded-[8px] bg-accent text-[16px] font-semibold text-white shadow-[0_12px_28px_-14px_rgba(113,52,217,.9)] transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60">
                {pending ? "Please wait…" : payLabel}
              </button>
            </div>
          </div>
        )}
      </form>

      <aside aria-label="Summary" className="flex flex-col gap-5 rounded-[24px] bg-[#16101f] p-6 text-white shadow-[0_30px_80px_-40px_rgba(0,0,0,.8)] sm:p-8 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl font-bold text-emerald-400">Summary</h2>
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-semibold uppercase tracking-[1.2px] text-white/55">Enrolment details</p>
          <dl className="flex flex-col gap-2.5 rounded-[12px] bg-white/[.06] p-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-white/65">Course</dt><dd className="text-right font-medium">{cohort?.courseTitle ?? (courseId ? courses.find(([cid]) => cid === courseId)?.[1] : "—")}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-white/65">Cohort</dt><dd className="text-right font-medium">{cohort ? cohort.name : "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-white/65">Learning mode</dt><dd className="text-right font-medium">{cohort ? MODE_LABEL[cohort.deliveryMode] : "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-white/65">Payment plan</dt><dd className="text-right font-medium">{cohort?.free ? "Free" : PLAN_LABEL[plan]}</dd></div>
          </dl>
        </div>
        {q && (
          <>
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-semibold uppercase tracking-[1.2px] text-white/55">Total course cost</p>
              <div className="flex flex-col gap-2 rounded-[12px] bg-white/[.06] p-4">
                <div className="flex items-baseline justify-between gap-4"><span className="font-semibold">Total program fee</span><span className="font-display text-xl font-bold">{money(q.total)}</span></div>
                {q.registrationFee > 0 && <p className="text-xs text-white/55">{money(q.tuition)} tuition + {money(q.registrationFee)} registration fee</p>}
              </div>
            </div>
            <div className="flex flex-col gap-2.5 rounded-[12px] border border-emerald-400/30 bg-emerald-400/[.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[1.2px] text-white/55">Amount due now</p>
              <div className="flex justify-between gap-4 text-sm"><span className="text-white/65">Tuition</span><span>{money(q.tuitionNow)}</span></div>
              {q.registrationFee > 0 && <div className="flex justify-between gap-4 text-sm"><span className="text-white/65">+ Registration fee</span><span>{money(q.registrationFee)}</span></div>}
              <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-white/10 pt-3"><span className="font-semibold">Total</span><span className="font-display text-3xl font-bold text-emerald-400">{money(q.dueNow)}</span></div>
              {q.later > 0 && <p className="text-xs text-white/55">{money(q.later)} tuition balance due later.</p>}
              {method === "online" && <p className="text-xs text-white/55">Discount codes are applied at checkout.</p>}
            </div>
          </>
        )}
        {cohort?.free && <p className="rounded-[12px] bg-white/[.06] p-4 font-display text-2xl font-bold text-emerald-400">Free</p>}
        <button type="submit" form={`${id}-form`} disabled={pending || (step === 2 && !cohort)} className="flex h-13 w-full cursor-pointer items-center justify-center rounded-[8px] bg-accent text-[16px] font-semibold text-white transition hover:bg-accent-mid disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? "Please wait…" : step === 1 ? "Continue" : payLabel}
        </button>
      </aside>
    </div>
  );
}
