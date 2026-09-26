import { describe, expect, it } from "vitest";
import {
  computePatterns,
  computeProgress,
  controlCheckDue,
  dueFollowUps,
  mostCommonWindow,
  pickNudge,
  strategyStats,
  timeWindowLabel,
} from "./patterns";
import { convo, extraction, profile, state } from "./test-fixtures";

describe("time windows", () => {
  it("labels two-hour windows", () => {
    expect(timeWindowLabel(20)).toBe("8–10 PM");
    expect(timeWindowLabel(10)).toBe("10 AM–12 PM");
    expect(timeWindowLabel(22)).toBe("10 PM–12 AM");
  });

  it("finds the most common window", () => {
    const w = mostCommonWindow([
      convo("2026-09-20T20:30:00"),
      convo("2026-09-21T21:10:00"),
      convo("2026-09-22T13:00:00"),
    ]);
    expect(w).toEqual({ label: "8–10 PM", startHour: 20, count: 2 });
  });
});

describe("computePatterns", () => {
  it("summarizes the last week", () => {
    const now = new Date("2026-09-26T12:00:00");
    const s = state({
      conversations: [
        convo("2026-09-24T20:00:00", { extraction: extraction({ urgeIntensity: 8 }) }),
        convo("2026-09-25T21:00:00", { extraction: extraction({ urgeIntensity: 6, trigger: "Work stress" }) }),
        convo("2026-09-25T15:00:00", { extraction: extraction({ urgeIntensity: 7, trigger: "boredom", cravingCategory: "salty" }) }),
        convo("2026-09-01T20:00:00", { extraction: extraction() }), // outside the week
        convo("2026-09-25T22:00:00", { mode: "talk" }), // not a craving
      ],
    });
    const p = computePatterns(s, 7, now);
    expect(p.checkIns).toBe(3);
    expect(p.topTrigger?.toLowerCase()).toBe("work stress");
    expect(p.topCraving).toBe("sweet");
    expect(p.averageUrge).toBe(7);
    expect(p.topWindow).toBe("8–10 PM");
  });
});

describe("strategyStats", () => {
  it("counts a strategy as helping when they didn't eat it or felt good", () => {
    const at = "2026-09-25T20:00:00";
    const stats = strategyStats([
      convo(at, { extraction: extraction(), followUp: { outcome: "didnt_eat", satisfaction: 3, at } }),
      convo(at, { extraction: extraction(), followUp: { outcome: "ate_original", satisfaction: 2, at } }),
      convo(at, { extraction: extraction(), followUp: { outcome: "ate_some", satisfaction: 4, at } }),
      convo(at, { extraction: extraction() }), // no follow-up: not counted
    ]);
    expect(stats).toEqual([{ strategy: "tea + wait", tried: 3, helped: 2 }]);
  });
});

describe("computeProgress", () => {
  it("counts this month's behavior", () => {
    const now = new Date("2026-09-26T12:00:00");
    const decision = { kind: "intentional" as const, summary: "one donut", followUpMinutes: 30, at: "2026-09-20T20:00:00" };
    const s = state({
      conversations: [
        convo("2026-09-20T20:00:00", { decision }),
        convo("2026-09-21T20:00:00", { decision: { ...decision, kind: "undecided" } }),
        convo("2026-08-30T20:00:00", { decision }),
      ],
      memories: [
        { id: "m1", text: "a", kind: "persistent", createdAt: "", updatedAt: "", evidenceCount: 2 },
        { id: "m2", text: "b", kind: "temporary", createdAt: "", updatedAt: "", evidenceCount: 1 },
      ],
    });
    const p = computeProgress(s, now);
    expect(p.checkIns).toBe(2);
    expect(p.intentionalDecisions).toBe(1);
    expect(p.patternsDiscovered).toBe(1);
  });
});

describe("dueFollowUps", () => {
  it("returns decisions whose follow-up time has passed", () => {
    const now = new Date("2026-09-26T20:30:00");
    const due = convo("2026-09-26T20:00:00", {
      decision: { kind: "wait", summary: "tea", followUpMinutes: 10, at: "2026-09-26T20:05:00" },
    });
    const notYet = convo("2026-09-26T20:25:00", {
      decision: { kind: "wait", summary: "tea", followUpMinutes: 10, at: "2026-09-26T20:25:00" },
    });
    const done = convo("2026-09-26T20:00:00", {
      decision: { kind: "wait", summary: "tea", followUpMinutes: 10, at: "2026-09-26T20:05:00" },
      followUp: { outcome: "didnt_eat", satisfaction: 4, at: "2026-09-26T20:20:00" },
    });
    expect(dueFollowUps([due, notYet, done], now).map((c) => c.id)).toEqual([due.id]);
  });
});

describe("pickNudge", () => {
  const evenings = [
    convo("2026-09-20T21:00:00", { extraction: extraction() }),
    convo("2026-09-21T21:30:00", { extraction: extraction() }),
    convo("2026-09-23T20:15:00", { extraction: extraction() }),
  ];

  it("nudges before the usual hard window", () => {
    const text = pickNudge(state({ conversations: evenings }), new Date("2026-09-26T19:00:00"));
    expect(text).toMatch(/Evenings have been the hardest/);
  });

  it("respects the daily cap", () => {
    const s = state({ conversations: evenings, nudges: [{ text: "x", at: "2026-09-26T08:00:00" }] });
    expect(pickNudge(s, new Date("2026-09-26T19:00:00"))).toBeNull();
  });

  it("stays quiet without enough history, when disabled, or in supportive mode", () => {
    const at = new Date("2026-09-26T19:00:00");
    expect(pickNudge(state({ conversations: evenings.slice(0, 2) }), at)).toBeNull();
    expect(pickNudge(state({ conversations: evenings, profile: profile({ nudges: { enabled: false, quietStart: 23, quietEnd: 7 } }) }), at)).toBeNull();
    expect(pickNudge(state({ conversations: evenings, profile: profile({ safetyMode: true }) }), at)).toBeNull();
  });

  it("respects quiet hours", () => {
    const s = state({ conversations: evenings, profile: profile({ nudges: { enabled: true, quietStart: 18, quietEnd: 8 } }) });
    expect(pickNudge(s, new Date("2026-09-26T19:00:00"))).toBeNull();
  });
});

describe("controlCheckDue", () => {
  it("asks weekly", () => {
    const s = state({ controlRatings: [{ value: 6, at: "2026-09-20T12:00:00" }] });
    expect(controlCheckDue(s, new Date("2026-09-26T12:00:00"))).toBe(false);
    expect(controlCheckDue(s, new Date("2026-09-27T12:00:00"))).toBe(true);
  });
});
