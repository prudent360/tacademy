"use client";

import { useRef, useState } from "react";
import { PlayIcon, XIcon } from "@/components/icons";

/**
 * Opens a course's intro video in a large pop-up. With children (the cover image), they get a play button and
 * a "Preview this course" caption; without, it's a hero button. The player only loads when opened and waits for the visitor to press play; closing
 * the pop-up stops it.
 */
export function IntroVideo({ embedUrl, title, label = "Preview this course", className, children }: { embedUrl: string; title: string; label?: string; className?: string; children?: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const show = () => { setOpen(true); dialog.current?.showModal(); };
  const close = () => dialog.current?.close();

  return (
    <>
      {children ? (
        <button type="button" onClick={show} aria-label={`Watch the introduction to ${title}`} className="group relative block w-full cursor-pointer">
          {children}
          <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10 transition group-hover:from-black/85 group-hover:via-black/35" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-white text-ink shadow-[0_12px_30px_-8px_rgba(0,0,0,.6)] transition group-hover:scale-110 sm:size-20">
              <svg viewBox="0 0 24 24" className="ml-1 size-7 sm:size-8" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" /></svg>
            </span>
          </span>
          <span className="absolute inset-x-0 bottom-0 pb-4 text-center text-base font-bold text-white drop-shadow sm:pb-5 sm:text-lg">{label}</span>
        </button>
      ) : (
        <button type="button" onClick={show} className={className}><PlayIcon className="size-5" /> {label}</button>
      )}
      <dialog
        ref={dialog}
        aria-label={`Introduction: ${title}`}
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === dialog.current) close(); }}
        className="m-auto w-[min(1000px,calc(100vw-2rem))] overflow-visible bg-transparent p-0 backdrop:bg-navy/80 backdrop:backdrop-blur-sm"
      >
        <div className="relative">
          <button type="button" onClick={close} aria-label="Close video" className="absolute -top-12 right-0 flex size-10 cursor-pointer items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white">
            <XIcon className="size-6" />
          </button>
          <div className="relative aspect-video w-full overflow-hidden rounded-[5px] bg-black shadow-2xl">
            {open && <iframe src={embedUrl} title={`Introduction: ${title}`} className="absolute inset-0 size-full border-0" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />}
          </div>
        </div>
      </dialog>
    </>
  );
}
