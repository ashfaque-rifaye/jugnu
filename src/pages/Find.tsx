import { Box, Check, Map as MapIcon, RefreshCw, X } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { BlockMap, ExpectedScatter } from "../components/charts";
import { Glass, SectionTitle, StatTile, VerdictChip, cx } from "../components/ui";
import { HeroMedia } from "../components/media";
import { MEDIA } from "../lib/clips";
import { CYCLES } from "../engine/types";
import { usePipeline } from "../lib/store";

const Block3D = lazy(() => import("../components/Block3D"));

export default function FindPage() {
  const [view3d, setView3d] = useState(true);
  const { state, evaluation, regenerate, seed, selected, select } = usePipeline();
  const { block, find, verify } = state;
  const last = CYCLES.length - 1;
  const meanZ = useMemo(() => Object.fromEntries(block.schools.map((s) => [s.id, find.z[s.id].reduce((a, b) => a + b, 0) / find.z[s.id].length])), [block, find]);
  const bright = new Set(verify.filter((v) => v.verdict === "verified").map((v) => v.schoolId));
  const inflated = new Set(verify.filter((v) => v.verdict === "inflation_suspected").map((v) => v.schoolId));
  const struggling = new Set(find.struggling);
  const school = block.schools.find((s) => s.id === selected);
  const points = block.schools.map((s) => ({
    id: s.id,
    name: s.name,
    expected: (find.expected[s.id].reading[last] + find.expected[s.id].numeracy[last]) / 2,
    reported: (s.reading[last] + s.numeracy[last]) / 2,
    bright: bright.has(s.id),
    inflated: inflated.has(s.id),
  }));

  return (
    <div className="space-y-5">
      <HeroMedia video={MEDIA.map} className="p-5 md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <div className="label">
              Step 1 · {block.name} · {block.source === "simulated" ? `simulated, calibrated to ASER 2024 · seed ${seed}` : "imported data"}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Who beats their context — year after year?</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-2)]">
              Expected results come from context the state already holds (multigrade, school size, library, attendance, home-language mismatch, pupil–teacher ratio). A candidate must beat expectation in at least 2 of 3
              assessment cycles.
            </p>
          </div>
          {block.source === "simulated" && (
            <button className="btn btn-glass" onClick={() => regenerate()}>
              <RefreshCw size={16} /> New block
            </button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile label="Schools" value={block.schools.length} sub={`${new Set(block.schools.map((s) => s.clusterName)).size} clusters`} />
          <StatTile label="Context explains" value={`${Math.round(((find.r2.reading + find.r2.numeracy) / 2) * 100)}%`} sub="of variation — the rest is what schools DO" />
          <StatTile label="Candidates" value={find.candidates.length} sub="above expectation ≥ 2 of 3 years" accent="#fde68a" />
          <StatTile label="Verified bright spots" value={bright.size} sub="passed spot checks" accent="#bef264" />
          <StatTile
            label="Data may be inflated"
            value={inflated.size}
            sub={evaluation ? `${evaluation.verification.inflatedCaught} of ${evaluation.verification.inflatedTotal} planted cases caught` : "spot check disagreed"}
            accent="#fca5a5"
          />
        </div>
      </HeroMedia>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Glass className="p-5">
          <SectionTitle
            eyebrow="Block map"
            title="Fireflies in the dark"
            sub={
              view3d
                ? "Pillar height = average results vs expectation. Gold glow = verified bright spot. Ring = needs support. Red = data may be inflated. Drag to orbit, click a pillar."
                : "Colour = average results vs expectation (red below · grey as expected · blue above). Glow = verified bright spot. Dashed ring = needs support. ⚠ = data may be inflated."
            }
            right={
              <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1">
                <button className={cx("flex items-center gap-1 rounded-full px-3 py-1.5 text-sm", view3d ? "bg-white/15 text-white" : "text-[var(--color-ink-2)]")} onClick={() => setView3d(true)}>
                  <Box size={14} aria-hidden /> 3D
                </button>
                <button className={cx("flex items-center gap-1 rounded-full px-3 py-1.5 text-sm", !view3d ? "bg-white/15 text-white" : "text-[var(--color-ink-2)]")} onClick={() => setView3d(false)}>
                  <MapIcon size={14} aria-hidden /> 2D
                </button>
              </div>
            }
          />
          {view3d ? (
            <Suspense fallback={<div className="grid h-[440px] place-items-center text-sm text-[var(--color-ink-3)]">Loading 3D block…</div>}>
              <Block3D className="h-[460px] w-full" schools={block.schools} z={meanZ} bright={bright} inflated={inflated} struggling={struggling} selected={selected} onSelect={select} autoRotate={false} />
            </Suspense>
          ) : (
            <BlockMap schools={block.schools} z={meanZ} bright={bright} inflated={inflated} struggling={struggling} selected={selected} onSelect={select} />
          )}
        </Glass>
        <Glass className="p-5">
          <SectionTitle eyebrow={`Latest cycle · ${CYCLES[last]}`} title="Expected vs reported" sub="Points far above the dashed line do better than their context predicts. Click one." />
          <ExpectedScatter points={points} onSelect={select} />
        </Glass>
      </div>

      {school && (
        <Glass className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="label">
                {school.clusterName} cluster · CRP {school.crp}
              </div>
              <h3 className="text-xl font-bold">
                {school.name} <span className="text-sm font-normal text-[var(--color-ink-2)]">· {school.teacher}</span>
              </h3>
            </div>
            {verify.find((v) => v.schoolId === school.id) && <VerdictChip verdict={verify.find((v) => v.schoolId === school.id)!.verdict} />}
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <div className="glass-inset p-3 text-sm">
              <div className="label mb-1">Context</div>
              {school.enrolment} children · PTR {school.ptr} · {school.multigrade ? "multigrade" : "grade-wise"} · library {school.library ? "in use" : "not in use"} · attendance {Math.round(school.attendance * 100)}% ·
              home-language mismatch {Math.round(school.langMismatch * 100)}%
            </div>
            <div className="glass-inset p-3 text-sm md:col-span-2">
              <div className="label mb-1">Grade 3 proficient (reported vs expected)</div>
              <div className="grid grid-cols-3 gap-2 tabular-nums">
                {CYCLES.map((c, i) => (
                  <div key={c}>
                    <div className="text-xs text-[var(--color-ink-3)]">{c}</div>
                    Reading {school.reading[i]}% <span className="text-[var(--color-ink-3)]">/ {find.expected[school.id].reading[i].toFixed(0)}%</span>
                    <br />
                    Maths {school.numeracy[i]}% <span className="text-[var(--color-ink-3)]">/ {find.expected[school.id].numeracy[i].toFixed(0)}%</span>
                    <br />
                    <span className={cx("text-xs", find.z[school.id][i] >= 1 ? "text-sky-300" : find.z[school.id][i] <= -0.5 ? "text-rose-300" : "text-[var(--color-ink-3)]")}>
                      {find.z[school.id][i] >= 0 ? "+" : ""}
                      {find.z[school.id][i].toFixed(1)} SD
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Glass>
      )}

      <Glass className="p-5">
        <SectionTitle eyebrow="Step 1b · Verify" title="A bright spot must be real before it is celebrated" sub="Consistency checks on the data, then a 15-minute spot check by the cluster resource person: 15 Grade-3 children, one reading and one subtraction task." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-ink-3)]">
                <th className="pb-2">School</th>
                <th className="pb-2">Checks</th>
                <th className="pb-2">Spot check</th>
                <th className="pb-2">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {verify.map((v) => {
                const s = block.schools.find((x) => x.id === v.schoolId)!;
                return (
                  <tr key={v.schoolId} className="cursor-pointer border-t border-white/8 hover:bg-white/5" onClick={() => select(v.schoolId)}>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-[var(--color-ink-3)]">
                        {s.clusterName} · {s.teacher}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        {v.checks.map((c) => (
                          <span key={c.name} className="chip font-normal" title={c.detail}>
                            {c.passed ? <Check size={12} className="text-emerald-300" aria-hidden /> : <X size={12} className="text-rose-300" aria-hidden />}
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums text-[var(--color-ink-2)]">
                      {v.spotCheck.sampled
                        ? `read ${v.spotCheck.proficient}/${v.spotCheck.sampled} (reported ${Math.round(v.spotCheck.reported * 100)}%) · maths ${v.spotCheck.numeracyProficient}/${v.spotCheck.sampled} (reported ${Math.round(v.spotCheck.numeracyReported * 100)}%)`
                        : "pending"}
                    </td>
                    <td className="py-2">
                      <VerdictChip verdict={v.verdict} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Glass>

      <Glass className="p-5">
        <SectionTitle eyebrow="Transparent model" title="What context explains" sub="Ordinary least squares, pooled over three cycles with year effects; residuals standardised with a robust scale so a few inflated schools cannot hide real bright spots." />
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {find.coefficients.slice(1).map((c) => (
            <div key={c.feature} className="glass-inset flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-[var(--color-ink-2)]">{c.feature}</span>
              <span className="tabular-nums">
                {c.reading >= 0 ? "+" : ""}
                {c.reading.toFixed(1)} / {c.numeracy >= 0 ? "+" : ""}
                {c.numeracy.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--color-ink-3)]">Coefficients in percentage points (reading / maths). Attendance per 1.0 = 100 points; PTR per 10 children.</p>
      </Glass>
    </div>
  );
}
