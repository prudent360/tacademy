"use client";

import { useEffect, useRef } from "react";
import { dismissAnnouncement } from "@/app/actions/account";
import { ExternalIcon, MegaphoneIcon, XIcon } from "@/components/icons";

/** Turns web addresses in plain text into links, e.g. "learn.tekskillup.com" or "https://…". */
function linkify(text: string): React.ReactNode[] {
  return text.split(/((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi).map((part, i) => {
    if (i % 2 === 0) return part;
    const clean = part.replace(/[.,;:!?)]+$/, "");
    const rest = part.slice(clean.length);
    return <span key={i}><a href={/^https?:\/\//i.test(clean) ? clean : `https://${clean}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink underline decoration-accent/30 underline-offset-2 hover:decoration-accent">{clean}</a>{rest}</span>;
  });
}

/**
 * The admin's dashboard pop-up (Settings › Dashboard pop-up). Opens once; closing it, or following its button,
 * remembers this version on the account so it doesn't come back on any device until the message changes.
 */
export function AnnouncementModal({ title, body, buttonLabel, buttonUrl, version }: { title: string; body: string; buttonLabel: string; buttonUrl: string; version: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dismissed = useRef(false);

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  function dismiss() {
    if (dismissed.current) return;
    dismissed.current = true;
    void dismissAnnouncement(version);
  }
  function close() {
    dismiss();
    dialog.current?.close();
  }
  const external = /^https?:\/\//i.test(buttonUrl);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="announcement-title"
      onClose={dismiss}
      onClick={(e) => { if (e.target === dialog.current) close(); }}
      className="m-auto w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-[5px] bg-surface p-0 text-left shadow-[0_40px_120px_-30px_rgba(12,11,18,.6)] backdrop:bg-[#0c0b12]/60 backdrop:backdrop-blur-[3px]"
    >
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#5b4be0_0%,#4f3fd7_45%,#3d2fb8_100%)] px-6 pb-6 pt-7 text-white sm:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-10 size-48 rounded-full bg-white/[.06]" />
        <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 flex size-9 cursor-pointer items-center justify-center rounded-[5px] text-white/70 transition hover:bg-white/10 hover:text-white"><XIcon className="size-5" /></button>
        <span className="relative flex size-11 items-center justify-center rounded-[5px] bg-white/[.14]"><MegaphoneIcon className="size-5 text-[#b9f0ff]" /></span>
        <h2 id="announcement-title" className="relative mt-4 pr-6 font-display text-[24px] font-bold leading-tight tracking-[-0.4px]">{title}</h2>
      </div>
      <div className="flex flex-col gap-6 px-6 py-6 sm:px-8">
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-body">{linkify(body)}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} className="inline-flex h-11 cursor-pointer items-center justify-center rounded-[5px] border border-edge-strong px-5 text-[15px] font-semibold text-ink transition hover:bg-page">{buttonUrl ? "Close" : "Got it"}</button>
          {buttonUrl && (
            <a href={buttonUrl} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} onClick={close} className="inline-flex h-11 items-center justify-center gap-2 rounded-[5px] bg-accent px-5 text-[15px] font-semibold text-white transition hover:bg-accent-dark">
              {buttonLabel} {external && <ExternalIcon className="size-4" />}
            </a>
          )}
        </div>
      </div>
    </dialog>
  );
}
