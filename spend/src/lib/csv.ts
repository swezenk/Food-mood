import { buildISO } from "./dates";
import type { ParsedRow } from "./types";

export const MAX_ROWS = 50_000;

export function parseCSV(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let delim = ",";
  let best = 0;
  for (const d of [",", ";", "\t", "|"]) {
    const n = firstLine.split(d).length;
    if (n > best) {
      best = n;
      delim = d;
    }
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const monthNum = (name: string) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;

export function parseDate(raw: string, dmy = false): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return buildISO(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return dmy ? buildISO(y, +m[2], +m[1]) : buildISO(y, +m[1], +m[2]);
  }
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && monthNum(m[1]) > 0) return buildISO(+m[3], monthNum(m[1]), +m[2]);
  m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})\.?,?[\s-](\d{4})/);
  if (m && monthNum(m[2]) > 0) return buildISO(+m[3], monthNum(m[2]), +m[1]);
  return null;
}

/** Day-first if any slash date has a first part > 12; otherwise month-first. */
function detectDMY(samples: string[]): boolean {
  for (const s of samples) {
    const m = s.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (m && +m[1] > 12) return true;
  }
  return false;
}

export function parseAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    neg = true;
    s = s.slice(0, -1);
  }
  s = s.replace(/[A-Za-z$€£¥\s]/g, "");
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Math.round(parseFloat(s) * 100) / 100;
  return neg ? -n : n;
}

const re = {
  date: /date/i,
  desc: /desc|payee|merchant|memo|narrative|details|name|reference/i,
  amount: /amount|value/i,
  debit: /debit|withdraw|paid out|money out|spent/i,
  credit: /credit|deposit|paid in|money in|received/i,
};

const findCol = (headers: string[], rx: RegExp, skip: number[] = []) =>
  headers.findIndex((h, i) => !skip.includes(i) && rx.test(h));

export interface ParseResult {
  rows: ParsedRow[];
  skipped: number;
  warnings: string[];
  /** True when every amount was positive and we treated them all as spending. */
  autoFlipped: boolean;
}

export function parseStatement(text: string, opts: { flipSigns?: boolean } = {}): ParseResult {
  const warnings: string[] = [];
  const table = parseCSV(text);
  if (table.length === 0) return { rows: [], skipped: 0, warnings: ["The file is empty."], autoFlipped: false };
  if (table.length > MAX_ROWS) {
    warnings.push(`Only the first ${MAX_ROWS.toLocaleString()} rows were read.`);
    table.length = MAX_ROWS;
  }

  // Find the header row (some banks put a few summary lines above it).
  let headerIdx = table.slice(0, 15).findIndex(
    (r) => r.some((c) => re.date.test(c)) && r.some((c) => re.amount.test(c) || re.debit.test(c) || re.desc.test(c)),
  );
  let dateCol = -1;
  let descCol = -1;
  let amountCol = -1;
  let debitCol = -1;
  let creditCol = -1;

  if (headerIdx >= 0) {
    const h = table[headerIdx].map((c) => c.trim());
    dateCol = findCol(h, re.date);
    debitCol = findCol(h, re.debit, [dateCol]);
    creditCol = findCol(h, re.credit, [dateCol, debitCol]);
    amountCol = debitCol >= 0 && creditCol >= 0 ? -1 : findCol(h, re.amount, [dateCol]);
    descCol = findCol(h, re.desc, [dateCol, amountCol, debitCol, creditCol]);
  } else {
    // No header: guess columns from the data itself.
    const sample = table.slice(0, 25);
    const width = Math.max(...sample.map((r) => r.length));
    const score = (col: number, test: (v: string) => boolean) => sample.filter((r) => test(r[col] ?? "")).length;
    let bestScore = 0;
    for (let c = 0; c < width; c++) {
      const s = score(c, (v) => parseDate(v) !== null);
      if (s > bestScore) {
        bestScore = s;
        dateCol = c;
      }
    }
    bestScore = 0;
    for (let c = 0; c < width; c++) {
      if (c === dateCol) continue;
      const s = score(c, (v) => parseAmount(v) !== null && /[.,]/.test(v));
      if (s > bestScore) {
        bestScore = s;
        amountCol = c;
      }
    }
    let longest = 0;
    for (let c = 0; c < width; c++) {
      if (c === dateCol || c === amountCol) continue;
      const len = sample.reduce((n, r) => n + (r[c]?.length ?? 0), 0);
      if (len > longest) {
        longest = len;
        descCol = c;
      }
    }
    headerIdx = -1;
    if (dateCol >= 0 && amountCol >= 0) warnings.push("No header row found; columns were guessed. Check the preview.");
  }

  if (dateCol < 0 || (amountCol < 0 && debitCol < 0 && creditCol < 0)) {
    return {
      rows: [],
      skipped: 0,
      warnings: [...warnings, "Couldn't find a date column and an amount column. Export your statement as CSV with those columns."],
      autoFlipped: false,
    };
  }

  const body = table.slice(headerIdx + 1);
  const dmy = detectDMY(body.map((r) => r[dateCol] ?? ""));
  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (const r of body) {
    const date = parseDate(r[dateCol] ?? "", dmy);
    let amount: number | null;
    if (amountCol >= 0) amount = parseAmount(r[amountCol] ?? "");
    else {
      const debit = parseAmount(r[debitCol] ?? "") ?? 0;
      const credit = parseAmount(r[creditCol] ?? "") ?? 0;
      amount = debit === 0 && credit === 0 ? null : Math.abs(credit) - Math.abs(debit);
    }
    if (!date || amount === null || amount === 0) {
      skipped++;
      continue;
    }
    const description = (descCol >= 0 ? (r[descCol] ?? "") : "").replace(/\s+/g, " ").trim().slice(0, 120) || "(no description)";
    rows.push({ date, description, amount });
  }

  // Credit-card exports often list charges as positive numbers.
  let autoFlipped = false;
  if (amountCol >= 0 && rows.length >= 3 && rows.every((r) => r.amount > 0)) {
    autoFlipped = true;
    warnings.push("Every amount was positive, so we treated them all as spending.");
  }
  if (autoFlipped !== !!opts.flipSigns) for (const r of rows) r.amount = -r.amount;

  if (skipped > 0) warnings.push(`${skipped} row${skipped === 1 ? "" : "s"} skipped (no valid date or amount).`);
  return { rows, skipped, warnings, autoFlipped };
}
