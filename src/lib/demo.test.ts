import { describe, expect, it } from "vitest";
import { generateBlock } from "../engine/block";
import { runPipeline, runTrackStage } from "../engine/pipeline";
import { buildTerm } from "./demo";

describe("play the term", () => {
  const state = runPipeline(generateBlock(2024));
  const beats = buildTerm(state)!;
  const wave1 = state.recs.filter((r) => r.wave === 1);

  it("walks the loop in order and ends with the next assessment", () => {
    expect(beats.map((b) => b.key)).toEqual(["results", "checks", "notes", "visits", "calls", "assess"]);
    expect(beats.at(-1)!.track).toBe(true);
  });

  it("checks exactly the schools still waiting for a spot check", () => {
    const pending = state.verify.filter((v) => v.spotCheck.sampled === 0).map((v) => v.schoolId);
    const checks = beats.find((b) => b.key === "checks")!.events;
    expect(checks.map((e) => e.ref).sort()).toEqual(pending.sort());
    for (const e of checks) expect(e.payload.sampled).toBe(15);
  });

  it("reaches and calls back every wave-1 school, with the same calls the term simulation makes", () => {
    const notes = beats.find((b) => b.key === "notes")!.events;
    const calls = beats.find((b) => b.key === "calls")!.events;
    expect(notes).toHaveLength(wave1.length);
    expect(new Set(calls.map((e) => e.ref))).toEqual(new Set(wave1.map((r) => r.schoolId)));
    const tracked = runTrackStage(state).track!;
    for (const e of calls) expect(e.payload.outcome).toBe(tracked.followUps.find((f) => f.schoolId === e.ref)!.outcome);
  });

  it("is not offered for imported data (no simulator behind it)", () => {
    expect(buildTerm({ ...state, block: { ...state.block, truth: null } })).toBeNull();
  });
});
