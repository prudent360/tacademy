"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { importStudents, previewImport, type ImportResult, type PreviewRow, type PreviewStatus } from "@/app/actions/import";
import { AlertIcon, CheckCircleIcon, DownloadIcon, FileIcon, UsersIcon, XIcon } from "@/components/icons";
import { Badge, buttonClass } from "@/components/ui";
import { countryByCode, flag } from "@/lib/countries";
import { IMPORT_MAX_ROWS, IMPORT_TEMPLATE } from "@/lib/student-import";

const STATUS: Record<PreviewStatus, { label: string; count: (n: number) => string; tone: "accent" | "green" | "neutral" | "red" }> = {
  new: { label: "New account", count: (n) => `${n} new account${n === 1 ? "" : "s"}`, tone: "accent" },
  existing: { label: "Existing student", count: (n) => `${n} existing student${n === 1 ? "" : "s"}`, tone: "green" },
  enrolled: { label: "Already enrolled", count: (n) => `${n} already enrolled`, tone: "neutral" },
  skip: { label: "Won't import", count: (n) => `${n} won't import`, tone: "red" },
};

const card = "flex flex-col gap-5 rounded-[5px] border border-edge bg-surface p-5 sm:p-6";

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={card}>
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-bold text-accent">{n}</span>
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function csvCell(value: string | number) {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

/** Upload a CSV, check it, choose a cohort and emails, then import. */
export function StudentImport({ cohorts, defaultCohort }: { cohorts: { id: number; label: string }[]; defaultCohort: number | null }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [cohortId, setCohortId] = useState<number | null>(defaultCohort);
  const [emailStudents, setEmailStudents] = useState(true);
  const [preview, setPreview] = useState<{ rows?: PreviewRow[]; error?: string } | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [checking, startChecking] = useTransition();
  const [importing, startImport] = useTransition();

  function check(text: string, cohort: number | null) {
    startChecking(async () => setPreview(await previewImport(text, cohort)));
  }

  async function choose(f: File | undefined) {
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name) && f.type !== "text/csv") {
      setFile(null);
      setPreview({ error: "Choose a .csv file. In Excel or Google Sheets, use File › Save as (or Download) › CSV." });
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setPreview({ error: "That file is over 2 MB. Split it into smaller files." });
      return;
    }
    const text = await f.text();
    setFile({ name: f.name, text });
    setResult(null);
    check(text, cohortId);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setOnlyProblems(false);
    if (input.current) input.current.value = "";
  }

  const rows = preview?.rows ?? [];
  const counts = { new: 0, existing: 0, enrolled: 0, skip: 0 } as Record<PreviewStatus, number>;
  for (const r of rows) counts[r.status]++;
  const importable = counts.new + counts.existing + (cohortId ? 0 : counts.enrolled);
  const shown = onlyProblems ? rows.filter((r) => r.status === "skip") : rows;
  const cohortLabel = cohorts.find((c) => c.id === cohortId)?.label;

  if (result && !result.error) {
    return (
      <section className={`${card} items-start`}>
        <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircleIcon className="size-7" /></span>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-2xl font-bold text-ink">Import complete</h2>
          <p className="text-[15px] text-body">
            <strong>{result.created}</strong> new account{result.created === 1 ? "" : "s"} created
            {cohortLabel ? <>, <strong>{result.enrolled}</strong> enrolled on {cohortLabel}</> : null}
            {result.updated ? <>, {result.updated} existing profile{result.updated === 1 ? "" : "s"} filled in</> : null}.
          </p>
          <p className="text-sm text-muted">
            {result.emailed
              ? cohortLabel ? "New students were emailed a link to set their password, and everyone enrolled got a confirmation." : "New students were emailed a link to set their password."
              : "No emails were sent. New students can use “Forgot password” on the sign-in page, or you can resend their invitation from their profile."}
          </p>
        </div>
        {result.skipped && result.skipped.length > 0 && (
          <div className="flex w-full flex-col gap-3 rounded-[5px] border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><AlertIcon className="size-4" /> {result.skipped.length} row{result.skipped.length === 1 ? " wasn't" : "s weren't"} imported</p>
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm text-amber-900">
              {result.skipped.map((s) => <li key={s.line}>Row {s.line}{s.email ? ` (${s.email})` : ""}: {s.reason}</li>)}
            </ul>
            <button type="button" onClick={() => download("not-imported.csv", ["row,email,reason", ...result.skipped!.map((s) => [s.line, s.email, s.reason].map(csvCell).join(","))].join("\r\n"))} className={`${buttonClass.small} w-fit cursor-pointer`}>
              <DownloadIcon className="size-4" /> Download these rows
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/users?role=student" className={buttonClass.primary}><UsersIcon className="size-4" /> View students</Link>
          <button type="button" onClick={reset} className={`${buttonClass.secondary} cursor-pointer`}>Import another file</button>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Step n={1} title="Upload your spreadsheet" hint={`A CSV file with a header row. Up to ${IMPORT_MAX_ROWS.toLocaleString()} students at a time.`}>
          {file ? (
            <div className="flex items-center gap-3 rounded-[5px] border border-edge bg-page px-4 py-3">
              <FileIcon className="size-5 shrink-0 text-accent" />
              <div className="min-w-0 grow">
                <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
                <p className="text-xs text-muted">{checking ? "Checking…" : preview?.rows ? `${rows.length} row${rows.length === 1 ? "" : "s"}` : ""}</p>
              </div>
              <button type="button" onClick={reset} aria-label="Remove file" className="flex size-8 cursor-pointer items-center justify-center rounded-[5px] text-muted hover:bg-surface hover:text-ink"><XIcon className="size-4" /></button>
            </div>
          ) : (
            <label
              htmlFor={`${id}-file`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files[0]); }}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-[5px] border-2 border-dashed px-6 py-10 text-center transition ${dragging ? "border-accent bg-accent-soft" : "border-edge-strong hover:border-accent-muted hover:bg-page"}`}
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent"><DownloadIcon className="size-5 rotate-180" /></span>
              <span className="text-[15px] font-semibold text-ink">Drop your CSV here, or <span className="text-accent">choose a file</span></span>
              <span className="text-sm text-muted">From Excel or Google Sheets: File › Save as (or Download) › CSV</span>
            </label>
          )}
          <input ref={input} id={`${id}-file`} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
          {preview?.error && <p className="flex items-start gap-2 rounded-[5px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertIcon className="mt-0.5 size-4 shrink-0" />{preview.error}</p>}
        </Step>

        {rows.length > 0 && (
          <Step n={2} title="Check the students" hint="Nothing is saved until you press Import.">
            <div className="flex flex-wrap gap-2">
              {(["new", "existing", "enrolled", "skip"] as const).filter((s) => counts[s] > 0).map((s) => (
                <Badge key={s} tone={STATUS[s].tone}>{STATUS[s].count(counts[s])}</Badge>
              ))}
              {counts.skip > 0 && (
                <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-body">
                  <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} className="size-4 accent-accent" /> Only show problems
                </label>
              )}
            </div>
            <div className="max-h-[460px] overflow-auto rounded-[5px] border border-edge">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-page text-xs uppercase tracking-wide text-muted">
                  <tr><th className="w-12 px-3 py-2.5 font-semibold">Row</th><th className="px-3 py-2.5 font-semibold">Student</th><th className="px-3 py-2.5 font-semibold">Details</th><th className="w-[30%] px-3 py-2.5 font-semibold">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((r) => (
                    <tr key={r.line} className={r.status === "skip" ? "bg-red-50/50" : ""}>
                      <td className="px-3 py-3 align-top font-mono text-xs text-muted">{r.line}</td>
                      <td className="px-3 py-3 align-top">
                        <p className="font-semibold text-ink">{r.name || <span className="font-normal text-muted">No name</span>}</p>
                        <p className="break-all text-[13px] text-muted">{r.email || "No email"}</p>
                      </td>
                      <td className="px-3 py-3 align-top text-[13px] text-body">
                        {[r.phone, r.gender && r.gender[0].toUpperCase() + r.gender.slice(1), r.country && `${flag(r.country)} ${countryByCode(r.country)?.name}`].filter(Boolean).join(" · ") || <span className="text-muted">–</span>}
                      </td>
                      <td className="px-3 py-3 align-top"><div className="flex flex-col items-start gap-1"><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>{r.note && r.status !== "new" && <span className={`text-xs ${r.status === "skip" ? "text-red-700" : "text-muted"}`}>{r.note}</span>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Step>
        )}
      </div>

      <aside className="flex flex-col gap-5 xl:sticky xl:top-24 xl:self-start">
        <section className={card}>
          <h2 className="font-display text-lg font-bold text-ink">Options</h2>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-cohort`} className="text-sm font-medium text-ink">Enrol them on a cohort <span className="font-normal text-muted">(optional)</span></label>
            <select
              id={`${id}-cohort`}
              value={cohortId ?? ""}
              onChange={(e) => { const next = e.target.value ? Number(e.target.value) : null; setCohortId(next); if (file) check(file.text, next); }}
              className="h-11 w-full cursor-pointer rounded-[5px] border border-edge-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10"
            >
              <option value="">No cohort, just create their accounts</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <p className="text-[13px] text-muted">{cohortId ? "Enrolled without payment. Record any payments under Payments." : "They can enrol on a course themselves later."}</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-[5px] border border-edge p-3.5 has-[:checked]:border-accent-muted has-[:checked]:bg-accent-soft/50">
            <input type="checkbox" checked={emailStudents} onChange={(e) => setEmailStudents(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-accent" />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-ink">Email the students</span>
              <span className="text-[13px] text-muted">{cohortId ? "New students get a link to set their password, and everyone gets their enrolment confirmation." : "New students get a link to set their password and sign in."}</span>
            </span>
          </label>
          <button
            type="button"
            disabled={!file || checking || importing || importable === 0}
            onClick={() => {
              if (!file) return;
              if (!confirm(`Import ${importable} student${importable === 1 ? "" : "s"}${cohortLabel ? ` and enrol them on ${cohortLabel}` : ""}?${emailStudents ? " They'll be emailed." : ""}`)) return;
              startImport(async () => {
                const r = await importStudents(file.text, cohortId, emailStudents);
                if (r.error) setPreview({ ...preview, error: r.error });
                setResult(r);
              });
            }}
            className={`${buttonClass.primary} w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0`}
          >
            {importing ? "Importing…" : importable ? `Import ${importable} student${importable === 1 ? "" : "s"}` : "Import students"}
          </button>
          {counts.skip > 0 && !importing && <p className="-mt-2 text-center text-[13px] text-muted">{counts.skip} row{counts.skip === 1 ? "" : "s"} with problems will be left out.</p>}
        </section>

        <section className={`${card} gap-3`}>
          <h2 className="font-display text-base font-bold text-ink">Columns we read</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-body">
            <li><strong className="text-ink">email</strong> <span className="text-muted">(required)</span></li>
            <li><strong className="text-ink">first_name</strong> and <strong className="text-ink">last_name</strong>, or <strong className="text-ink">name</strong> <span className="text-muted">(required)</span></li>
            <li><strong className="text-ink">phone</strong>, <strong className="text-ink">gender</strong> (female or male), <strong className="text-ink">country</strong> (name or code like NG) <span className="text-muted">(optional)</span></li>
          </ul>
          <p className="text-[13px] text-muted">Column order doesn&apos;t matter, and common names like “Email address” or “Surname” work too.</p>
          <button type="button" onClick={() => download("students-template.csv", IMPORT_TEMPLATE)} className={`${buttonClass.small} w-fit cursor-pointer`}>
            <DownloadIcon className="size-4" /> Download template
          </button>
        </section>
      </aside>
    </div>
  );
}
