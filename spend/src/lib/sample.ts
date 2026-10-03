import { addDays, todayISO } from "./dates";
import type { ParsedRow } from "./types";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
const money = (r: () => number, lo: number, hi: number) => Math.round((lo + r() * (hi - lo)) * 100) / 100;

/** ~4 months of realistic made-up activity ending today, so the app has something to show. */
export function sampleRows(today = todayISO()): ParsedRow[] {
  const r = rng(42);
  const rows: ParsedRow[] = [];
  const add = (date: string, description: string, amount: number) => rows.push({ date, description, amount });

  for (let i = 120; i >= 0; i--) {
    const d = addDays(today, -i);
    const dom = Number(d.slice(8));
    if (dom === 1) add(d, "Maple Court Apartments Rent", -1350);
    if (dom === 3) add(d, "Netflix.com", -15.49);
    if (dom === 5) add(d, "Spotify USA", -11.99);
    if (dom === 8) add(d, "City Power & Electric", -money(r, 60, 95));
    if (dom === 12) add(d, "Xfinity Internet", -69.99);
    if (dom === 15 || dom === 28) add(d, "ACME Corp Payroll Direct Dep", 2350);
    if (dom === 20) add(d, "Planet Fitness", -24.99);
    if (r() < 0.3) add(d, pick(r, ["Trader Joe's #512", "Kroger #1834", "Whole Foods Market", "Aldi"]), -money(r, 18, 85));
    if (r() < 0.38) add(d, pick(r, ["Starbucks Store 2231", "Local Cafe", "Chipotle Online", "DoorDash*Thai Palace", "Joe's Pizza"]), -money(r, 5, 34));
    if (r() < 0.2) add(d, pick(r, ["Uber Trip", "Shell Oil 4412", "Metro Transit Fare", "Lyft Ride"]), -money(r, 6, 48));
    if (r() < 0.12) add(d, pick(r, ["Amazon Mktp US", "Target 0211", "Home Depot"]), -money(r, 12, 120));
    if (r() < 0.06) add(d, pick(r, ["AMC Theaters", "Steam Games", "Ticketmaster"]), -money(r, 12, 70));
    if (r() < 0.04) add(d, "CVS Pharmacy", -money(r, 8, 40));
    if (r() < 0.03) add(d, "Chase Credit Card Payment Thank You", -money(r, 200, 400));
  }
  return rows;
}
