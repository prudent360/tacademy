import { COUNTRIES, countryByCode } from "./countries";

/** Shared by the import preview (in the browser) and the import itself (on the server). */

export const IMPORT_MAX_ROWS = 1000;

export const IMPORT_TEMPLATE = [
  "first_name,last_name,email,phone,gender,country",
  "Ada,Okafor,ada.okafor@example.com,+234 803 123 4567,female,NG",
  "Kwame,Mensah,kwame@example.com,+233 24 123 4567,male,Ghana",
].join("\r\n");

export type ImportRow = { line: number; name: string; email: string; phone: string; gender: "female" | "male" | null; country: string | null; error?: string };

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. Also reads semicolon files. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.search(/\r?\n/) >>> 0);
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const HEADER_ALIASES: Record<keyof Omit<ImportRow, "line" | "error"> | "firstName" | "lastName", string[]> = {
  firstName: ["first name", "firstname", "given name", "first"],
  lastName: ["last name", "lastname", "surname", "family name", "last"],
  name: ["name", "full name", "fullname", "student name", "student"],
  email: ["email", "email address", "e-mail", "mail"],
  phone: ["phone", "phone number", "mobile", "mobile number", "telephone", "whatsapp", "whatsapp number"],
  gender: ["gender", "sex"],
  country: ["country", "country code", "nationality", "location"],
};

const key = (header: string) => header.trim().toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ");

/** Which column holds each field, from the header row. */
export function mapColumns(header: string[]): Partial<Record<keyof typeof HEADER_ALIASES, number>> {
  const map: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  header.forEach((h, i) => {
    const k = key(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof typeof HEADER_ALIASES, string[]][]) {
      if (map[field] === undefined && aliases.includes(k)) map[field] = i;
    }
  });
  return map;
}

function parseGender(value: string): "female" | "male" | null {
  const v = value.trim().toLowerCase();
  if (["female", "f", "woman", "w"].includes(v)) return "female";
  if (["male", "m", "man"].includes(v)) return "male";
  return null;
}

function parseCountry(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return countryByCode(v)?.code ?? COUNTRIES.find((c) => c.name.toLowerCase() === v.toLowerCase())?.code ?? null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Turns a parsed CSV into checked rows. Throws with a readable message when the file can't be used at all. */
export function readImport(text: string): ImportRow[] {
  const [header, ...body] = parseCsv(text);
  if (!header) throw new Error("The file is empty.");
  const col = mapColumns(header);
  if (col.email === undefined) throw new Error("We couldn't find an “email” column. Check the first row has column names, like the template.");
  if (col.name === undefined && col.firstName === undefined) throw new Error("We couldn't find a name column. Use “name”, or “first_name” and “last_name”.");
  if (body.length > IMPORT_MAX_ROWS) throw new Error(`The file has ${body.length} students. Import up to ${IMPORT_MAX_ROWS} at a time.`);

  const seen = new Set<string>();
  const cell = (row: string[], i: number | undefined) => (i === undefined ? "" : (row[i] ?? "").trim().replace(/\s+/g, " "));
  return body.map((row, index) => {
    const fullName = cell(row, col.name) || [cell(row, col.firstName), cell(row, col.lastName)].filter(Boolean).join(" ");
    const email = cell(row, col.email).toLowerCase();
    const genderText = cell(row, col.gender);
    const countryText = cell(row, col.country);
    const result: ImportRow = {
      line: index + 2,
      name: fullName.slice(0, 120),
      email,
      phone: cell(row, col.phone).slice(0, 40),
      gender: parseGender(genderText),
      country: parseCountry(countryText),
    };
    if (!email) result.error = "No email address";
    else if (!EMAIL.test(email) || email.length > 200) result.error = "Email address doesn't look right";
    else if (seen.has(email)) result.error = "Appears twice in this file";
    else if (fullName.length < 2) result.error = "No name";
    else if (genderText && !result.gender) result.error = `Gender “${genderText}” isn't female or male`;
    else if (countryText && !result.country) result.error = `Country “${countryText}” not recognised`;
    if (!result.error) seen.add(email);
    return result;
  });
}
