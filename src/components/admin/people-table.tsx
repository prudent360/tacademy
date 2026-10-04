"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { bulkPeople, type BulkAction, type BulkResult } from "@/app/actions/people";
import { AlertIcon, CheckCircleIcon, DownloadIcon, EditIcon, MailIcon, XIcon } from "@/components/icons";
import { Badge, PersonCell } from "@/components/ui";
import type { Gender } from "@/components/avatar-art";

export type PersonRow = {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  gender: Gender | null;
  role: "admin" | "instructor" | "student" | "staff";
  studentId: string | null;
  courses: number;
  status: "deactivated" | "invited" | "invite_failed" | "invite_queued" | "verified" | "unverified";
  country: string | null;
  joined: string;
  lastLogin: string | null;
};

const ROLE_TONE = { admin: "navy", instructor: "cyan", student: "accent", staff: "green" } as const;
const STATUS = {
  deactivated: <Badge tone="red">Deactivated</Badge>,
  invited: <Badge tone="amber">Invitation sent</Badge>,
  invite_failed: <Badge tone="red">Invitation email failed</Badge>,
  invite_queued: <Badge tone="amber">Invitation queued</Badge>,
  verified: <Badge tone="green">Verified</Badge>,
  unverified: <Badge>Email unverified</Badge>,
};

const barButton = "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[5px] border border-white/15 px-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60";

/** Filter dropdowns beside the search box. Changing one reloads the list from page 1. */
export function PeopleFilters({ status, sort, country, countries, statuses, sorts }: {
  status?: string;
  sort?: string;
  country?: string;
  countries: { code: string; label: string }[];
  statuses: readonly { value: string; label: string }[];
  sorts: readonly { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    router.push(next.size ? `${pathname}?${next}` : pathname);
  }
  const select = "h-9 cursor-pointer rounded-lg border border-edge-strong bg-surface px-2.5 text-sm font-medium text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Account status" value={status ?? ""} onChange={(e) => set("status", e.target.value)} className={select}>
        <option value="">Any status</option>
        {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {countries.length > 1 && (
        <select aria-label="Country" value={country ?? ""} onChange={(e) => set("country", e.target.value)} className={select}>
          <option value="">Any country</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
      )}
      <select aria-label="Sort" value={sort ?? "newest"} onChange={(e) => set("sort", e.target.value === "newest" ? "" : e.target.value)} className={select}>
        {sorts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </div>
  );
}

/** The People list with tick boxes and actions for the ticked people (or everyone matching the filters). */
export function PeopleTable({ rows, total, filter, canManage }: { rows: PersonRow[]; total: number; filter: Record<string, string | undefined>; canManage: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<BulkAction | null>(null);
  const confirmDelete = useRef<HTMLDialogElement>(null);

  const pageIds = rows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));
  const count = allMatching ? total : selected.size;
  const chosen = rows.filter((r) => selected.has(r.id));

  function toggle(id: number) {
    setAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function togglePage() {
    setAllMatching(false);
    setSelected(allOnPage ? new Set() : new Set(pageIds));
  }
  function clear() {
    setSelected(new Set());
    setAllMatching(false);
  }
  function run(action: BulkAction) {
    setRunning(action);
    startTransition(async () => {
      const r = await bulkPeople(action, allMatching ? { filter } : { ids: [...selected] });
      setResult(r);
      setRunning(null);
      confirmDelete.current?.close();
      if (!r.error) clear();
      router.refresh();
    });
  }
  const exportHref = `/api/admin/users/export?${new URLSearchParams(allMatching ? Object.entries(filter).filter((e): e is [string, string] => Boolean(e[1])) : [["ids", [...selected].join(",")]])}`;

  return (
    <div className="flex flex-col gap-3">
      {result && (
        <div className={`flex items-start gap-3 rounded-[5px] border px-4 py-3 text-sm ${result.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {result.error ? <AlertIcon className="mt-0.5 size-4 shrink-0" /> : <CheckCircleIcon className="mt-0.5 size-4 shrink-0" />}
          <div className="flex grow flex-col gap-1">
            <p className="font-semibold">{result.error ?? result.ok}</p>
            {result.skipped && result.skipped.length > 0 && (
              <details className="text-[13px]">
                <summary className="cursor-pointer">{result.skipped.length} skipped</summary>
                <ul className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto">{result.skipped.map((s, i) => <li key={i}><strong>{s.name}</strong>: {s.reason}</li>)}</ul>
              </details>
            )}
          </div>
          <button type="button" onClick={() => setResult(null)} aria-label="Dismiss" className="cursor-pointer opacity-60 hover:opacity-100"><XIcon className="size-4" /></button>
        </div>
      )}

      {count > 0 && (
        <div className="sticky top-[72px] z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[5px] bg-ink px-4 py-2.5 text-white shadow-[0_16px_40px_-20px_rgba(24,19,64,.7)]">
          <p className="text-sm"><strong>{count.toLocaleString()}</strong> selected</p>
          {allOnPage && !allMatching && total > rows.length && (
            <button type="button" onClick={() => setAllMatching(true)} className="cursor-pointer text-sm font-semibold text-[#b9f0ff] hover:underline">Select all {total.toLocaleString()} matching</button>
          )}
          <button type="button" onClick={clear} className="cursor-pointer text-sm text-white/70 hover:text-white">Clear</button>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <a href={exportHref} className={barButton}><DownloadIcon className="size-4" /> Export</a>
            {canManage && <>
              <button type="button" disabled={pending} onClick={() => run("invite")} className={barButton}><MailIcon className="size-4" /> {running === "invite" ? "Sending…" : "Resend invitation"}</button>
              <button type="button" disabled={pending} onClick={() => run("reactivate")} className={barButton}>{running === "reactivate" ? "Working…" : "Reactivate"}</button>
              <button type="button" disabled={pending} onClick={() => run("deactivate")} className={barButton}>{running === "deactivate" ? "Working…" : "Deactivate"}</button>
              <button type="button" disabled={pending} onClick={() => confirmDelete.current?.showModal()} className={`${barButton} border-red-400/40 bg-red-500/90 hover:bg-red-500`}>Delete</button>
            </>}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-[5px] border border-edge bg-surface">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-line bg-page text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="w-11 py-3 pl-4"><input type="checkbox" aria-label="Select everyone on this page" checked={allOnPage} ref={(el) => { if (el) el.indeterminate = someOnPage && !allOnPage; }} onChange={togglePage} className="size-4 cursor-pointer accent-accent" /></th>
              <th className="px-3 py-3 font-semibold">Name</th>
              <th className="px-3 py-3 font-semibold">Role</th>
              <th className="px-3 py-3 font-semibold">Courses</th>
              <th className="px-3 py-3 font-semibold">Account</th>
              <th className="px-3 py-3 font-semibold">Joined</th>
              <th className="px-3 py-3 font-semibold">Last signed in</th>
              <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((u) => {
              const on = allMatching || selected.has(u.id);
              return (
                <tr key={u.id} className={on ? "bg-accent-soft/50" : "hover:bg-page/60"}>
                  <td className="py-3 pl-4"><input type="checkbox" aria-label={`Select ${u.name}`} checked={on} onChange={() => toggle(u.id)} className="size-4 cursor-pointer accent-accent" /></td>
                  <td className="max-w-[300px] px-3 py-3"><PersonCell name={u.name} email={u.email} src={u.avatarUrl} gender={u.gender} href={`/admin/users/${u.id}`} /></td>
                  <td className="px-3 py-3"><Badge tone={ROLE_TONE[u.role]} className="capitalize">{u.role === "staff" ? "Team" : u.role}</Badge>{u.studentId && <span className="mt-1 block font-mono text-xs text-muted">{u.studentId}</span>}</td>
                  <td className="px-3 py-3 text-body">{u.courses}</td>
                  <td className="px-3 py-3">{STATUS[u.status]}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">{u.country && <span className="mr-1.5">{u.country}</span>}{u.joined}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">{u.lastLogin ?? "Never"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/users/${u.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-edge-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-page"><EditIcon className="size-4" /> {canManage ? "Edit" : "View"}</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dialog ref={confirmDelete} onClick={(e) => { if (e.target === confirmDelete.current) confirmDelete.current?.close(); }} className="m-auto w-[min(480px,calc(100vw-2rem))] rounded-[5px] bg-surface p-0 shadow-2xl backdrop:bg-[#0c0b12]/60">
        <div className="flex flex-col gap-4 p-6">
          <span className="flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertIcon className="size-5" /></span>
          <h2 className="font-display text-xl font-bold text-ink">Delete {count === 1 && chosen[0] ? chosen[0].name : `${count.toLocaleString()} people`}?</h2>
          <p className="text-sm leading-relaxed text-body">This permanently removes {count === 1 ? "their account" : "their accounts"} with enrolments, attendance, submissions and notifications. It can&apos;t be undone.</p>
          <p className="rounded-[5px] bg-page px-3.5 py-2.5 text-[13px] text-muted">To protect your records, anyone with a payment or a certificate is skipped. Deactivate them instead: they can&apos;t sign in, and their history stays.</p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => confirmDelete.current?.close()} className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-edge-strong px-4 text-sm font-semibold text-ink hover:bg-page">Cancel</button>
            <button type="button" disabled={pending} onClick={() => run("delete")} className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-70">{running === "delete" ? "Deleting…" : "Delete permanently"}</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
