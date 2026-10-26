// FIND: which schools do much better than their context predicts — consistently?
// Ordinary least squares on context the state already holds (UDISE+-style fields), pooled
// over cycles with cycle effects. A school is a candidate "bright spot" only if its residual
// is high in at least two of three cycles — one good year is not a bright spot.
import { CYCLES, type Block, type FindResult, type School } from "./types";

const FEATURES: { key: string; label: string; get: (s: School) => number }[] = [
  { key: "multigrade", label: "Multigrade classroom", get: (s) => Number(s.multigrade) },
  { key: "small", label: "Small school (< 60)", get: (s) => Number(s.enrolment < 60) },
  { key: "library", label: "Library books in use", get: (s) => Number(s.library) },
  { key: "attendance", label: "Student attendance", get: (s) => s.attendance },
  { key: "langMismatch", label: "Home-language mismatch", get: (s) => s.langMismatch },
  { key: "ptr", label: "Pupil–teacher ratio", get: (s) => s.ptr / 10 },
];

function solve(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-9;
    for (let k = c; k <= n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row) => row[n]);
}

function ols(X: number[][], y: number[], ridge = 1e-3) {
  const p = X[0].length;
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  for (let a = 1; a < p; a++) XtX[a][a] += ridge;
  return solve(XtX, Xty);
}

export function runFind(block: Block): FindResult {
  const rows: { s: School; cycle: number; x: number[] }[] = [];
  for (const s of block.schools) {
    CYCLES.forEach((_, cycle) => {
      rows.push({ s, cycle, x: [1, ...FEATURES.map((f) => f.get(s)), ...CYCLES.slice(1).map((__, k) => Number(cycle === k + 1))] });
    });
  }
  const fit = (which: "reading" | "numeracy") => {
    const X = rows.map((r) => r.x);
    const y = rows.map((r) => r.s[which][r.cycle]);
    const beta = ols(X, y);
    const pred = X.map((x) => x.reduce((acc, v, i) => acc + v * beta[i], 0));
    const resid = y.map((v, i) => v - pred[i]);
    const mean = y.reduce((a, b) => a + b, 0) / y.length;
    const ssTot = y.reduce((a, v) => a + (v - mean) ** 2, 0);
    const ssRes = resid.reduce((a, v) => a + v * v, 0);
    // Robust scale (1.4826 × median absolute deviation): a few inflated schools must not
    // stretch the yardstick and hide genuine bright spots.
    const med = (xs: number[]) => {
      const a = [...xs].sort((p, q) => p - q);
      return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
    };
    const center = med(resid);
    const sd = 1.4826 * med(resid.map((r) => Math.abs(r - center))) || Math.sqrt(ssRes / Math.max(1, y.length - beta.length));
    return { beta, pred, resid, sd, r2: 1 - ssRes / ssTot };
  };
  const R = fit("reading");
  const N = fit("numeracy");

  const expected: FindResult["expected"] = {};
  const z: FindResult["z"] = {};
  rows.forEach((r, i) => {
    const e = (expected[r.s.id] ??= { reading: [], numeracy: [] });
    e.reading[r.cycle] = Math.round(R.pred[i] * 10) / 10;
    e.numeracy[r.cycle] = Math.round(N.pred[i] * 10) / 10;
    (z[r.s.id] ??= [])[r.cycle] = (R.resid[i] / R.sd + N.resid[i] / N.sd) / 2;
  });

  const candidates = block.schools
    .filter((s) => {
      const zs = z[s.id];
      const high = zs.filter((v) => v >= 1.0).length;
      const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
      return high >= 2 && mean >= 0.9;
    })
    .sort((a, b) => z[b.id].reduce((x, y) => x + y, 0) - z[a.id].reduce((x, y) => x + y, 0))
    .map((s) => s.id);
  const struggling = block.schools.filter((s) => z[s.id][CYCLES.length - 1] <= -0.5 && !candidates.includes(s.id)).map((s) => s.id);

  return {
    coefficients: [{ feature: "Intercept", reading: R.beta[0], numeracy: N.beta[0] }, ...FEATURES.map((f, i) => ({ feature: f.label, reading: R.beta[i + 1], numeracy: N.beta[i + 1] }))],
    r2: { reading: R.r2, numeracy: N.r2 },
    expected,
    z,
    candidates,
    struggling,
  };
}

/** Comparison schools: similar context, ordinary results — the contrast that makes practices visible. */
/** Each school's context features, standardised across the block — the space comparisons are matched in. */
export function featureVector(block: Block): (s: School) => number[] {
  const std = FEATURES.map((f) => {
    const vals = block.schools.map(f.get);
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, v) => a + (v - m) ** 2, 0) / vals.length) || 1;
    return { f, m, sd };
  });
  return (s: School) => std.map(({ f, m, sd }) => (f.get(s) - m) / sd);
}

export function matchComparisons(block: Block, find: FindResult, brightIds: string[], perBright = 1.5): string[] {
  const vec = featureVector(block);
  const ordinary = block.schools.filter((s) => {
    const mean = find.z[s.id].reduce((a, b) => a + b, 0) / find.z[s.id].length;
    return !find.candidates.includes(s.id) && mean > -0.8 && mean < 0.3;
  });
  const chosen = new Set<string>();
  const want = Math.round(brightIds.length * perBright);
  let round = 0;
  while (chosen.size < want && round < 4) {
    for (const id of brightIds) {
      if (chosen.size >= want) break;
      const b = block.schools.find((s) => s.id === id)!;
      const vb = vec(b);
      const best = ordinary
        .filter((s) => !chosen.has(s.id))
        .map((s) => ({ s, d: vec(s).reduce((acc, v, i) => acc + (v - vb[i]) ** 2, 0) }))
        .sort((x, y) => x.d - y.d)[0];
      if (best) chosen.add(best.s.id);
    }
    round++;
  }
  return [...chosen];
}

export const FIND_FEATURES = FEATURES.map((f) => f.label);
