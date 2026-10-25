import { describe, expect, it } from "vitest";
import { generateBlock } from "./block";
import { DAMOH, govtElementary, profileFor } from "./district";
import { summariseBlock } from "./rollup";

describe("Damoh district (UDISE+ profiles)", () => {
  it("builds each real block at its real size, deterministically", () => {
    for (const p of DAMOH) {
      const b = generateBlock(p.code);
      expect(b.schools.length).toBe(govtElementary(p));
      expect(b.name).toBe(`${p.block} Block`);
      expect(b.state).toBe("Madhya Pradesh");
      expect(new Set(b.schools.map((s) => s.village)).size).toBe(b.schools.length);
    }
    expect(JSON.stringify(generateBlock(231205).schools.slice(0, 5))).toBe(JSON.stringify(generateBlock(231205).schools.slice(0, 5)));
  });

  it("follows the profile: more tribal schools where ST enrolment is higher", () => {
    const tribal = (code: number) => generateBlock(code).schools.filter((s) => s.langMismatch >= 0.45).length / govtElementary(profileFor(code)!);
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
});
