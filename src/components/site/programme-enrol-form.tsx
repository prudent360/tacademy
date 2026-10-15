"use client";

import { startTransition, useActionState, useId, useRef, useState } from "react";
import Link from "next/link";
import { enrolProgramme, type EnrolState } from "@/app/actions/enroll";
import { ArrowLeft } from "@/components/icons";
import type { DeliveryMode, PriceMap } from "@/db/schema";
import { COUNTRIES, countryByCode, countryInSentence, currencyForCountry, flag } from "@/lib/countries";
import { currencyInfo, formatMoney } from "@/lib/money";
import { programmeQuote, type ProgrammePlan } from "@/lib/programme-pricing";
import { MODE_LABEL } from "@/lib/utils";
import { Choice, DiscountField, METHOD_LABEL, ONLINE_LABEL, StudentDetails, type Method, type OnlineProvider, type Prefill } from "./enrol-form";

export type ProgrammeCheckout = {
  id: number;
  slug: string;
  title: string;
  duration: string;
  prices: PriceMap;
  instalmentCount: number | null;
  instalmentFirstPercent: number | null;
  /** The courses in order: one booked now, the rest claimed later, and any the student has already taken. */
  courses: { title: string; status: "now" | "later" | "completed" | "booked" }[];
  /** Open cohorts of the course booked now. */
  cohorts: { id: number; name: string; dates: string; deliveryMode: DeliveryMode }[];
  /** Currencies the fee can be paid in, and how. */
  currencies: { code: string; online: boolean; provider?: OnlineProvider; bank: boolean }[];
};

/** Programme checkout: the student's details, then a start date for the first course and how to pay the fee. */
export function ProgrammeEnrolForm({ programme, preferred, whatsapp = false, signedIn, defaultCountry }: {
  programme: ProgrammeCheckout;
  preferred: string[];
  whatsapp?: boolean;
  signedIn: Prefill | null;
  defaultCountry?: string;
}) {
  const id = useId();
  const top = useRef<HTMLDivElement>(null);
  const [state, formAction, pending] = useActionState<EnrolState, FormData>(enrolProgramme, undefined);
  const [step, setStep] = useState<1 | 2>(1);
  const now = programme.courses.find((c) => c.status === "now")?.title ?? "";
  const later = programme.courses.filter((c) => c.status === "later").map((c) => c.title);
  const credited = programme.courses.filter((c) => c.status === "completed" || c.status === "booked").map((c) => c.title);
  const [cohortId, setCohortId] = useState<number | null>(programme.cohorts.length === 1 ? programme.cohorts[0].id : null);
  const cohort = programme.cohorts.find((c) => c.id === cohortId) ?? null;

  const phoneCountryFromProfile = signedIn?.dial ? COUNTRIES.find((c) => c.dial === signedIn.dial)?.code : undefined;
  const [country, setCountryCode] = useState(countryByCode(signedIn?.country)?.code ?? countryByCode(defaultCountry)?.code ?? phoneCountryFromProfile ?? "");
  const [phoneCountry, setPhoneCountry] = useState(phoneCountryFromProfile ?? (country || "GB"));
  const [showCurrencies, setShowCurrencies] = useState(false);
  const local = currencyForCountry(country);
  const order = [local, "USD", ...preferred].filter(Boolean) as string[];
  const rank = (code: string) => { const i = order.indexOf(code); return i === -1 ? 99 : i; };
  const currencies = [...programme.currencies].sort((a, b) => rank(a.code) - rank(b.code));
  const [currencyChoice, setCurrency] = useState("");
  const currency = currencies.find((c) => c.code === currencyChoice) ?? currencies[0];
  const [planChoice, setPlan] = useState<ProgrammePlan>("full");
  const canSplit = Boolean(currency && (programmeQuote(programme, currency.code, "instalments")?.count ?? 1) > 1);
  const plan: ProgrammePlan = canSplit ? planChoice : "full";
  const [methodChoice, setMethod] = useState<Method>("online");
  const methods: Method[] = currency ? (["online", "bank"] as const).filter((m) => currency[m]) : [];
  const method = methods.includes(methodChoice) ? methodChoice : methods[0] ?? "online";
  const [discount, setDiscount] = useState<{ code: string; percentOff: number } | null>(null);
  const countryName = countryInSentence(country);

  const q = currency ? programmeQuote(programme, currency.code, plan, discount?.percentOff ?? 0) : null;
  const money = (minor: number) => (currency ? formatMoney(minor, currency.code) : "—");
  const saving = q ? q.fee - q.total : 0;
  const split = currency && canSplit ? programmeQuote(programme, currency.code, "instalments", discount?.percentOff ?? 0) : null;

  function chooseCountry(code: string) {
    setCountryCode(code);
    if (countryByCode(code)) setPhoneCountry(code);
    setCurrency("");
    setShowCurrencies(false);
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

  const payLabel = !cohort ? "Choose a start date" : method === "bank" ? `Get transfer details · ${money(q?.first ?? 0)}` : `Pay ${money(q?.first ?? 0)}`;

  return (
    <div ref={top} className="grid scroll-mt-24 items-start gap-6 lg:grid-cols-[1.45fr_1fr]">
      <form id={`${id}-form`} onSubmit={onSubmit} aria-busy={pending} className="rounded-[24px] bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,.6)] sm:p-10">
        <input type="hidden" name="programmeId" value={programme.id} />
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <ol className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[1px]" aria-label="Progress">
            <li className={step === 1 ? "text-accent" : "text-muted"} aria-current={step === 1 ? "step" : undefined}>1. Your details</li>
            <li aria-hidden="true" className="h-px w-8 bg-edge-strong" />
            <li className={step === 2 ? "text-accent" : "text-muted"} aria-current={step === 2 ? "step" : undefined}>2. Start date &amp; payment</li>
          </ol>
          <h2 className="font-display text-2xl font-bold tracking-tight text-accent sm:text-[30px]">{step === 1 ? "Join the programme" : "Choose how to start"}</h2>
        </div>

        {/* Step 1 stays mounted while hidden so its values are submitted with step 2. */}
        <div className={step === 1 ? "flex flex-col gap-6" : "hidden"}>
          <StudentDetails id={id} signedIn={signedIn} country={country} onCountry={chooseCountry} phoneCountry={phoneCountry} onPhoneCountry={setPhoneCountry} whatsapp={whatsapp} next={`/programmes/${programme.slug}/enrol`} />
          <div className="border-t border-line pt-6">
            <button type="submit" className="flex h-13 w-full cursor-pointer items-center justify-center rounded-[8px] bg-accent text-[16px] font-semibold text-white shadow-[0_12px_28px_-14px_rgba(79,63,215,.9)] transition hover:bg-accent-dark">Next</button>
          </div>
        </div>

        {step === 2 && (
          <div className="flex flex-col gap-7">
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2 text-sm font-medium text-ink">When do you want to start {now}?<span className="text-red-600" aria-hidden="true"> *</span></legend>
              {programme.cohorts.map((c) => (
                <Choice key={c.id} name="cohortChoice" value={String(c.id)} checked={cohortId === c.id} onChange={() => setCohortId(c.id)}>
                  <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-ink">{c.name}</span><span className="rounded-full bg-page px-2.5 py-0.5 text-xs font-semibold text-body">{MODE_LABEL[c.deliveryMode]}</span></span>
                  <span className="text-sm text-muted">{c.dates}</span>
                </Choice>
              ))}
              {credited.length > 0 && <p className="text-[13px] text-emerald-800">{credited.join(", ")} already count{credited.length === 1 ? "s" : ""} towards this programme.</p>}
              {later.length > 0 && <p className="text-[13px] text-muted">You&apos;ll choose dates for {later.join(", ")} from your dashboard when you&apos;re ready, at no extra cost.</p>}
            </fieldset>
            {cohort && <input type="hidden" name="cohortId" value={cohort.id} />}

            {currency && (
              <div className="flex flex-col gap-2 rounded-[8px] border border-edge bg-panel px-4 py-3.5 text-sm">
                <p className="text-body">
                  {countryName && <span aria-hidden="true" className="mr-1.5">{flag(country)}</span>}
                  {currency.code === local
                    ? <>You&apos;re paying in <strong className="text-ink">{currencyInfo(currency.code)?.name ?? currency.code} ({currency.code})</strong> because you live in {countryName}.</>
                    : <>You&apos;ll pay in <strong className="text-ink">{currencyInfo(currency.code)?.name ?? currency.code} ({currency.code})</strong>.</>}
                </p>
                <p className="text-muted">Ways to pay: {methods.map((m) => METHOD_LABEL(m, currency.provider)).join(" · ")}</p>
                <p className="flex flex-wrap gap-x-4 gap-y-1">
                  <button type="button" onClick={() => setStep(1)} className="cursor-pointer font-semibold text-accent hover:text-accent-dark">Change country</button>
                  {currencies.length > 1 && <button type="button" onClick={() => setShowCurrencies(!showCurrencies)} aria-expanded={showCurrencies} className="cursor-pointer font-semibold text-accent hover:text-accent-dark">{showCurrencies ? "Keep this currency" : "Pay in a different currency"}</button>}
                </p>
                {showCurrencies && (
                  <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                    {currencies.map((c) => (
                      <label key={c.code} className={`flex h-10 cursor-pointer items-center rounded-[8px] border bg-white px-4 text-sm font-semibold ${currency.code === c.code ? "border-accent bg-accent-soft text-accent" : "border-edge-strong text-body hover:border-accent"}`}>
                        <input type="radio" name="currencyChoice" value={c.code} checked={currency.code === c.code} onChange={() => setCurrency(c.code)} className="sr-only" />{c.code}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            {currency && <input type="hidden" name="currency" value={currency.code} />}

            {currency && canSplit && (
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2 text-sm font-medium text-ink">Payment plan</legend>
                {(["full", "instalments"] as const).map((p) => {
                  const pq = programmeQuote(programme, currency.code, p, discount?.percentOff ?? 0)!;
                  return (
                    <Choice key={p} name="planChoice" value={p} checked={plan === p} onChange={() => setPlan(p)}>
                      <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-ink">{p === "full" ? "Pay in full" : `Pay in ${pq.count} monthly instalments`}</span><span className="font-semibold text-ink">{money(pq.first)} now</span></span>
                      <span className="text-sm text-muted">{p === "full" ? "Everything settled today." : `Then ${pq.count - 1} monthly payment${pq.count === 2 ? "" : "s"} of ${money(pq.rest)}, paid from your dashboard.`}</span>
                    </Choice>
                  );
                })}
              </fieldset>
            )}
            <input type="hidden" name="plan" value={plan} />

            {currency && methods.length > 1 && (
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2 text-sm font-medium text-ink">Payment method</legend>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {currency.online && <Choice name="methodChoice" value="online" checked={method === "online"} onChange={() => setMethod("online")}><span className="font-semibold text-ink">Pay online</span><span className="text-sm text-muted">{currency.provider ? ONLINE_LABEL[currency.provider].long : "Secure online payment"}</span></Choice>}
                  {currency.bank && <Choice name="methodChoice" value="bank" checked={method === "bank"} onChange={() => setMethod("bank")}><span className="font-semibold text-ink">Direct bank transfer</span><span className="text-sm text-muted">Confirmed once we receive it</span></Choice>}
                </div>
              </fieldset>
            )}
            <input type="hidden" name="method" value={method} />

            <DiscountField id={id} initial={null} onChange={setDiscount} />

            <div aria-live="polite" className="empty:hidden">
              {!pending && state?.error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {state.error}{state.signIn && <> <Link href={state.signIn} className="font-semibold underline">{state.signIn.startsWith("/login") ? "Sign in" : "Open my programme"}</Link></>}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row">
              <button type="button" onClick={() => setStep(1)} className="flex h-13 cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-edge-strong px-6 font-semibold text-ink hover:bg-page"><ArrowLeft className="size-4" /> Back</button>
              <button type="submit" disabled={pending || !cohort} className="flex h-13 grow cursor-pointer items-center justify-center rounded-[8px] bg-accent text-[16px] font-semibold text-white shadow-[0_12px_28px_-14px_rgba(79,63,215,.9)] transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60">
                {pending ? "Please wait…" : payLabel}
              </button>
            </div>
          </div>
        )}
      </form>

      <aside aria-label="Summary" className="flex flex-col gap-5 rounded-[24px] bg-[#12101f] p-6 text-white shadow-[0_30px_80px_-40px_rgba(0,0,0,.8)] sm:p-8 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl font-bold text-emerald-400">Summary</h2>
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-semibold uppercase tracking-[1.2px] text-white/55">{programme.title}</p>
          <ol className="flex flex-col gap-2 rounded-[12px] bg-white/[.06] p-4 text-sm">
            {programme.courses.map(({ title, status }, i) => (
              <li key={title} className="flex justify-between gap-4">
                <span className="flex gap-2"><span className="font-mono text-xs leading-5 text-white/45">{String(i + 1).padStart(2, "0")}</span>{title}</span>
                <span className={`shrink-0 text-right ${status === "completed" || status === "booked" ? "text-emerald-300" : "text-white/65"}`}>{status === "now" ? cohort?.name ?? "Choose a date" : status === "completed" ? "Completed" : status === "booked" ? "Already booked" : "Choose later"}</span>
              </li>
            ))}
            <li className="mt-1 flex justify-between gap-4 border-t border-white/10 pt-2"><span className="text-white/65">Duration</span><span>{programme.duration}</span></li>
          </ol>
        </div>
        {q && (
          <>
            <div className="flex flex-col gap-2 rounded-[12px] bg-white/[.06] p-4">
              <div className="flex items-baseline justify-between gap-4"><span className="font-semibold">Programme fee</span><span className="flex items-baseline gap-2">{saving > 0 && <span className="text-sm text-white/45 line-through">{money(q.fee)}</span>}<span className="font-display text-xl font-bold">{money(q.total)}</span></span></div>
              {saving > 0 && <p className="text-xs text-emerald-300">{discount?.code}: {discount?.percentOff}% off (−{money(saving)})</p>}
            </div>
            {step === 1 ? (
              // Nothing is chosen yet on the details step, so show the options rather than a total.
              <div className="flex flex-col gap-2.5 rounded-[12px] border border-emerald-400/30 bg-emerald-400/[.04] p-4">
                <p className="text-xs font-semibold uppercase tracking-[1.2px] text-white/55">Ways to pay</p>
                <div className="flex items-baseline justify-between gap-4 text-sm"><span>Pay in full</span><span className="font-semibold">{money(q.total)}</span></div>
                {split && <div className="flex items-baseline justify-between gap-4 text-sm"><span>Or {split.count} monthly payments</span><span className="text-right font-semibold">{split.first === split.rest ? `${split.count} × ${money(split.rest)}` : `${money(split.first)} now, then ${split.count - 1} × ${money(split.rest)}`}</span></div>}
                <p className="text-xs text-white/55">{split ? "Choose your payment plan and add a discount code" : "You can add a discount code"} in the next step.</p>
              </div>
            ) : (
            <div className="flex flex-col gap-2.5 rounded-[12px] border border-emerald-400/30 bg-emerald-400/[.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[1.2px] text-white/55">Amount due now</p>
              <div className="flex items-baseline justify-between gap-4"><span className="font-semibold">{q.count > 1 ? `Instalment 1 of ${q.count}` : "Total"}</span><span className="font-display text-3xl font-bold text-emerald-400">{money(q.first)}</span></div>
              {q.count > 1 && <p className="text-xs text-white/55">Then {q.count - 1} × {money(q.rest)}, one a month from your dashboard.</p>}
            </div>
            )}
          </>
        )}
        <button type="submit" form={`${id}-form`} disabled={pending || (step === 2 && !cohort)} className="flex h-13 w-full cursor-pointer items-center justify-center rounded-[8px] bg-accent text-[16px] font-semibold text-white transition hover:bg-accent-mid disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? "Please wait…" : step === 1 ? "Continue" : payLabel}
        </button>
      </aside>
    </div>
  );
}
