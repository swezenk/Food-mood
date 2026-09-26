import { describe, expect, it } from "vitest";
import { applyMemoryOps } from "./actions";
import type { Memory } from "./types";

const base: Memory = {
  id: "m1",
  text: "Gets sweet cravings after work",
  kind: "temporary",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  expiresAt: "2026-09-15T00:00:00Z",
  evidenceCount: 1,
};

describe("applyMemoryOps", () => {
  const now = new Date("2026-09-10T00:00:00Z");

  it("adds new memories, skipping duplicates", () => {
    const out = applyMemoryOps(
      [base],
      [
        { op: "add", id: null, text: "Walks help", kind: "persistent" },
        { op: "add", id: null, text: "gets sweet cravings after work", kind: "temporary" },
      ],
      now,
    );
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ text: "Walks help", kind: "persistent", expiresAt: undefined });
  });

  it("reinforces and can promote to persistent", () => {
    const [m] = applyMemoryOps([base], [{ op: "reinforce", id: "m1", text: "Frequently gets sweet cravings after stressful workdays", kind: "persistent" }], now);
    expect(m).toMatchObject({ kind: "persistent", evidenceCount: 2, expiresAt: undefined });
    expect(m.text).toMatch(/stressful workdays/);
  });

  it("never demotes a persistent memory", () => {
    const [m] = applyMemoryOps([{ ...base, kind: "persistent", expiresAt: undefined }], [{ op: "reinforce", id: "m1", text: "", kind: "temporary" }], now);
    expect(m.kind).toBe("persistent");
    expect(m.text).toBe(base.text);
  });

  it("retires contradicted memories", () => {
    expect(applyMemoryOps([base], [{ op: "retire", id: "m1", text: "", kind: "temporary" }], now)).toEqual([]);
  });
});
