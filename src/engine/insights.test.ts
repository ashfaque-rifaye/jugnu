import { describe, expect, it } from "vitest";
import { generateBlock } from "./block";
import { contrastPairs, whatIf } from "./insights";
import { runPipeline, runTrackStage } from "./pipeline";

describe("contrast pairs", () => {
  const st = runPipeline(generateBlock(2024));
  const pairs = contrastPairs(st);
  it("pairs every interviewed bright spot with a comparison school", () => {
    expect(pairs.length).toBeGreaterThan(0);
    for (const p of pairs) {
      expect(st.bright).toContain(p.bright.schoolId);
      expect(st.comparison).toContain(p.comparison.schoolId);
      expect(p.practices.length).toBeGreaterThan(0);
    }
  });
  it("shows the bright spot ahead of its match", () => {
    const ahead = pairs.filter((p) => p.bright.aboveExpected.reading + p.bright.aboveExpected.numeracy > p.comparison.aboveExpected.reading + p.comparison.aboveExpected.numeracy);
    expect(ahead.length / pairs.length).toBeGreaterThanOrEqual(0.8);
  });
});

describe("what-if", () => {
  const st = runPipeline(generateBlock(2024));
  const practice = st.evidence.find((e) => e.verdict === "distinctive")!.practice;
  const targets = st.find.struggling.slice(0, 12);
  it("more CRPs means more visits and more adopters", () => {
    const few = whatIf(st, { practice, schoolIds: targets, crps: 1 });
    const many = whatIf(st, { practice, schoolIds: targets, crps: 5 });
    expect(many.visited).toBeGreaterThanOrEqual(few.visited);
    expect(many.adopters.mean).toBeGreaterThanOrEqual(few.adopters.mean);
    expect(many.upliftPts.lo).toBeLessThanOrEqual(many.upliftPts.mean);
    expect(many.upliftPts.hi).toBeGreaterThanOrEqual(many.upliftPts.mean);
    expect(few.effectSource).toBe("planning");
  });
  it("uses the measured wave-1 effect once Track has run", () => {
    const tracked = runTrackStage(st);
    const r = whatIf(tracked, { practice, schoolIds: targets, crps: 3 });
    expect(r.assumptions.some((a) => a.startsWith("Adoption from wave 1"))).toBe(true);
    expect(["wave1", "planning"]).toContain(r.effectSource);
  });
  it("is honest when nothing can be visited", () => {
    const r = whatIf(st, { practice, schoolIds: targets, crps: 0 });
    expect(r.visited).toBe(0);
    expect(r.schools).toBe(targets.length);
  });
});
