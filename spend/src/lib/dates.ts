export const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => toISO(new Date());

export function addDays(s: string, n: number): string {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMonths(s: string, n: number): string {
  const d = fromISO(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

/** month is 1-12 */
export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Strict YYYY-MM-DD validation (rejects 2026-02-31). */
export function buildISO(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return toISO(date);
}
