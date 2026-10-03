import { describe, expect, it } from "vitest";
import { parseAmount, parseCSV, parseDate, parseStatement } from "./csv";

describe("parseCSV", () => {
  it("handles quotes, embedded commas and CRLF", () => {
    expect(parseCSV('a,b\r\n"x, y","he said ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"']]);
  });
  it("detects semicolon delimiters", () => {
    expect(parseCSV("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseAmount", () => {
  it.each([
    ["$1,234.50", 1234.5],
    ["-12.30", -12.3],
    ["(45.00)", -45],
    ["12.00-", -12],
    ["1.234,56", 1234.56],
    ["€ 9,5", 9.5],
  ])("%s", (raw, want) => expect(parseAmount(raw)).toBe(want));
  it("rejects junk", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});

describe("parseDate", () => {
  it("parses common formats", () => {
    expect(parseDate("2026-03-05")).toBe("2026-03-05");
    expect(parseDate("03/05/2026")).toBe("2026-03-05");
    expect(parseDate("03/05/2026", true)).toBe("2026-05-03");
    expect(parseDate("Mar 5, 2026")).toBe("2026-03-05");
    expect(parseDate("5 Mar 2026")).toBe("2026-03-05");
  });
  it("rejects impossible dates", () => expect(parseDate("2026-02-31")).toBeNull());
});

describe("parseStatement", () => {
  it("reads a single signed amount column", () => {
    const r = parseStatement("Date,Description,Amount\n2026-03-01,Kroger,-42.10\n2026-03-02,Payroll,2000\n");
    expect(r.rows).toEqual([
      { date: "2026-03-01", description: "Kroger", amount: -42.1 },
      { date: "2026-03-02", description: "Payroll", amount: 2000 },
    ]);
  });
  it("reads debit/credit columns", () => {
    const r = parseStatement("Posted Date,Payee,Debit,Credit\n03/01/2026,Kroger,42.10,\n03/02/2026,Payroll,,2000\n");
    expect(r.rows.map((x) => x.amount)).toEqual([-42.1, 2000]);
  });
  it("skips preamble lines above the header", () => {
    const r = parseStatement("Account summary\nGenerated 3/1\nDate,Description,Amount\n2026-03-01,Kroger,-5\n");
    expect(r.rows).toHaveLength(1);
  });
  it("treats all-positive card exports as spending, and the flip toggle inverts", () => {
    const csv = "Transaction Date,Description,Amount\n2026-03-01,A,5\n2026-03-02,B,6\n2026-03-03,C,7\n";
    const auto = parseStatement(csv);
    expect(auto.autoFlipped).toBe(true);
    expect(auto.rows.every((r) => r.amount < 0)).toBe(true);
    expect(parseStatement(csv, { flipSigns: true }).rows.every((r) => r.amount > 0)).toBe(true);
  });
  it("guesses columns without a header", () => {
    const r = parseStatement("2026-03-01,Kroger Market,-42.10\n2026-03-02,Payroll Deposit,2000.00\n");
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].description).toBe("Kroger Market");
  });
  it("reports unusable files", () => {
    expect(parseStatement("hello\nworld").rows).toEqual([]);
    expect(parseStatement("").warnings.length).toBeGreaterThan(0);
  });
});
