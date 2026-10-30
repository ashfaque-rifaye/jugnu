import { describe, expect, it } from "vitest";
import { generateBlock } from "./block";
import { runPipeline, runTrackStage } from "./pipeline";
import { DAMOH, profileFor } from "./district";
import { UDISE } from "./udise";
import { summariseBlock } from "./rollup";

describe("Damoh district (UDISE+ profiles)", () => {
  it("builds each real block from its real UDISE+ schools, deterministically", () => {
    for (const p of DAMOH) {
      const b = generateBlock(p.code);
      expect(b.schools.length).toBe(UDISE[p.block].schools.length);
      expect(b.name).toBe(`${p.block} Block`);
      expect(b.state).toBe("Madhya Pradesh");
      expect(new Set(b.schools.map((s) => s.udise)).size).toBe(b.schools.length);
      expect(new Set(b.schools.map((s) => s.clusterName)).size).toBe(UDISE[p.block].clusters.length);
    }
    expect(JSON.stringify(generateBlock(231205).schools.slice(0, 5))).toBe(JSON.stringify(generateBlock(231205).schools.slice(0, 5)));
  });

  it("follows the profile: more tribal schools where ST enrolment is higher", () => {
    const tribal = (code: number) => generateBlock(code).schools.filter((s) => s.langMismatch >= 0.45).length / generateBlock(code).schools.length;
    expect(tribal(231205)).toBeGreaterThan(tribal(231202)); // Tendukheda 29.5% ST vs Patharia 4.5%
  });

  it("leaves ordinary seeds as they were", () => {
    expect(profileFor(2024)).toBeNull();
    expect(generateBlock(2024).name).toBe("Sonagaon Block");
    expect(generateBlock(2024).schools).toHaveLength(200);
  });

  it("never runs out of village names in a big block", () => {
    expect(new Set(generateBlock(7, 420).schools.map((s) => s.village)).size).toBe(420);
  });

  it("finds verified bright spots in the largest block", () => {
    const s = summariseBlock(profileFor(231203)!);
    expect(s.schools).toBeGreaterThan(300);
    expect(s.verified).toBeGreaterThan(0);
  });

  it("gives every real block a working demo: bright spots, a support plan and a result", () => {
    for (const p of DAMOH) {
      const st = runPipeline(generateBlock(p.code));
      expect(st.bright.length, p.block).toBeGreaterThanOrEqual(4);
      expect(st.evidence.some((e) => e.verdict === "distinctive"), p.block).toBe(true);
      expect(st.recs.length, p.block).toBeGreaterThan(0);
      expect(runTrackStage(st).track, p.block).not.toBeNull();
    }
  });
});
