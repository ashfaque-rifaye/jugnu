// The home page tells Jugnu through ONE practice travelling through the block — a real bright
// spot, the school it reaches, and every step in between — taken live from the block's state.
import type { PipelineState } from "../engine/pipeline";
import { PRACTICES, type PracticeId } from "../engine/practices";
import { CYCLES, type Action, type FollowUp, type Interview, type PracticeEvidence, type Recommendation, type School } from "../engine/types";

export interface Story {
  bright: School;
  recipient: School;
  practice: PracticeId;
  measure: "reading" | "numeracy";
  /** expected vs reported % proficient, one pair per assessment cycle */
  years: { cycle: string; expected: number; actual: number }[];
  yearsAbove: number;
  spot: { sampled: number; proficient: number; reported: number };
  interview: Interview;
  quote: { hi: string; en?: string };
  evidence: PracticeEvidence;
  rec: Recommendation;
  visit?: Action;
  call?: Action;
  followUp?: FollowUp;
}

export function pickStory(state: PipelineState, followUps: FollowUp[] = []): Story | null {
  const byId = new Map(state.block.schools.map((s) => [s.id, s]));
  const distinctive = state.evidence.filter((e) => e.verdict === "distinctive").sort((a, b) => b.score - a.score);
  const heard = (id: string) => state.interviews.find((i) => i.schoolId === id && i.group !== "comparison");
  const followUpFor = (id: string) => followUps.find((f) => f.schoolId === id) ?? state.track?.followUps.find((f) => f.schoolId === id);

  for (const evidence of distinctive) {
    const recs = state.recs.filter((r) => r.practice === evidence.practice && r.wave === 1 && heard(r.demonstratorId)?.mentions.some((m) => m.practice === evidence.practice));
    if (!recs.length) continue;
    // The demonstrator who reaches the most schools; their nearest school, preferring one already called back.
    const count = new Map<string, number>();
    for (const r of recs) count.set(r.demonstratorId, (count.get(r.demonstratorId) ?? 0) + 1);
    const demoId = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    const mine = recs.filter((r) => r.demonstratorId === demoId).sort((a, b) => Number(!!followUpFor(b.schoolId)) - Number(!!followUpFor(a.schoolId)) || a.distanceKm - b.distanceKm);
    const rec = mine[0];
    const bright = byId.get(demoId);
    const recipient = byId.get(rec.schoolId);
    const interview = heard(demoId);
    const v = state.verify.find((x) => x.schoolId === demoId);
    if (!bright || !recipient || !interview || !v) continue;

    const outcome = PRACTICES[evidence.practice].outcome;
    const measure = outcome === "numeracy" ? "numeracy" : "reading";
    const years = CYCLES.map((cycle, i) => ({ cycle, expected: Math.round(state.find.expected[demoId][measure][i]), actual: Math.round(bright[measure][i]) }));
    const mention = interview.mentions.filter((m) => m.practice === evidence.practice).sort((a, b) => b.specificity - a.specificity)[0];
    const turn = interview.turns.find((t) => t.speaker === "teacher" && t.text === mention.quote);
    const sc = v.spotCheck;
    return {
      bright,
      recipient,
      practice: evidence.practice,
      measure,
      years,
      yearsAbove: state.find.z[demoId].filter((z) => z >= 1).length,
      // (the spot check stores the reported rate as a fraction)
      spot: { sampled: sc.sampled, proficient: measure === "reading" ? sc.proficient : sc.numeracyProficient, reported: Math.round((measure === "reading" ? sc.reported : sc.numeracyReported) * 100) },
      interview,
      quote: { hi: mention.quote, en: turn?.textEn },
      evidence,
      rec,
      visit: rec.actions.find((a) => a.id.endsWith("-visit")),
      call: rec.actions.find((a) => a.id.endsWith("-call")),
      followUp: followUpFor(rec.schoolId),
    };
  }
  return null;
}

/** The whole block as one flow from data to action: how many schools are at each step. */
export function loopCounts(state: PipelineState, followUps: FollowUp[] = []) {
  const recorded = new Map((state.track?.followUps ?? []).map((f) => [f.schoolId, f]));
  for (const f of followUps) recorded.set(f.schoolId, f);
  const calls = [...recorded.values()];
  return {
    schools: state.block.schools.length,
    candidates: state.find.candidates.length,
    checksDue: state.verify.filter((v) => v.spotCheck.sampled === 0).length,
    bright: state.bright.length,
    heard: state.interviews.filter((i) => i.group !== "comparison").length,
    practices: state.evidence.filter((e) => e.verdict === "distinctive").length,
    support: state.recs.length,
    reached: state.recs.filter((r) => r.actions.some((a) => a.id.endsWith("-note") && a.status === "done")).length,
    calls: calls.length,
    working: calls.filter((f) => f.outcome === "adopted" || f.outcome === "trying").length,
  };
}
