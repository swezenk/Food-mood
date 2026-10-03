import { describe, expect, it } from "vitest";
import { emptyState, importRows, loadState, recategorize } from "./store";

const rows = [
  { date: "2026-03-01", description: "Starbucks 1", amount: -5 },
  { date: "2026-03-01", description: "Starbucks 1", amount: -5 },
  { date: "2026-03-02", description: "Payroll", amount: 100 },
];

describe("importRows", () => {
  it("keeps identical rows within a file but skips re-imports", () => {
    const a = importRows(emptyState(), rows);
    expect(a.added).toBe(3);
    const b = importRows(a.state, rows);
    expect(b.added).toBe(0);
    expect(b.duplicates).toBe(3);
  });
  it("categorizes on import", () => {
    expect(importRows(emptyState(), rows).state.txns.map((t) => t.category)).toEqual(["Dining", "Dining", "Income"]);
  });
});

describe("recategorize", () => {
  it("applies to the same merchant and is remembered for future imports", () => {
    const s0 = importRows(emptyState(), rows).state;
    const s1 = recategorize(s0, s0.txns[0].id, "Giving");
    expect(s1.txns.slice(0, 2).map((t) => t.category)).toEqual(["Giving", "Giving"]);
    const s2 = importRows(s1, [{ date: "2026-04-01", description: "Starbucks 9", amount: -3 }]).state;
    expect(s2.txns.at(-1)?.category).toBe("Giving");
  });
});

describe("loadState", () => {
  it("survives corrupt storage", () => {
    expect(loadState("{nope")).toEqual(emptyState());
    expect(loadState(JSON.stringify({ txns: [{ bad: 1 }], rules: { a: 5 } }))).toEqual(emptyState());
  });
});
