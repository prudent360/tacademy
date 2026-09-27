"use client";

import { DownloadIcon } from "@/components/icons";

export function CertificateActions() {
  return <button type="button" onClick={() => window.print()} className="certificate-print inline-flex h-11 items-center gap-2 rounded-[5px] bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-dark"><DownloadIcon className="size-4" /> Print or save PDF</button>;
}
