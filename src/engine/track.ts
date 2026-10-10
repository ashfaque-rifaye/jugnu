// TRACK: did it spread, and did it work? The simulator plays out one term: follow-up calls,
// adoption, and the next assessment cycle (only the simulator knows true effects). The
// analysis side sees only follow-ups and scores: wave 1 vs wave 2 (not yet started) gives a
// fair difference-in-differences per practice, with a bootstrap interval.
import { measured, rateFor } from "./block";
import { PRACTICES, type PracticeId } from "./practices";
import { chance, mulberry32, pick, type Rng } from "./rng";
import { CYCLES, type Block, type FollowUp, type Recommendation, type TrackResult } from "./types";

const SAID: Record<FollowUp["outcome"], { hi: string; en: string }[]> = {
  adopted: [
    { hi: "हाँ, दो हफ़्ते से रोज़ कर रहे हैं। बच्चे खुद आकर बैठ जाते हैं।", en: "Yes, doing it daily for two weeks. Children now sit down for it on their own." },
    { hi: "{demo} जी का स्कूल देखकर आसान लगा। अब रोज़ होता है।", en: "Seeing it in {demo}'s school made it easy. Now it happens every day." },
  ],
  trying: [{ hi: "शुरू किया है, पर अभी हफ़्ते में दो-तीन दिन ही हो पाता है।", en: "Started, but only two or three days a week so far." }],
  barrier: [
    { hi: "बच्चे बहुत ज़्यादा हैं और मैं अकेली शिक्षिका हूँ — समय नहीं मिलता।", en: "Too many children and I'm the only teacher — no time." },
    { hi: "सर्वे की ड्यूटी लग गई थी, दो हफ़्ते स्कूल कम आ पाए।", en: "I was put on survey duty and couldn't be in school much for two weeks." },
  ],
  no_answer: [{ hi: "(फ़ोन नहीं उठा — कल फिर कोशिश)", en: "(No answer — will retry tomorrow)" }],
};

export interface SimulatedTerm {
  followUps: FollowUp[];
  adopted: Set<string>;
  nextScores: Record<string, { reading: number; numeracy: number }>;
}

export function simulateTerm(block: Block, recs: Recommendation[], seed = 11): SimulatedTerm {
  if (!block.truth) throw new Error("Simulation needs hidden truth");
  const rng: Rng = mulberry32(seed);
  const followUps: FollowUp[] = [];
  const adopted = new Set<string>();
  const recBy = new Map(recs.map((r) => [r.schoolId, r]));
  const nextScores: SimulatedTerm["nextScores"] = {};
  for (const s of block.schools) {
    const t = block.truth[s.id];
    const rec = recBy.get(s.id);
    let practices = t.practices;
    let fidelity = t.fidelity;
    if (rec && rec.wave === 1) {
      const visited = chance(rng, 0.8);
      const p = 0.42 + (visited ? 0.28 : 0);
      const outcome: FollowUp["outcome"] = chance(rng, 0.08) ? "no_answer" : chance(rng, p) ? "adopted" : chance(rng, 0.5) ? "trying" : "barrier";
      const line = pick(rng, SAID[outcome]);
      const demo = block.schools.find((x) => x.id === rec.demonstratorId)?.teacher.split(" ")[0] ?? "";
      followUps.push({ schoolId: s.id, day: 14, outcome, said: line.hi.replace("{demo}", demo), saidEn: line.en.replace("{demo}", demo) });
      if (outcome === "adopted" || (outcome === "trying" && chance(rng, 0.4)) || (outcome === "no_answer" && chance(rng, 0.4))) {
        adopted.add(s.id);
        practices = [...new Set([...practices, rec.practice])];
        fidelity = Math.max(fidelity, 0.65 + rng() * 0.25);
      }
    }
    const cycle = CYCLES.length;
    nextScores[s.id] = {
      reading: measured(rng, rateFor(s, { practices, fidelity, schoolEffect: t.schoolEffect }, "reading", cycle), s.grade3),
      numeracy: measured(rng, rateFor(s, { practices, fidelity, schoolEffect: t.schoolEffect }, "numeracy", cycle), s.grade3),
    };
    if (t.inflated) {
      nextScores[s.id].reading = Math.min(98, nextScores[s.id].reading + 35);
      nextScores[s.id].numeracy = Math.min(98, nextScores[s.id].numeracy + 35);
    }
  }
  return { followUps, adopted, nextScores };
}

/** Analysis without hidden truth: wave 1 (recommended now) vs wave 2 (same recommendation, next term). */
export function analyzeImpact(block: Block, recs: Recommendation[], term: Pick<SimulatedTerm, "followUps" | "nextScores">, seed = 3): TrackResult {
  const rng = mulberry32(seed);
  const last = CYCLES.length - 1;
  const change = (id: string) => {
    const s = block.schools.find((x) => x.id === id)!;
    const n = term.nextScores[id];
    // Change against the mean of the last two cycles — a steadier baseline than one noisy year.
    const base = (k: "reading" | "numeracy") => (s[k][last] + s[k][last - 1]) / 2;
    return (n.reading - base("reading") + (n.numeracy - base("numeracy"))) / 2;
  };
  const did = (a: string[], b: string[]) => {
    const mean = (xs: string[]) => xs.reduce((acc, id) => acc + change(id), 0) / Math.max(1, xs.length);
    const est = mean(a) - mean(b);
    const boots: number[] = [];
    for (let i = 0; i < 400; i++) {
      const ra = a.map(() => a[Math.floor(rng() * a.length)]);
      const rb = b.map(() => b[Math.floor(rng() * b.length)]);
      boots.push(mean(ra) - mean(rb));
    }
    boots.sort((x, y) => x - y);
    return { effect: Math.round(est * 10) / 10, ci: [Math.round(boots[10] * 10) / 10, Math.round(boots[389] * 10) / 10] as [number, number] };
  };
  const practices = [...new Set(recs.map((r) => r.practice))];
  const byPractice = practices.map((practice) => {
    const w1 = recs.filter((r) => r.practice === practice && r.wave === 1).map((r) => r.schoolId);
    const w2 = recs.filter((r) => r.practice === practice && r.wave === 2).map((r) => r.schoolId);
    const adopters = term.followUps.filter((f) => w1.includes(f.schoolId) && f.outcome === "adopted").length;
    const { effect, ci } = w1.length && w2.length ? did(w1, w2) : { effect: 0, ci: [0, 0] as [number, number] };
    return { practice: practice as PracticeId, wave1: w1.length, adopters, effect, ci };
  });
  const all1 = recs.filter((r) => r.wave === 1).map((r) => r.schoolId);
  const all2 = recs.filter((r) => r.wave === 2).map((r) => r.schoolId);
  return { followUps: term.followUps, nextScores: term.nextScores, byPractice, overall: did(all1, all2) };
}

/** Simulation-only: the true average effect (percentage points) of adding a practice in these schools. */
export function trueEffectPts(block: Block, practice: PracticeId, schoolIds: string[]): number {
  if (!block.truth) return 0;
  const cycle = CYCLES.length;
  let sum = 0;
  for (const id of schoolIds) {
    const s = block.schools.find((x) => x.id === id)!;
    const t = block.truth[id];
    const base = (rateFor(s, t, "reading", cycle) + rateFor(s, t, "numeracy", cycle)) / 2;
    const withP = { ...t, practices: [...new Set([...t.practices, practice])], fidelity: Math.max(t.fidelity, 0.78) };
    const after = (rateFor(s, withP, "reading", cycle) + rateFor(s, withP, "numeracy", cycle)) / 2;
    sum += (after - base) * 100;
  }
  return Math.round((sum / Math.max(1, schoolIds.length)) * 10) / 10;
}

export const practiceLabel = (p: PracticeId) => PRACTICES[p].label;
