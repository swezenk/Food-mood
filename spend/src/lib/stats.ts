import { addDays, addMonths, daysInMonth, eachDay, fromISO, pad } from "./dates";
import type { Settings, Txn } from "./types";

export type Period = "day" | "week" | "month" | "year";

export const isSpend = (t: Txn) => t.amount < 0 && t.category !== "Transfer" && t.category !== "Income";
export const isIncome = (t: Txn) => t.amount > 0 && t.category !== "Transfer";

/** Bills that land in lumps. They're set aside before the daily budget, so one rent payment doesn't wreck a day. */
export const FIXED_CATEGORIES = ["Housing", "Utilities", "Subscriptions", "Insurance"];
export const isFixed = (t: Txn) => isSpend(t) && FIXED_CATEGORIES.includes(t.category);
export const isFlexible = (t: Txn) => isSpend(t) && !FIXED_CATEGORIES.includes(t.category);

export interface Range {
  start: string;
  end: string;
  label: string;
}

const fmtShort = (iso: string, opts: Intl.DateTimeFormatOptions) => fromISO(iso).toLocaleDateString("en-US", opts);

export function periodRange(period: Period, anchor: string): Range {
  const d = fromISO(anchor);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  switch (period) {
    case "day":
      return { start: anchor, end: anchor, label: fmtShort(anchor, { weekday: "short", month: "short", day: "numeric" }) };
    case "week": {
      const start = addDays(anchor, -((d.getDay() + 6) % 7)); // Monday
      const end = addDays(start, 6);
      return { start, end, label: `${fmtShort(start, { month: "short", day: "numeric" })} – ${fmtShort(end, { month: "short", day: "numeric" })}` };
    }
    case "month":
      return {
        start: `${y}-${pad(m)}-01`,
        end: `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`,
        label: fmtShort(anchor, { month: "long", year: "numeric" }),
      };
    case "year":
      return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) };
  }
}

export function shiftAnchor(period: Period, anchor: string, dir: 1 | -1): string {
  switch (period) {
    case "day":
      return addDays(anchor, dir);
    case "week":
      return addDays(anchor, 7 * dir);
    case "month":
      return addMonths(anchor, dir);
    case "year":
      return addMonths(anchor, 12 * dir);
  }
}

export interface CategoryTotal {
  category: string;
  amount: number;
  pct: number;
}

export interface Summary {
  income: number;
  spent: number;
  /** Everyday spending: spent minus fixed bills. This is what the daily budget is measured against. */
  flexible: number;
  fixed: number;
  net: number;
  byCategory: CategoryTotal[];
  txns: Txn[];
}

const cents = (n: number) => Math.round(n * 100) / 100;

export function summarize(txns: Txn[], start: string, end: string): Summary {
  const inRange = txns.filter((t) => t.date >= start && t.date <= end);
  let income = 0;
  let spent = 0;
  let fixed = 0;
  const cat = new Map<string, number>();
  for (const t of inRange) {
    if (isIncome(t)) income += t.amount;
    else if (isSpend(t)) {
      spent -= t.amount;
      if (isFixed(t)) fixed -= t.amount;
      cat.set(t.category, (cat.get(t.category) ?? 0) - t.amount);
    }
  }
  const byCategory = [...cat.entries()]
    .map(([category, amount]) => ({ category, amount: cents(amount), pct: spent > 0 ? amount / spent : 0 }))
    .sort((a, b) => b.amount - a.amount);
  return {
    income: cents(income),
    spent: cents(spent),
    fixed: cents(fixed),
    flexible: cents(spent - fixed),
    net: cents(income - spent),
    byCategory,
    txns: inRange.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
  };
}

/** Everyday (non-bill) spending per day. */
export function spentByDay(txns: Txn[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txns) if (isFlexible(t)) map.set(t.date, (map.get(t.date) ?? 0) - t.amount);
  return map;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

/**
 * Daily budget = (a month's income - savings goal - fixed bills) spread evenly over the month.
 * Income is the user's override if set, otherwise detected from deposits. For the current month we
 * never go below the average of earlier months (paychecks and bills may not have landed yet), and
 * days before the first transaction have no budget.
 */
export function makeBudget(txns: Txn[], settings: Settings, today: string): (iso: string) => number {
  const income = new Map<string, number>();
  const fixed = new Map<string, number>();
  let first = "9999-12-31";
  for (const t of txns) {
    const key = t.date.slice(0, 7);
    if (t.date < first) first = t.date;
    if (isIncome(t)) income.set(key, (income.get(key) ?? 0) + t.amount);
    else if (isFixed(t)) fixed.set(key, (fixed.get(key) ?? 0) - t.amount);
  }
  const currentKey = today.slice(0, 7);
  const typical = (m: Map<string, number>) => {
    const all = [...m.entries()].filter(([, v]) => v > 0);
    return avg(all.filter(([k]) => k < currentKey).map(([, v]) => v)) || avg(all.map(([, v]) => v));
  };
  const typicalIncome = typical(income);
  const typicalFixed = typical(fixed);

  const estimate = (m: Map<string, number>, key: string, fallback: number) => {
    const actual = m.get(key) ?? 0;
    if (key >= currentKey) return Math.max(actual, fallback);
    return actual > 0 ? actual : fallback;
  };
  const keep = 1 - Math.min(Math.max(settings.savingsPct, 0), 100) / 100;
  return (iso) => {
    if (iso < first) return 0;
    const key = iso.slice(0, 7);
    const [y, m] = key.split("-").map(Number);
    const inc = settings.monthlyIncome != null ? settings.monthlyIncome : estimate(income, key, typicalIncome);
    const pool = Math.max(inc * keep - estimate(fixed, key, typicalFixed), 0);
    return pool / daysInMonth(y, m);
  };
}

export interface Pace {
  periodBudget: number;
  elapsedBudget: number;
  /** elapsedBudget - spent; positive means under budget. */
  landing: number;
  isCurrent: boolean;
  isFuture: boolean;
}

export function paceFor(range: Range, today: string, budgetFor: (iso: string) => number, spent: number): Pace {
  const days = eachDay(range.start, range.end);
  const elapsed = days.filter((d) => d <= today);
  const periodBudget = cents(sum(days.map(budgetFor)));
  const elapsedBudget = cents(sum(elapsed.map(budgetFor)));
  return {
    periodBudget,
    elapsedBudget,
    landing: cents(elapsedBudget - spent),
    isCurrent: range.start <= today && today <= range.end,
    isFuture: range.start > today,
  };
}

export interface Bucket {
  label: string;
  start: string;
  spent: number;
  budget: number;
  future: boolean;
}

/** Bars for the chart: days for week/month, months for year. */
export function bucketsFor(period: Period, range: Range, txns: Txn[], budgetFor: (iso: string) => number, today: string): Bucket[] {
  if (period === "day") return [];
  const byDay = spentByDay(txns);
  if (period === "year") {
    const y = Number(range.start.slice(0, 4));
    return Array.from({ length: 12 }, (_, i) => {
      const start = `${y}-${pad(i + 1)}-01`;
      const days = eachDay(start, `${y}-${pad(i + 1)}-${pad(daysInMonth(y, i + 1))}`);
      return {
        label: fmtShort(start, { month: "narrow" }),
        start,
        spent: cents(sum(days.map((d) => byDay.get(d) ?? 0))),
        budget: cents(sum(days.map(budgetFor))),
        future: start > today,
      };
    });
  }
  return eachDay(range.start, range.end).map((d) => ({
    label: period === "week" ? fmtShort(d, { weekday: "narrow" }) : String(Number(d.slice(8))),
    start: d,
    spent: cents(byDay.get(d) ?? 0),
    budget: cents(budgetFor(d)),
    future: d > today,
  }));
}

/** Consecutive days at/under budget, counted back from today (or the latest transaction if older). */
export function underBudgetStreak(txns: Txn[], today: string, budgetFor: (iso: string) => number): number {
  if (txns.length === 0) return 0;
  const dates = txns.map((t) => t.date).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  const byDay = spentByDay(txns);
  let d = last < today ? last : today;
  let streak = 0;
  while (d >= first) {
    const budget = budgetFor(d);
    if (budget <= 0 || (byDay.get(d) ?? 0) > budget + 0.005) break;
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

export function noSpendDays(txns: Txn[], monthAnchor: string, today: string): number {
  if (txns.length === 0) return 0;
  const monthStart = `${monthAnchor.slice(0, 7)}-01`;
  const last = txns.reduce((a, t) => (t.date > a ? t.date : a), "");
  const end = [today, last].reduce((a, b) => (a < b ? a : b));
  if (end < monthStart) return 0;
  const byDay = spentByDay(txns);
  return eachDay(monthStart, end).filter((d) => !byDay.has(d)).length;
}

export interface Badge {
  id: string;
  emoji: string;
  title: string;
  hint: string;
  earned: boolean;
}

export function badges(txns: Txn[], settings: Settings, today: string): Badge[] {
  const budgetFor = makeBudget(txns, settings, today);
  const streak = underBudgetStreak(txns, today, budgetFor);
  const month = periodRange("month", today);
  const thisMonth = summarize(txns, month.start, month.end);
  const prev = periodRange("month", addMonths(today, -1));
  const prevMonth = summarize(txns, prev.start, prev.end);
  const quiet = noSpendDays(txns, today, today);
  const savedPct = thisMonth.income > 0 ? thisMonth.net / thisMonth.income : 0;
  return [
    { id: "s3", emoji: "🌱", title: "3-day streak", hint: "3 days in a row under budget", earned: streak >= 3 },
    { id: "s7", emoji: "🔥", title: "7-day streak", hint: "A full week under budget", earned: streak >= 7 },
    { id: "s30", emoji: "🏆", title: "30-day streak", hint: "30 days under budget", earned: streak >= 30 },
    { id: "ns", emoji: "🧘", title: "No-spend day", hint: "A day this month with zero spending", earned: quiet >= 1 },
    { id: "ns3", emoji: "🪴", title: "Quiet month", hint: "3+ no-spend days this month", earned: quiet >= 3 },
    { id: "sv", emoji: "💰", title: "Saver", hint: "Keeping 10%+ of this month's income", earned: savedPct >= 0.1 },
    { id: "gr", emoji: "📈", title: "In the green", hint: "Last month ended with money left", earned: prevMonth.income > 0 && prevMonth.net > 0 },
  ];
}
