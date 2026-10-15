import { describe, expect, it } from "vitest";
import { generateBlock } from "../engine/block";
import { runPipeline } from "../engine/pipeline";
import { loopCounts, pickStory } from "./story";

describe("home page story", () => {
  const state = runPipeline(generateBlock(2024));
  const story = pickStory(state)!;

  it("follows a verified bright spot to a school it supports", () => {
    expect(story).not.toBeNull();
    expect(state.bright).toContain(story.bright.id);
    expect(story.rec.demonstratorId).toBe(story.bright.id);
    expect(story.rec.schoolId).toBe(story.recipient.id);
    expect(story.rec.practice).toBe(story.practice);
    expect(story.evidence.verdict).toBe("distinctive");
  });

  it("quotes the teacher and reports the spot check as percentages", () => {
    expect(story.quote.hi.length).toBeGreaterThan(10);
    expect(story.years).toHaveLength(3);
    expect(story.spot.sampled).toBeGreaterThan(0);
    expect(story.spot.reported).toBeGreaterThan(1);
    expect(story.spot.reported).toBeLessThanOrEqual(100);
  });

  it("counts the block from data to action", () => {
    const c = loopCounts(state);
    expect(c.schools).toBe(state.block.schools.length);
    expect(c.bright).toBeLessThanOrEqual(c.candidates);
    expect(c.support).toBe(state.recs.length);
    expect(c.calls).toBe(0);
  });
});
