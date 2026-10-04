"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { Gender } from "@/components/avatar-art";
import { ArrowRight, CheckIcon, ChevronDown } from "@/components/icons";
import { Avatar } from "@/components/ui";

const KEY = "tk-referral-collapsed";
const EVENT = "tk-referral-collapsed";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}
function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function write(value: string | null) {
  try {
    if (value) localStorage.setItem(KEY, value); else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/**
 * A floating card for visitors who came through someone's referral link, so they can see it was tracked.
 * It can be shrunk to a small pill (remembered on this device for this referrer) and opened again.
 */
export function ReferralBadge({ name, avatarUrl, gender, code }: { name: string; avatarUrl: string | null; gender: Gender | null; code: string }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, read, () => null) === code;
  const onSignUp = pathname.startsWith("/register") || pathname.startsWith("/enroll");
  const first = name.split(" ")[0];

  return (
    <div role="status" aria-live="polite" className="referral-badge fixed bottom-3 left-3 right-20 z-40 flex justify-start sm:bottom-6 sm:left-6 sm:right-auto">
      {collapsed ? (
        <button type="button" onClick={() => write(null)} className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-ink py-1 pl-1 pr-4 text-sm font-semibold text-white shadow-[0_18px_40px_-14px_rgba(24,19,64,.65)] transition hover:-translate-y-0.5">
          <span className="overflow-hidden rounded-full ring-2 ring-white/20"><Avatar name={name} src={avatarUrl} gender={gender} size="sm" /></span>
          <span className="truncate">Referred by {name}</span>
          <CheckIcon className="size-4 shrink-0 text-emerald-400" />
        </button>
      ) : (
        <div className="relative w-full max-w-[380px] overflow-hidden rounded-[5px] bg-ink text-white shadow-[0_30px_70px_-24px_rgba(12,11,18,.75)] ring-1 ring-white/10">
          <div aria-hidden="true" className="h-1 bg-[linear-gradient(90deg,#4f3fd7_0%,#4f3fd7_60%,#31c4f0_100%)]" />
          <div className="flex items-start gap-3 p-3.5 pr-10 sm:gap-3.5 sm:p-4 sm:pr-11">
            <span className="relative shrink-0">
              <span className="block overflow-hidden rounded-full ring-2 ring-white/20"><Avatar name={name} src={avatarUrl} gender={gender} size="md" /></span>
              <span className="absolute -bottom-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full bg-emerald-500 ring-2 ring-ink"><CheckIcon className="size-2.5 text-white" /></span>
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[15px] leading-snug">You were referred by <strong className="whitespace-nowrap font-semibold">{name}</strong></p>
              <p className="hidden text-[13px] leading-relaxed text-white/65 sm:block">
                {onSignUp ? `Your referral is saved. Finish here and ${first} gets the credit.` : `Your referral is saved. When you join a course, ${first} gets the credit.`}
              </p>
              {!onSignUp && (
                <Link href="/register" className="group mt-1 inline-flex w-fit items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-[#b9f0ff] hover:text-white sm:mt-1.5">
                  Create your free account <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          </div>
          <button type="button" onClick={() => write(code)} aria-label="Make smaller" className="absolute right-2 top-3 flex size-8 cursor-pointer items-center justify-center rounded-[5px] text-white/60 transition hover:bg-white/10 hover:text-white">
            <ChevronDown className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
