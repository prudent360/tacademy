import type { CompanySettings, Settings } from "@/db/schema";

/** Tekskillup's Companies House record, used until something else is saved in Settings › General. */
export const DEFAULT_COMPANY: CompanySettings = {
  legalName: "TEKSKILLUP LIMITED",
  number: "17504595",
  jurisdiction: "England and Wales",
  registeredOffice: "1 Elm Terrace, Hull, East Riding of Yorkshire, HU5 2TN, United Kingdom",
};

export function companyInfo(settings: Pick<Settings, "company">): CompanySettings {
  const saved = settings.company ?? {};
  // Saved (even emptied) values win; a never-saved setting uses the default.
  return Object.keys(saved).length ? { legalName: "", number: "", jurisdiction: "", registeredOffice: "", ...saved } : DEFAULT_COMPANY;
}

export function companiesHouseUrl(number: string): string {
  return `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(number.trim())}`;
}

/** "TEKSKILLUP LIMITED, registered in England and Wales, company number 17504595. Registered office: …" */
export function companyStatement(c: CompanySettings, tradingName?: string): string {
  if (!c.legalName) return "";
  const lead = tradingName && tradingName.toLowerCase() !== c.legalName.toLowerCase() ? `${tradingName} is a trading name of ${c.legalName}` : c.legalName;
  return [
    `${lead}${c.jurisdiction ? `, a company registered in ${c.jurisdiction}` : ""}${c.number ? `, company number ${c.number}` : ""}.`,
    c.registeredOffice && `Registered office: ${c.registeredOffice}.`,
  ].filter(Boolean).join(" ");
}
