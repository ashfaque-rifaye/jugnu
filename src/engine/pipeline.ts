// The whole loop: Find → Verify → Ask → Contrast → Spread → Track.
import { generateBlock, rateFor } from "./block";
import { runContrast } from "./contrast";
import { matchComparisons, runFind } from "./find";
import { simulateInterview } from "./interview";
import { EFFECTIVE, PRACTICES, type PracticeId } from "./practices";
import { mulberry32 } from "./rng";
import { runSpread } from "./spread";
import { analyzeImpact, simulateTerm, trueEffectPts } from "./track";
import { CYCLES, type Block, type FindResult, type Interview, type PracticeEvidence, type Recommendation, type TrackResult, type VerifyResult } from "./types";
import { runVerify, type SpotCheck } from "./verify";

export interface PipelineState {
  block: Block;
  find: FindResult;
  verify: VerifyResult[];
  bright: string[];
  comparison: string[];
  interviews: Interview[];
  evidence: PracticeEvidence[];
  recs: Recommendation[];
  track: TrackResult | null;
  adopted: string[];
}

export function simulatedSpotCheck(block: Block, seed = 17): SpotCheck {
  const rng = mulberry32(seed);
  return (id) => {
    const t = block.truth?.[id];
    if (!t) return null;
    const pr = t.trueReading[CYCLES.length - 1];
    const pn = t.trueNumeracy[CYCLES.length - 1];
    let k = 0;
    let kn = 0;
    for (let i = 0; i < 15; i++) {
      if (rng() < pr) k++;
      if (rng() < pn) kn++;
    }
    return { sampled: 15, proficient: k, numeracyProficient: kn };
  };
}

/** What happened in the field, on top of the block's data. */
export interface FieldData {
  /** Spot checks recorded by cluster resource people — they replace the simulated ones. */
  spotChecks?: Record<string, { sampled: number; proficient: number; numeracyProficient: number }>;
  /** Real interviews from the live pilot, linked to schools in this block. */
  live?: Interview[];
}

/**
 * In the demo block a few candidates still wait for their spot check, so a CRP can do that step for
 * real. They are chosen among candidates the simulated checks would NOT have verified (several have
 * inflated data), so the demo's evidence about what works stays the same.
 */
export function demoPending(block: Block, notVerified: string[]): Set<string> {
  if (!block.truth) return new Set();
  return new Set(notVerified.slice(0, 3));
}

export function runPipeline(block: Block = generateBlock(), field: FieldData = {}): PipelineState {
  const find = runFind(block);
  // Simulated spot checks are drawn once, in candidate order, so recording one school never reshuffles another.
  const sim = simulatedSpotCheck(block);
  const drawn = new Map(find.candidates.map((id) => [id, sim(id)]));
  const simulated = runVerify(block, find, (id) => drawn.get(id) ?? null);
  const pending = demoPending(block, simulated.filter((v) => v.verdict !== "verified").map((v) => v.schoolId));
  const history: SpotCheck = (id) => (pending.has(id) ? null : (drawn.get(id) ?? null));
  const verify = runVerify(block, find, (id) => field.spotChecks?.[id] ?? history(id));
  const bright = verify.filter((v) => v.verdict === "verified").map((v) => v.schoolId);
  const comparison = matchComparisons(block, find, bright);

  // The demo's interview history covers the schools verified before anyone touched the block;
  // a school verified today still needs its interview (a real one, from the live pilot).
  const interviews: Interview[] = [];
  if (block.truth) {
    const before = runVerify(block, find, history).filter((v) => v.verdict === "verified").map((v) => v.schoolId);
    const beforeComparison = matchComparisons(block, find, before);
    const rng = mulberry32(block.seed + 31);
    for (const id of before) interviews.push(simulateInterview(block.schools.find((s) => s.id === id)!, block.truth[id], "bright", rng));
    for (const id of beforeComparison) interviews.push(simulateInterview(block.schools.find((s) => s.id === id)!, block.truth[id], "comparison", rng));
  }
  // A real interview replaces the simulated one for the same school.
  for (const live of field.live ?? []) {
    const i = interviews.findIndex((x) => x.schoolId === live.schoolId);
    if (i >= 0) interviews.splice(i, 1);
    interviews.push(live);
  }
  const evidence = runContrast(interviews);
  const recs = runSpread(block, find, evidence, interviews);
  return { block, find, verify, bright, comparison, interviews, evidence, recs, track: null, adopted: [] };
}

export function runTrackStage(state: PipelineState): PipelineState {
  const term = simulateTerm(state.block, state.recs);
  const track = analyzeImpact(state.block, state.recs, term);
  for (const row of track.byPractice) {
    const w1 = state.recs.filter((r) => r.practice === row.practice && r.wave === 1).map((r) => r.schoolId);
    const adoptedShare = w1.length ? w1.filter((id) => term.adopted.has(id)).length / w1.length : 0;
    row.trueEffect = Math.round(trueEffectPts(state.block, row.practice, w1) * adoptedShare * 10) / 10;
  }
  const recs = state.recs.map((r) => ({
    ...r,
    actions: r.actions.map((a) => {
      if (r.wave !== 1) return a;
      const f = term.followUps.find((x) => x.schoolId === r.schoolId);
      if (a.id.endsWith("-note")) return { ...a, status: "done" as const };
      if (a.id.endsWith("-visit")) return { ...a, status: f && f.outcome !== "no_answer" ? ("done" as const) : ("scheduled" as const) };
      if (a.id.endsWith("-call")) return { ...a, status: f?.outcome === "barrier" ? ("stuck" as const) : f?.outcome === "no_answer" ? ("scheduled" as const) : ("done" as const), note: f?.saidEn };
      return a;
    }),
  }));
  return { ...state, recs, track, adopted: [...term.adopted] };
}

export interface Evaluation {
  candidates: { total: number; trulyBright: number; inflated: number; other: number };
  verification: { inflatedCaught: number; inflatedTotal: number; brightVerified: number; brightCandidates: number };
  practices: { found: PracticeId[]; missed: PracticeId[]; falseDistinctive: PracticeId[]; decoysCorrect: number; decoys: number };
}

export function evaluate(state: PipelineState): Evaluation | null {
  const t = state.block.truth;
  if (!t) return null;
  // "Truly bright" = its practices lift expected proficiency by at least 10 points (hidden truth).
  const last = CYCLES.length - 1;
  const isBright = (id: string) => {
    const s = state.block.schools.find((x) => x.id === id)!;
    const none = { ...t[id], practices: t[id].practices.filter((p) => !EFFECTIVE.includes(p)) };
    const uplift = (rateFor(s, t[id], "reading", last) + rateFor(s, t[id], "numeracy", last) - rateFor(s, none, "reading", last) - rateFor(s, none, "numeracy", last)) / 2;
    return uplift >= 0.1 && !t[id].inflated;
  };
  const cands = state.find.candidates;
  // Only a spot check can catch inflated data, so schools still waiting for theirs are not counted.
  const checked = new Set(state.verify.filter((v) => v.spotCheck.sampled > 0).map((v) => v.schoolId));
  const inflatedCands = cands.filter((id) => t[id].inflated && checked.has(id));
  const brightCands = cands.filter(isBright);
  const distinctive = state.evidence.filter((e) => e.verdict === "distinctive").map((e) => e.practice);
  const strongEffective: PracticeId[] = EFFECTIVE.filter((p) => p !== "print_wall");
  const decoys = (Object.keys(PRACTICES) as PracticeId[]).filter((p) => !EFFECTIVE.includes(p));
  return {
    candidates: { total: cands.length, trulyBright: brightCands.length, inflated: inflatedCands.length, other: cands.length - brightCands.length - inflatedCands.length },
    verification: {
      inflatedCaught: state.verify.filter((v) => v.verdict === "inflation_suspected" && t[v.schoolId].inflated).length,
      inflatedTotal: inflatedCands.length,
      brightVerified: state.verify.filter((v) => v.verdict === "verified" && isBright(v.schoolId)).length,
      brightCandidates: brightCands.length,
    },
    practices: {
      found: distinctive.filter((p) => strongEffective.includes(p)),
      missed: strongEffective.filter((p) => !distinctive.includes(p)),
      falseDistinctive: distinctive.filter((p) => decoys.includes(p)),
      decoysCorrect: decoys.filter((p) => !distinctive.includes(p)).length,
      decoys: decoys.length,
    },
  };
}
