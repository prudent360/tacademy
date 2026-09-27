"use client";

import { useState } from "react";
import { enroll } from "@/app/actions/enroll";
import { ActionForm, SubmitButton } from "@/components/forms";
import { formatMoney } from "@/lib/money";

/** Currency picker and enrol buttons for one cohort. */
export function EnrollForm({ cohortId, prices, preferred, signedIn, bank, depositPercent }: {
  cohortId: number;
  /** Only currencies that can be paid online right now. */
  prices: Record<string, number>;
  preferred: string[];
  signedIn: boolean;
  /** Bank transfer amount when the academy accepts transfers and this cohort has a price in that currency. */
  bank: { currency: string; amount: number } | null;
  depositPercent: number | null;
}) {
  const currencies = Object.keys(prices).filter((c) => prices[c] > 0).sort((a, b) => {
    const ia = preferred.indexOf(a);
    const ib = preferred.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const [currency, setCurrency] = useState(currencies[0] ?? "");
  const [method, setMethod] = useState<"online" | "bank">(currencies.length ? "online" : "bank");
  const [plan, setPlan] = useState<"full" | "deposit">("full");

  if (!currencies.length && !bank) {
    return <p className="text-sm text-muted">Online enrolment isn&apos;t available for this cohort yet. Please contact us to reserve a place.</p>;
  }

  return (
    <ActionForm action={enroll.bind(null, cohortId)} className="flex flex-col gap-3">
      <input type="hidden" name="method" value={method} />
      {method === "online" && currencies.length > 0 && (
        <div className="flex flex-col gap-2">
          {currencies.length > 1 && (
            <div role="radiogroup" aria-label="Pay in" className="flex flex-wrap gap-1.5">
              {currencies.map((c) => (
                <label key={c} className={`flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm font-semibold ${currency === c ? "border-accent bg-accent-soft text-accent" : "border-edge-strong text-body hover:border-accent"}`}>
                  <input type="radio" name="currency" value={c} checked={currency === c} onChange={() => setCurrency(c)} className="sr-only" />
                  {c}
                </label>
              ))}
            </div>
          )}
          {currencies.length === 1 && <input type="hidden" name="currency" value={currency} />}
          {depositPercent && <div className="grid grid-cols-2 gap-2 rounded-[5px] bg-panel p-1">
            {(["full", "deposit"] as const).map((value) => <label key={value} className={`cursor-pointer rounded-[5px] px-3 py-2 text-center text-sm font-semibold transition ${plan === value ? "bg-white text-accent shadow-sm" : "text-muted hover:text-ink"}`}><input className="sr-only" type="radio" name="paymentPlan" value={value} checked={plan === value} onChange={() => setPlan(value)} />{value === "full" ? "Pay in full" : `${depositPercent}% deposit`}</label>)}
          </div>}
          {!depositPercent && <input type="hidden" name="paymentPlan" value="full" />}
          <p className="font-display text-3xl font-bold tracking-tight text-ink">{formatMoney(plan === "deposit" && depositPercent ? Math.round(prices[currency] * depositPercent / 100) : prices[currency], currency)}</p>
          {plan === "deposit" && <p className="text-[13px] font-medium text-amber-800">This reserves your place. The remaining balance is due before the cohort starts.</p>}
          <p className="text-[13px] text-muted">{["NGN", "GHS", "KES", "ZAR"].includes(currency) ? "Secure payment with Paystack: card, bank transfer or USSD." : "Secure card payment with Stripe."}</p>
          <label className="mt-1 flex flex-col gap-1 text-sm font-semibold text-ink">Discount code <input name="discountCode" placeholder="Optional" className="h-10 rounded-[5px] border border-edge-strong px-3 font-normal uppercase outline-none focus:border-accent focus:ring-2 focus:ring-accent/10" /></label>
        </div>
      )}
      {method === "bank" && bank && (
        <div className="flex flex-col gap-1">
          <p className="font-display text-3xl font-bold tracking-tight text-ink">{formatMoney(bank.amount, bank.currency)}</p>
          <p className="text-[13px] text-muted">You&apos;ll get our account details and a payment reference. Your place is confirmed once the transfer arrives.</p>
        </div>
      )}
      <SubmitButton pendingText={method === "bank" ? "Preparing details…" : "Opening checkout…"}>
        {!signedIn ? "Sign in to enrol" : method === "bank" ? "Get bank transfer details" : "Enrol and pay"}
      </SubmitButton>
      {bank && currencies.length > 0 && (
        <button type="button" onClick={() => setMethod(method === "bank" ? "online" : "bank")} className="w-fit cursor-pointer text-sm font-semibold text-accent hover:text-accent-dark">
          {method === "bank" ? "Pay online instead" : `Pay by bank transfer (${formatMoney(bank.amount, bank.currency)})`}
        </button>
      )}
    </ActionForm>
  );
}
