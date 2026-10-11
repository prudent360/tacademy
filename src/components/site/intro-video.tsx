"use client";

import { useRef, useState } from "react";
import { PlayIcon, XIcon } from "@/components/icons";
import type { VideoProvider } from "@/lib/video";

/** Each player's own way of saying "start playing", since the visitor just clicked play. */
function withAutoplay(url: string, provider: VideoProvider): string {
  const u = new URL(url);
  u.searchParams.set("autoplay", provider === "bunny" ? "true" : "1");
  return u.toString();
}

/**
 * Opens a course's intro video in a large pop-up. With children (the cover image), a play button sits over them;
 * without, it's a hero button. The player only loads when opened, and closing the pop-up stops it.
 */
export function IntroVideo({ embedUrl, provider, title, className, children }: { embedUrl: string; provider: VideoProvider; title: string; className?: string; children?: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const show = () => { setOpen(true); dialog.current?.showModal(); };
  const close = () => dialog.current?.close();

  return (
    <>
      {children ? (
        <button type="button" onClick={show} aria-label={`Watch the introduction to ${title}`} className="group relative block w-full cursor-pointer">
          {children}
          <span className="absolute inset-0 flex items-center justify-center bg-navy/25 transition group-hover:bg-navy/35">
            <span className="flex items-center gap-2.5 rounded-full bg-white py-2.5 pl-2.5 pr-5 text-[15px] font-semibold text-ink shadow-[0_18px_40px_-12px_rgba(0,0,0,.55)] transition group-hover:scale-105">
              <span className="flex size-9 items-center justify-center rounded-full bg-accent text-white"><PlayIcon className="size-5" /></span>
              Watch intro
            </span>
          </span>
        </button>
      ) : (
        <button type="button" onClick={show} className={className}><PlayIcon className="size-5" /> Watch intro</button>
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
            {open && <iframe src={withAutoplay(embedUrl, provider)} title={`Introduction: ${title}`} className="absolute inset-0 size-full border-0" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />}
          </div>
        </div>
      </dialog>
    </>
  );
}
