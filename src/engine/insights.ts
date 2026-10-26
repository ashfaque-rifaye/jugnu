// Two views the officer asks for once the loop has run:
//
// PAIRS — each verified bright spot beside the ordinary school most like it (same context features
// the comparisons were matched on), with what each teacher said about every practice. This is the
// contrast the statistics summarise, shown one pair at a time so the officer can read it.
//
// WHAT-IF — "if CRPs take these schools to see this practice, what should we expect?" A Monte Carlo
// over three uncertainties: whether the practice really matters (its probability of being
// distinctive), whether each school adopts it (higher with a peer visit, and visits are limited by
// CRP time and road distance), and how big the effect is (measured in wave 1 when Track has run,
// otherwise a cautious planning figure that is labelled as such).
import { featureVector } from "./find";
import { trip } from "./geo";
import { PRACTICE_IDS, PRACTICES, type PracticeId } from "./practices";
import { mulberry32, type Rng } from "./rng";
import type { PipelineState } from "./pipeline";
import type { School } from "./types";

export interface PairSide {
  schoolId: string;
  /** latest reported minus expected, percentage points (reading, numeracy) */
  aboveExpected: { reading: number; numeracy: number };
}

export interface ContrastPair {
  bright: PairSide;
  comparison: PairSide;
  /** distance in the matching space; lower is a closer match */
  distance: number;
  roadKm: number;
  /** context features on which the two schools agree */
  alike: string[];
  practices: { practice: PracticeId; bright: string | null; comparison: string | null; distinctive: boolean }[];
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export function contrastPairs(st: PipelineState): ContrastPair[] {
  const byId = new Map(st.block.schools.map((s) => [s.id, s]));
  const vec = featureVector(st.block);
  const said = new Map(st.interviews.map((i) => [i.schoolId, i]));
  const distinctive = new Set(st.evidence.filter((e) => e.verdict === "distinctive").map((e) => e.practice));
  const last = (s: School) => {
    const n = s.reading.length - 1;
    return { reading: r1(s.reading[n] - st.find.expected[s.id].reading[n]), numeracy: r1(s.numeracy[n] - st.find.expected[s.id].numeracy[n]) };
  };
  const quote = (id: string, p: PracticeId) => {
    const m = said.get(id)?.mentions.filter((x) => x.practice === p).sort((a, b) => b.specificity - a.specificity)[0];
    return m ? m.quote : null;
  };
  const comparisons = st.comparison.map((id) => byId.get(id)!).filter(Boolean);
  if (!comparisons.length) return [];

  return st.bright
    .filter((id) => said.has(id))
    .map((id) => {
      const b = byId.get(id)!;
      const vb = vec(b);
      const best = comparisons
        .map((c) => ({ c, d: Math.sqrt(vec(c).reduce((acc, v, i) => acc + (v - vb[i]) ** 2, 0)) }))
        .sort((x, y) => x.d - y.d)[0];
      const c = best.c;
      const alike = [
        b.multigrade === c.multigrade && (b.multigrade ? "both multigrade" : "both single-grade"),
        Math.abs(b.enrolment - c.enrolment) <= Math.max(20, b.enrolment * 0.25) && "similar enrolment",
        Math.abs(b.attendance - c.attendance) <= 0.06 && "similar attendance",
        Math.abs(b.langMismatch - c.langMismatch) <= 0.15 && "similar home-language mix",
        Math.abs(b.ptr - c.ptr) <= 8 && "similar pupil–teacher ratio",
        b.library === c.library && (b.library ? "both use library books" : "neither uses library books"),
      ].filter((x): x is string => Boolean(x));
      return {
        bright: { schoolId: b.id, aboveExpected: last(b) },
        comparison: { schoolId: c.id, aboveExpected: last(c) },
        distance: r1(best.d),
        roadKm: trip(b, c).roadKm,
        alike,
        practices: PRACTICE_IDS.map((p) => ({ practice: p, bright: quote(b.id, p), comparison: quote(c.id, p), distinctive: distinctive.has(p) })).filter(
          (x) => x.bright || x.comparison,
        ),
      };
    })
    .sort((x, y) => x.distance - y.distance);
}

export interface WhatIfInput {
  practice: PracticeId;
  schoolIds: string[];
  crps: number;
  /** CRP days per person given to peer visits in this 14-day cycle */
  daysEach?: number;
}

export interface Range {
  mean: number;
  lo: number;
  hi: number;
}

export interface WhatIfResult {
  practice: PracticeId;
  schools: number;
  visited: number;
  demonstrators: number;
  pMatters: number;
  effectSource: "wave1" | "planning";
  adopters: Range;
  /** average change across the chosen schools, percentage points of Grade 3 proficiency */
  upliftPts: Range;
  childrenReached: Range;
  perSchool: { schoolId: string; demonstratorId: string | null; roadKm: number | null; visited: boolean; pAdopt: number }[];
  assumptions: string[];
}

const VISIT_MIN_AT_SCHOOL = 180;
const MINUTES_PER_DAY = 360;
const PLANNING_EFFECT = { mean: 4, se: 2.5 };
const PRIOR_ADOPT = { visited: 0.7, notVisited: 0.42 };

const normal = (rng: Rng) => Math.sqrt(-2 * Math.log(rng() || 1e-12)) * Math.cos(2 * Math.PI * rng());
const range = (xs: number[], digits = 1): Range => {
  const s = [...xs].sort((a, b) => a - b);
  const f = 10 ** digits;
  const at = (q: number) => Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))] * f) / f;
  return { mean: Math.round((s.reduce((a, b) => a + b, 0) / s.length) * f) / f, lo: at(0.05), hi: at(0.95) };
};

export function whatIf(st: PipelineState, input: WhatIfInput, draws = 2000): WhatIfResult {
  const byId = new Map(st.block.schools.map((s) => [s.id, s]));
  const targets = [...new Set(input.schoolIds)].map((id) => byId.get(id)).filter((s): s is School => Boolean(s));
  const ev = st.evidence.find((e) => e.practice === input.practice);
  const label = PRACTICES[input.practice].label;
  const assumptions: string[] = [];

  // Demonstrators: bright spots whose teachers described the practice specifically.
  const demos = st.interviews
    .filter((i) => i.group !== "comparison" && st.bright.includes(i.schoolId) && i.mentions.some((m) => m.practice === input.practice && m.specificity >= 2))
    .map((i) => byId.get(i.schoolId)!)
    .filter(Boolean);

  // Peer visits fit into CRP time, nearest demonstrator first.
  const budget = Math.max(0, input.crps) * (input.daysEach ?? 3) * MINUTES_PER_DAY;
  const legs = targets.map((s) => {
    const best = demos.filter((d) => d.id !== s.id).map((d) => ({ d, t: trip(s, d) })).sort((a, b) => a.t.minutes - b.t.minutes)[0];
    return { s, demo: best?.d ?? null, t: best?.t ?? null };
  });
  let used = 0;
  const visited = new Set<string>();
  for (const l of [...legs].filter((l) => l.t).sort((a, b) => a.t!.minutes - b.t!.minutes)) {
    const cost = 2 * l.t!.minutes + VISIT_MIN_AT_SCHOOL;
    if (used + cost > budget) continue;
    used += cost;
    visited.add(l.s.id);
  }

  // Adoption: observed in wave 1 when follow-ups exist, otherwise the pilot's planning figures.
  let pVisited = PRIOR_ADOPT.visited;
  let pNot = PRIOR_ADOPT.notVisited;
  const fu = st.track?.followUps.filter((f) => f.outcome !== "no_answer") ?? [];
  if (fu.length >= 5) {
    const observed = fu.filter((f) => f.outcome === "adopted").length / fu.length;
    pVisited = Math.min(0.95, observed * 1.15);
    pNot = Math.min(pVisited, observed * 0.7);
    assumptions.push(`Adoption from wave 1: ${Math.round(observed * 100)}% of teachers reached had adopted by day 14.`);
  } else {
    assumptions.push(`Adoption is a planning figure until wave 1 reports: ${PRIOR_ADOPT.visited * 100}% with a peer visit, ${PRIOR_ADOPT.notVisited * 100}% with the voice note alone.`);
  }

  // Effect per adopting school.
  const row = st.track?.byPractice.find((b) => b.practice === input.practice && b.adopters > 0);
  let effect = PLANNING_EFFECT;
  let source: WhatIfResult["effectSource"] = "planning";
  if (row) {
    const share = row.adopters / Math.max(1, row.wave1);
    effect = { mean: row.effect / share, se: Math.max(0.5, (row.ci[1] - row.ci[0]) / 3.92 / share) };
    source = "wave1";
    assumptions.push(`Effect measured in wave 1 (difference-in-differences): ${row.effect} points [${row.ci[0]}, ${row.ci[1]}] per recommended school.`);
  } else {
    assumptions.push(`Effect is a cautious planning figure until wave 1 is measured: ${PLANNING_EFFECT.mean} ± ${PLANNING_EFFECT.se * 2} points per adopting school.`);
  }
  const pMatters = source === "wave1" ? 1 : (ev?.pDistinctive ?? 0);
  if (source === "planning") assumptions.push(`${label} is distinctive with probability ${Math.round(pMatters * 100)}% (bright spots vs matched comparisons); the rest of the time it is assumed to do nothing.`);
  assumptions.push(`A peer visit costs the CRP the round trip by motorbike plus ${VISIT_MIN_AT_SCHOOL / 60} hours; each CRP gives ${input.daysEach ?? 3} days of the fortnight.`);
  if (!demos.length) assumptions.push(`No bright spot has described ${label} in detail yet, so no peer visits are possible.`);

  const perSchool = legs.map((l) => ({
    schoolId: l.s.id,
    demonstratorId: l.demo?.id ?? null,
    roadKm: l.t?.roadKm ?? null,
    visited: visited.has(l.s.id),
    pAdopt: visited.has(l.s.id) ? pVisited : pNot,
  }));

  const rng = mulberry32(7 + targets.length * 31 + input.crps);
  const adopters: number[] = [];
  const uplift: number[] = [];
  const children: number[] = [];
  for (let d = 0; d < draws; d++) {
    const matters = rng() < pMatters ? 1 : 0;
    const e = effect.mean + effect.se * normal(rng);
    let a = 0, kids = 0, gain = 0;
    perSchool.forEach((p, i) => {
      if (rng() < p.pAdopt) {
        a++;
        kids += targets[i].enrolment;
        gain += matters * e;
      }
    });
    adopters.push(a);
    uplift.push(targets.length ? gain / targets.length : 0);
    children.push(kids);
  }

  return {
    practice: input.practice,
    schools: targets.length,
    visited: visited.size,
    demonstrators: demos.length,
    pMatters: Math.round(pMatters * 100) / 100,
    effectSource: source,
    adopters: range(adopters, 0),
    upliftPts: range(uplift),
    childrenReached: range(children, 0),
    perSchool,
    assumptions,
  };
}
