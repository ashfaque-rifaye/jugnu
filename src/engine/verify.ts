// VERIFY: a bright spot must be real before it is celebrated. Reported data can be inflated
// ("the great fiction" of classroom data), so each candidate gets consistency checks and a
// 15-minute cluster-resource-person spot check: 15 Grade-3 children, an ASER-style reading task and a subtraction task.
import { CYCLES, type Block, type FindResult, type VerifyResult } from "./types";

function binomTail(k: number, n: number, p: number): number {
  // P(X <= k) for X ~ Binomial(n, p)
  let sum = 0;
  let c = 1;
  for (let i = 0; i <= n; i++) {
    if (i > 0) c = (c * (n - i + 1)) / i;
    if (i <= k) sum += c * p ** i * (1 - p) ** (n - i);
  }
  return Math.min(1, sum);
}

export type SpotCheck = (schoolId: string) => { sampled: number; proficient: number; numeracyProficient: number } | null;

export function runVerify(block: Block, find: FindResult, spotCheck: SpotCheck): VerifyResult[] {
  const last = CYCLES.length - 1;
  return find.candidates.map((id) => {
    const s = block.schools.find((x) => x.id === id)!;
    const checks: VerifyResult["checks"] = [];
    const jump = Math.max(s.reading[1] - s.reading[0], s.reading[2] - s.reading[1]);
    // Allow for sampling noise: a class of 8 swings far more than a class of 40.
    const allowed = Math.round(20 + 200 * Math.sqrt(0.25 / Math.max(4, s.grade3)));
    checks.push({
      name: "No sudden jump",
      passed: jump < allowed,
      detail: jump < allowed ? `Largest year-on-year change ${jump.toFixed(0)} pts (noise allowance ${allowed})` : `Reading jumped ${jump.toFixed(0)} points in one year (noise allowance ${allowed})`,
    });
    const high = find.z[id].filter((v) => v >= 0.9).length;
    checks.push({ name: "Consistent over years", passed: high === 3, detail: `Above expectation in ${high} of 3 cycles` });
    const ceiling = s.reading[last] >= 90 && (s.multigrade || s.langMismatch > 0.4);
    checks.push({ name: "Plausible level for context", passed: !ceiling, detail: ceiling ? `${s.reading[last]}% in a ${s.multigrade ? "multigrade" : "high-language-mismatch"} school is rare` : "Within range seen in similar schools" });

    const sc = spotCheck(id);
    const reported = s.reading[last] / 100;
    const numeracyReported = s.numeracy[last] / 100;
    let pValue = 1;
    let numeracyPValue = 1;
    let verdict: VerifyResult["verdict"] = "revisit";
    if (sc) {
      pValue = binomTail(sc.proficient, sc.sampled, Math.min(0.99, reported));
      numeracyPValue = binomTail(sc.numeracyProficient, sc.sampled, Math.min(0.99, numeracyReported));
      const contradicted = Math.min(pValue, numeracyPValue) < 0.01 || Math.max(pValue, numeracyPValue) < 0.05;
      checks.push({
        name: "Spot check matches",
        passed: !contradicted,
        detail: `${sc.proficient}/${sc.sampled} read a Std II text (reported ${Math.round(reported * 100)}%), ${sc.numeracyProficient}/${sc.sampled} did 2-digit subtraction (reported ${Math.round(numeracyReported * 100)}%)`,
      });
      const failed = checks.filter((c) => !c.passed).map((c) => c.name);
      // Only field evidence (the spot check) can mark data as inflated — small schools swing a lot by chance.
      if (contradicted) verdict = "inflation_suspected";
      else if (failed.length <= 1) verdict = "verified";
      else verdict = "revisit";
    } else {
      checks.push({ name: "Spot check", passed: false, detail: "Pending — ask the cluster resource person to visit" });
    }
    return {
      schoolId: id,
      verdict,
      checks,
      spotCheck: { sampled: sc?.sampled ?? 0, proficient: sc?.proficient ?? 0, reported, pValue, numeracyProficient: sc?.numeracyProficient ?? 0, numeracyReported, numeracyPValue },
    };
  });
}
