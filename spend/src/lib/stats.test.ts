import { describe, expect, it } from "vitest";
import { badges, bucketsFor, makeBudget, paceFor, periodRange, shiftAnchor, summarize, underBudgetStreak } from "./stats";
import type { Settings, Txn } from "./types";

const t = (date: string, amount: number, category = amount > 0 ? "Income" : "Other"): Txn => ({ id: date + amount + category, date, description: "x", amount, category });
const settings: Settings = { monthlyIncome: null, savingsPct: 0 };

describe("periodRange", () => {
  it("uses Monday-start weeks", () => {
    const r = periodRange("week", "2026-10-03"); // Saturday
    expect([r.start, r.end]).toEqual(["2026-09-28", "2026-10-04"]);
  });
  it("covers months and years", () => {
    expect(periodRange("month", "2026-02-10")).toMatchObject({ start: "2026-02-01", end: "2026-02-28" });
    expect(periodRange("year", "2026-02-10")).toMatchObject({ start: "2026-01-01", end: "2026-12-31" });
  });
  it("shifts anchors", () => {
    expect(shiftAnchor("month", "2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftAnchor("week", "2026-10-03", -1)).toBe("2026-09-26");
  });
});

describe("summarize", () => {
  it("ignores transfers and groups by category", () => {
    const s = summarize(
      [t("2026-10-01", 1000), t("2026-10-01", -40, "Dining"), t("2026-10-02", -10, "Dining"), t("2026-10-02", -500, "Transfer"), t("2026-09-30", -99, "Dining")],
      "2026-10-01",
      "2026-10-31",
    );
    expect(s).toMatchObject({ income: 1000, spent: 50, net: 950 });
    expect(s.byCategory).toEqual([{ category: "Dining", amount: 50, pct: 1 }]);
  });
});

describe("budget and pace", () => {
  const txns = [t("2026-10-01", 3100), t("2026-10-02", -50, "Dining")];
  it("spreads income evenly across the month", () => {
    expect(makeBudget(txns, settings, "2026-10-05")("2026-10-05")).toBeCloseTo(100);
  });
  it("sets fixed bills aside before budgeting and ignores days before the data starts", () => {
    const withRent = [t("2026-10-01", 3100), t("2026-10-01", -1550, "Housing")];
    const b = makeBudget(withRent, settings, "2026-10-05");
    expect(b("2026-10-05")).toBeCloseTo(50);
    expect(b("2026-09-30")).toBe(0);
    expect(summarize(withRent, "2026-10-01", "2026-10-31")).toMatchObject({ spent: 1550, fixed: 1550, flexible: 0 });
  });
  it("applies the savings goal and income override", () => {
    expect(makeBudget(txns, { monthlyIncome: 6200, savingsPct: 50 }, "2026-10-05")("2026-10-05")).toBeCloseTo(100);
  });
  it("computes landing against elapsed budget", () => {
    const b = makeBudget(txns, settings, "2026-10-05");
    const range = periodRange("month", "2026-10-05");
    const p = paceFor(range, "2026-10-05", b, 50);
    expect(p.elapsedBudget).toBe(500);
    expect(p.landing).toBe(450);
    expect(p.isCurrent).toBe(true);
  });
  it("builds a bar per day", () => {
    const b = makeBudget(txns, settings, "2026-10-05");
    const bars = bucketsFor("month", periodRange("month", "2026-10-05"), txns, b, "2026-10-05");
    expect(bars).toHaveLength(31);
    expect(bars[1].spent).toBe(50);
    expect(bars[10].future).toBe(true);
  });
});

describe("streak and badges", () => {
  const income = t("2026-10-01", 3100);
  it("counts days under budget until one goes over, from the latest transaction", () => {
    const txns = [income, t("2026-10-02", -250, "Dining"), t("2026-10-04", -20, "Dining")];
    const b = makeBudget(txns, settings, "2026-10-05");
    expect(underBudgetStreak(txns, "2026-10-05", b)).toBe(2); // counts back from the latest txn (10-04): 10-04, 10-03; 10-02 was over
  });
  it("does not inflate streaks past the latest transaction", () => {
    const txns = [income, t("2026-10-02", -250, "Dining")];
    const b = makeBudget(txns, settings, "2026-12-01");
    expect(underBudgetStreak(txns, "2026-12-01", b)).toBe(0);
  });
  it("awards badges", () => {
    const txns = [income, t("2026-10-04", -20, "Dining")];
    const earned = badges(txns, settings, "2026-10-05").filter((x) => x.earned).map((x) => x.id);
    expect(earned).toEqual(expect.arrayContaining(["s3", "ns", "ns3", "sv"]));
  });
});
