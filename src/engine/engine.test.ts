import { describe, expect, it } from "vitest";
import { generateBlock } from "./block";
import { codeInterview, FOLLOW_UP, nextQuestion, SCRIPT } from "./interview";
import { evaluate, runPipeline, runTrackStage } from "./pipeline";
import { EFFECTIVE, specificity } from "./practices";

describe("interview coding", () => {
  it("scores concrete routines as specific and vague claims as not", () => {
    expect(specificity("रोज़ 10 मिनट तीलियों के बंडल से गिनती-बातचीत — बच्चे बंडल खोलकर बताते हैं")).toBeGreaterThanOrEqual(2);
    expect(specificity("गिनती करवाते हैं।")).toBeLessThan(2);
  });
  it("codes a teacher's answer into the practice taxonomy", () => {
    const m = codeInterview([{ speaker: "teacher", text: "रोज़ पहले 45 मिनट हम बच्चों को कक्षा से नहीं, स्तर से बाँटते हैं। हर सोमवार समूह फिर से बनाते हैं।" }]);
    expect(m.map((x) => x.practice)).toContain("level_groups");
  });
  it("follows up when a practice is named without specifics", () => {
    const q = nextQuestion([
      { speaker: "jugnu", text: SCRIPT[0].hi },
      { speaker: "teacher", text: "हाँ, कभी-कभी समूह बना देते हैं।" },
    ]);
    expect(q?.text).toBe(FOLLOW_UP.hi);
  });
});

describe("the Jugnu loop on simulated blocks (calibrated to ASER 2024)", () => {
  const runs = [2024, 7, 42, 99].map((seed) => runTrackStage(runPipeline(generateBlock(seed))));
  it("finds candidate bright spots and catches inflated data", () => {
    for (const st of runs) {
      const ev = evaluate(st)!;
      expect(st.find.candidates.length).toBeGreaterThan(5);
      expect(ev.verification.inflatedCaught / Math.max(1, ev.verification.inflatedTotal)).toBeGreaterThanOrEqual(0.6);
    }
  });
  it("never calls a decoy practice distinctive", () => {
    for (const st of runs) {
      const ev = evaluate(st)!;
      expect(ev.practices.falseDistinctive).toEqual([]);
      for (const e of st.evidence.filter((x) => x.verdict === "distinctive")) expect(EFFECTIVE).toContain(e.practice);
    }
  });
  it("finds at least two genuinely effective practices", () => {
    for (const st of runs) expect(evaluate(st)!.practices.found.length).toBeGreaterThanOrEqual(2);
  });
  it("gives every struggling school a nearby demonstrator and owned actions", () => {
    for (const st of runs) {
      expect(st.recs.length).toBe(st.find.struggling.length);
      for (const r of st.recs) {
        expect(r.distanceKm).toBeLessThan(40);
        expect(r.actions.map((a) => a.ownerRole)).toEqual(["Jugnu AI", "CRP", "Jugnu AI", "BEO"]);
      }
    }
  });
  it("estimates a positive overall effect on average across blocks", () => {
    const mean = runs.reduce((a, st) => a + st.track!.overall.effect, 0) / runs.length;
    expect(mean).toBeGreaterThan(0);
  });
});
