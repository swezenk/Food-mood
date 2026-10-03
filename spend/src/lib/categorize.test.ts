import { describe, expect, it } from "vitest";
import { categorize, merchantKey } from "./categorize";

describe("categorize", () => {
  it.each([
    ["STARBUCKS #1234", -5, "Dining"],
    ["Uber Eats Order", -20, "Dining"],
    ["UBER TRIP", -12, "Transport"],
    ["Kroger #12", -60, "Groceries"],
    ["Netflix.com", -15, "Subscriptions"],
    ["Coffee Shop", -4, "Dining"],
    ["Random Vendor", -9, "Other"],
    ["Payroll Direct Dep", 2000, "Income"],
    ["Online Transfer to Savings", -500, "Transfer"],
    ["Payment - Thank You", -300, "Transfer"],
  ])("%s", (d, amt, want) => expect(categorize(d, amt)).toBe(want));

  it("lets remembered choices win", () => {
    expect(categorize("Joe's Diner 55", -9, { [merchantKey("Joe's Diner 55")]: "Giving" })).toBe("Giving");
  });
  it("keys merchants without store numbers", () => {
    expect(merchantKey("KROGER #1834")).toBe(merchantKey("Kroger #22"));
  });
});
