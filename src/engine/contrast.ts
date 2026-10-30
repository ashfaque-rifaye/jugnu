// CONTRAST: which practices are specific to bright spots — not just common everywhere?
// For each practice, the share of interviews describing it SPECIFICALLY (≥ 2 concrete cues) is
// compared between bright spots and matched comparison schools with a Beta-Binomial model.
import { PRACTICE_IDS, PRACTICES } from "./practices";
import { mulberry32 } from "./rng";
import type { Interview, PracticeEvidence } from "./types";

function betaSample(rng: () => number, a: number, b: number): number {
  // Beta via two Gamma draws (Marsaglia–Tsang), a,b >= 1 here.
  const gamma = (k: number) => {
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number, v: number;
      do {
        const u1 = rng() || 1e-12, u2 = rng();
        x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = rng();
      if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  const x = gamma(a);
  const y = gamma(b);
  return x / (x + y);
}

export function runContrast(interviews: Interview[]): PracticeEvidence[] {
  const bright = interviews.filter((i) => i.group === "bright");
  const comp = interviews.filter((i) => i.group === "comparison");
  const rng = mulberry32(99);
  const specific = (i: Interview, p: string) => i.mentions.some((m) => m.practice === p && m.specificity >= 2);
  const any = (i: Interview, p: string) => i.mentions.some((m) => m.practice === p);

  return PRACTICE_IDS.map((practice) => {
    const kb = bright.filter((i) => specific(i, practice)).length;
    const kc = comp.filter((i) => specific(i, practice)).length;
    const nb = bright.length, nc = comp.length;
    let wins = 0;
    const draws = 3000;
    for (let d = 0; d < draws; d++) if (betaSample(rng, 1 + kb, 1 + nb - kb) > betaSample(rng, 1 + kc, 1 + nc - kc)) wins++;
    const pDistinctive = wins / draws;
    const pb = (kb + 0.5) / (nb + 1);
    const pc = (kc + 0.5) / (nc + 1);
    const lift = pb / pc;
    const anyB = bright.filter((i) => any(i, practice)).length / Math.max(1, nb);
    const anyC = comp.filter((i) => any(i, practice)).length / Math.max(1, nc);
    let verdict: PracticeEvidence["verdict"];
    if (anyB >= 0.5 && anyC >= 0.5 && pDistinctive < 0.9) verdict = "common_everywhere";
    else if (pDistinctive >= 0.9 && lift >= 2 && kb >= 2) verdict = "distinctive";
    else if (kb + kc < 3) verdict = "not_enough_evidence";
    else verdict = "no_difference";
    const quotes = bright
      .flatMap((i) => i.mentions.filter((m) => m.practice === practice && m.specificity >= 2).map((m) => ({ schoolId: i.schoolId, quote: m.quote, s: m.specificity })))
      .sort((a, b) => b.s - a.s)
      .filter((q, i, all) => all.findIndex((x) => x.quote === q.quote) === i)
      .slice(0, 3)
      .map(({ schoolId, quote }) => ({ schoolId, quote }));
    const costWeight = PRACTICES[practice].cost === "zero" ? 1 : PRACTICES[practice].cost === "low" ? 0.9 : 0.7;
    return { practice, bright: { k: kb, n: nb }, comparison: { k: kc, n: nc }, lift, pDistinctive, verdict, quotes, score: pDistinctive * Math.log2(1 + lift) * costWeight };
  }).sort((a, b) => Number(b.verdict === "distinctive") - Number(a.verdict === "distinctive") || b.score - a.score);
}
