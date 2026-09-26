import { describe, expect, it } from "vitest";
import { computeMetrics } from "./metrics";
import { convo, state } from "./test-fixtures";

describe("computeMetrics", () => {
  it("derives the MVP funnel", () => {
    const d = (at: string) => ({ kind: "wait" as const, summary: "tea", followUpMinutes: 10, at });
    const s = state({
      conversations: [
        convo("2026-09-02T20:00:00", { decision: d("2026-09-02T20:05:00"), followUp: { outcome: "didnt_eat", satisfaction: 4, helpful: "yes", at: "2026-09-02T20:20:00" } }),
        convo("2026-09-05T20:00:00", { decision: d("2026-09-05T20:05:00") }),
        convo("2026-09-06T20:00:00"),
        convo("2026-09-24T20:00:00"),
      ],
    });
    const m = computeMetrics(s, new Date("2026-09-29T12:00:00"));
    expect(m.activated).toBe(true);
    expect(m.repeatWithin7Days).toBe(true);
    expect(m.interventionCompletion).toBe(0.5);
    expect(m.followUpCompletion).toBe(0.5);
    expect(m.helpful).toEqual({ yes: 1, somewhat: 0, no: 0 });
    expect(m.retainedWeek4).toBe(true);
  });
});
