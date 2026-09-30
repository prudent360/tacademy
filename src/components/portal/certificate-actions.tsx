"use client";

import { DownloadIcon } from "@/components/icons";

export function CertificateActions() {
  return <button type="button" onClick={() => window.print()} className="certificate-print inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[5px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark"><DownloadIcon className="size-4" /> Save as PDF</button>;
}
