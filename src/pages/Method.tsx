import { Download, FlaskConical, Loader2, Play, Upload } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Glass, SectionTitle } from "../components/ui";
import { HeroMedia } from "../components/media";
import { MEDIA } from "../lib/clips";
import { ASER_2024, generateBlock } from "../engine/block";
import { evaluate, runPipeline, runTrackStage, type Evaluation } from "../engine/pipeline";
import { PRACTICES } from "../engine/practices";
import { CSV_COLUMNS, parseCsv, templateCsv } from "../lib/csv";
import { usePipeline } from "../lib/store";

export default function MethodPage() {
  const { state, importBlock, regenerate } = usePipeline();
  const nav = useNavigate();
  const [err, setErr] = useState("");

  const download = () => {
    const blob = new Blob([templateCsv(state.block)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "jugnu-block-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const onFile = async (f: File) => {
    setErr("");
    try {
      importBlock(parseCsv(await f.text()));
      nav("/find");
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <HeroMedia video={MEDIA.pillars} className="p-6 md:p-7">
        <SectionTitle
          eyebrow="Data & method"
          title="What is real, what is simulated, and how to plug in your block"
          sub="The method runs on data states already hold. For the demo, the block is simulated — calibrated to real national figures — so we can plant known bright spots, inflated data and decoy practices, and score Jugnu against them."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="glass-inset p-4 text-sm">
            <div className="label mb-2">Real (ASER 2024, rural India)</div>
            <ul className="space-y-1.5 text-[var(--color-ink-2)]">
              <li>Std III reading at Std II level, govt schools: <b className="text-white">{(ASER_2024.std3ReadingGovt * 100).toFixed(1)}%</b></li>
              <li>Std III subtraction (all schools): <b className="text-white">{(ASER_2024.std3Subtraction * 100).toFixed(1)}%</b></li>
              <li>Govt primary schools with &lt; 60 students: <b className="text-white">{(ASER_2024.smallSchoolShare * 100).toFixed(1)}%</b></li>
              <li>Std I–II classrooms multigrade: <b className="text-white">two-thirds</b></li>
              <li>Average student attendance: <b className="text-white">{(ASER_2024.studentAttendance * 100).toFixed(1)}%</b></li>
              <li>Library books in use: <b className="text-white">{(ASER_2024.libraryInUse * 100).toFixed(1)}%</b></li>
              <li>Schools with an FLN directive: <b className="text-white">{(ASER_2024.flnDirective * 100).toFixed(1)}%</b></li>
            </ul>
            <div className="mt-2 text-xs text-[var(--color-ink-3)]">Source: ASER 2024 national findings (Pratham / ASER Centre, Jan 2025).</div>
          </div>
          <div className="glass-inset p-4 text-sm">
            <div className="label mb-2">Simulated (so the method can be scored)</div>
            <ul className="space-y-1.5 text-[var(--color-ink-2)]">
              <li>200 schools in 10 clusters, context distributions set from the figures on the left.</li>
              <li>~9% of schools run 2–3 effective practices well (the true bright spots).</li>
              <li>6 schools report inflated scores in the last two cycles.</li>
              <li>Decoy practices everyone claims (lesson-plan compliance, worksheets, weekly tests) have zero effect.</li>
              <li>Teacher interviews generated from each school's hidden practices, with vague and generic answers mixed in.</li>
            </ul>
          </div>
          <div className="glass-inset p-4 text-sm">
            <div className="label mb-2">Your block (real data)</div>
            <p className="text-[var(--color-ink-2)]">Export school-level FLN results for three cycles plus UDISE+ context from your state command centre, and run Find & Verify immediately. Interviews then run in the field.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-glass" onClick={download}>
                <Download size={15} /> CSV template
              </button>
              <label className="btn btn-primary cursor-pointer">
                <Upload size={15} /> Import CSV
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              </label>
              {state.block.source === "imported" && (
                <button className="btn btn-glass" onClick={() => regenerate(2024)}>
                  Back to simulated block
                </button>
              )}
            </div>
            {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
            <details className="mt-2 text-xs text-[var(--color-ink-3)]">
              <summary className="cursor-pointer">Columns</summary>
              {CSV_COLUMNS.join(", ")}
            </details>
          </div>
        </div>
      </HeroMedia>

      <div className="grid gap-5 lg:grid-cols-2">
        <Glass className="p-5">
          <SectionTitle eyebrow="Where AI is used" title="AI layers" />
          <ul className="space-y-3 text-sm text-[var(--color-ink-2)]">
            <li><b className="text-white">Statistics (Find/Verify/Track)</b> — context model with robust residuals, binomial spot-check test, Beta-Binomial practice contrast, stepped-wedge difference-in-differences with bootstrap intervals.</li>
            <li><b className="text-white">Claude as interviewer</b> — adaptive 12-minute voice interviews in Hindi or English; asks one follow-up whenever a practice is named without specifics.</li>
            <li><b className="text-white">Claude as coder</b> — maps transcripts to the practice taxonomy with verbatim quotes and a specificity score; proposes new practices outside the taxonomy.</li>
            <li><b className="text-white">Claude as writer</b> — polishes peer voice notes without changing facts; briefs the officer grounded only in block evidence.</li>
          </ul>
        </Glass>
        <Glass className="p-5">
          <SectionTitle eyebrow="Guardrails & compliance" title="Built to be trusted by teachers" />
          <ul className="space-y-3 text-sm text-[var(--color-ink-2)]">
            <li>Adults only, with consent; no child-level personal data — only school-level results and a 15-child anonymous spot check.</li>
            <li>No public ranking; struggling schools are never named outside the block team. Bright-spot teachers are credited only with permission.</li>
            <li>A bright spot is never celebrated before verification; suspected inflation goes to a respectful revisit, not a penalty.</li>
            <li>Practices are hypotheses until the next cycle confirms them; the Track step can demote a practice.</li>
            <li>LLM outputs are schema-constrained; if Claude is unavailable or declines, the offline engine continues.</li>
          </ul>
        </Glass>
      </div>

      <Evaluation />
    </div>
  );
}

function Evaluation() {
  const [rows, setRows] = useState<{ seed: number; ev: Evaluation; effect: number; ci: [number, number] }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    setTimeout(() => {
      setRows(
        [2024, 7, 42, 99, 314].map((seed) => {
          const st = runTrackStage(runPipeline(generateBlock(seed)));
          return { seed, ev: evaluate(st)!, effect: st.track!.overall.effect, ci: st.track!.overall.ci };
        }),
      );
      setBusy(false);
    }, 30);
  };
  return (
    <Glass className="p-5">
      <SectionTitle
        eyebrow="Evaluation · runs in your browser"
        title="Five blocks, scored against what was planted"
        right={
          <button className="btn btn-primary" onClick={run} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run evaluation
          </button>
        }
      />
      {rows ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-[var(--color-ink-3)]">
                <th className="pb-2">Block</th>
                <th className="pb-2">Candidates (true / inflated / noise)</th>
                <th className="pb-2">Inflated caught</th>
                <th className="pb-2">Effective practices found</th>
                <th className="pb-2">Decoys promoted</th>
                <th className="pb-2">Overall effect (95% CI)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ seed, ev, effect, ci }) => (
                <tr key={seed} className="border-t border-white/8">
                  <td className="py-2">seed {seed}</td>
                  <td>
                    {ev.candidates.total} ({ev.candidates.trulyBright} / {ev.candidates.inflated} / {ev.candidates.other})
                  </td>
                  <td>
                    {ev.verification.inflatedCaught}/{ev.verification.inflatedTotal}
                  </td>
                  <td className="text-xs">{ev.practices.found.map((p) => PRACTICES[p].label).join(", ") || "—"}</td>
                  <td>{ev.practices.falseDistinctive.length}</td>
                  <td>
                    {effect > 0 ? "+" : ""}
                    {effect} pts ({ci[0]} to {ci[1]})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-inset flex items-center gap-3 p-4 text-sm text-[var(--color-ink-2)]">
          <FlaskConical size={18} className="text-teal-300" aria-hidden /> Runs the full loop on five simulated blocks (1,000 schools) and scores every step.
        </div>
      )}
    </Glass>
  );
}
