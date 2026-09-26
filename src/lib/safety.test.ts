import { describe, expect, it } from "vitest";
import { maxLevel, screenText } from "./safety";

describe("screenText", () => {
  it("passes ordinary craving talk", () => {
    for (const t of [
      "I really want donuts",
      "I binged on chips last night and feel gross",
      "work was so stressful I could die for some pizza",
      "I skipped lunch",
    ]) {
      expect(screenText(t)).toBe("none");
    }
  });

  it("flags disordered-eating behaviors as concern", () => {
    for (const t of [
      "I made myself throw up after dinner",
      "thinking about taking laxatives",
      "I've been purging",
      "I'm going to starve myself tomorrow to make up for it",
      "I haven't eaten in three days",
    ]) {
      expect(screenText(t)).toBe("concern");
    }
  });

  it("flags self-harm and suicidal ideation as crisis", () => {
    for (const t of ["I want to die", "sometimes I think about killing myself", "I've been hurting myself"]) {
      expect(screenText(t)).toBe("crisis");
    }
  });

  it("maxLevel keeps the more severe level", () => {
    expect(maxLevel("none", "concern")).toBe("concern");
    expect(maxLevel("crisis", "concern")).toBe("crisis");
  });
});
