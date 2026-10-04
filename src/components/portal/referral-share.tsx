"use client";

import { useState } from "react";
import { CheckIcon, LinkIcon, MailIcon } from "@/components/icons";

async function copy(text: string, done: () => void) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older browsers: select-and-copy fallback.
    const area = Object.assign(document.createElement("textarea"), { value: text });
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  done();
}

/** The big link box with copy and share buttons, on the purple Refer & earn card. */
export function ReferralShare({ link, message }: { link: string; message: string }) {
  const [copied, setCopied] = useState(false);
  const text = `${message} ${link}`;
  const share = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(text)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}` },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex h-12 min-w-0 grow items-center gap-2.5 rounded-[5px] bg-white/[.12] px-3.5 ring-1 ring-white/20">
          <LinkIcon className="size-4 shrink-0 text-[#b9f0ff]" />
          <input readOnly value={link} aria-label="Your referral link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 grow bg-transparent font-mono text-[14px] text-white outline-none" />
        </div>
        <button type="button" onClick={() => copy(link, () => { setCopied(true); setTimeout(() => setCopied(false), 2200); })} className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[5px] bg-white px-5 text-[15px] font-semibold text-ink transition hover:bg-[#f1efff]">
          {copied ? <><CheckIcon className="size-4 text-emerald-600" /> Copied</> : "Copy link"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-white/70">Share on</span>
        {share.map((s) => (
          <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-full bg-white/[.1] px-3 text-[13px] font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20">{s.label}</a>
        ))}
        <a href={`mailto:?subject=${encodeURIComponent("Thought you'd like this")}&body=${encodeURIComponent(text)}`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[.1] px-3 text-[13px] font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20"><MailIcon className="size-3.5" /> Email</a>
      </div>
    </div>
  );
}

/** A small "Copy link" button for one course's referral link. */
export function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => copy(link, () => { setCopied(true); setTimeout(() => setCopied(false), 2000); })} className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[5px] border border-edge-strong bg-surface px-3 text-sm font-semibold text-ink transition hover:border-accent-muted hover:bg-page">
      {copied ? <><CheckIcon className="size-4 text-emerald-600" /> Copied</> : <><LinkIcon className="size-4" /> Copy link</>}
    </button>
  );
}

/** Bank details or another payout method; the bank fields hide when "Another way" is chosen. */
export function PayoutMethod({ initial, children, other }: { initial: "bank" | "other"; children: React.ReactNode; other: React.ReactNode }) {
  const [method, setMethod] = useState(initial);
  return (
    <>
      <div className="flex gap-2">
        {(["bank", "other"] as const).map((m) => (
          <label key={m} className="flex h-10 cursor-pointer items-center rounded-[5px] border border-edge-strong px-4 text-sm font-semibold text-body has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
            <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />{m === "bank" ? "Bank transfer" : "Another way"}
          </label>
        ))}
      </div>
      <div className={method === "bank" ? "contents" : "hidden"}>{children}</div>
      <div className={method === "other" ? "contents" : "hidden"}>{other}</div>
    </>
  );
}
