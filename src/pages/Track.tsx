import { Eye, EyeOff, Play, PhoneCall } from "lucide-react";
import { useState } from "react";
import { EffectBars } from "../components/charts";
import { Glass, SectionTitle, StatTile, cx } from "../components/ui";
import { HeroMedia } from "../components/media";
import { MEDIA } from "../lib/clips";
import { PRACTICES } from "../engine/practices";
import { NEXT_CYCLE } from "../engine/types";
import { usePipeline } from "../lib/store";

const OUTCOME = {
  adopted: { label: "Adopted", tone: "#0ca30c" },
  trying: { label: "Trying", tone: "#fab219" },
  barrier: { label: "Barrier", tone: "#d03b3b" },
  no_answer: { label: "No answer", tone: "#9ca3af" },
} as const;

export default function TrackPage() {
  const { state, runTrack } = usePipeline();
  const [reveal, setReveal] = useState(false);
  const t = state.track;
  const name = (id: string) => state.block.schools.find((s) => s.id === id);

  if (!state.block.truth) return <Glass className="p-8 text-center text-[var(--color-ink-2)]">Tracking needs the next assessment cycle for your imported block.</Glass>;

  return (
    <div className="space-y-5">
      <HeroMedia video={MEDIA.officer} className="p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="label">Step 5 · Track</div>
            <h1 className="text-2xl font-extrabold tracking-tight">Did it spread — and did it work?</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-2)]">
              Jugnu calls every wave-1 teacher after two weeks (“Did you try it? What happened?”). At the next assessment ({NEXT_CYCLE}), each practice is judged by wave 1 vs wave 2 — schools with the same recommendation
              that had not started yet. Change is measured against each school's two-year baseline; intervals are 95% bootstrap.
            </p>
          </div>
          {!t ? (
            <button className="btn btn-primary" onClick={runTrack}>
              <Play size={16} /> Play out one term
            </button>
          ) : (
            <button className="btn btn-glass" onClick={() => setReveal((v) => !v)}>
              {reveal ? <Eye size={16} /> : <EyeOff size={16} />} {reveal ? "Hiding truth markers" : "Compare with hidden truth"}
            </button>
          )}
        </div>
      </HeroMedia>

      {t && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Follow-up calls" value={t.followUps.length} sub="made by Jugnu at day 14" />
            <StatTile label="Adopted" value={t.followUps.filter((f) => f.outcome === "adopted").length} sub={`${t.followUps.filter((f) => f.outcome === "trying").length} still trying`} accent="#bef264" />
            <StatTile label="Stuck — escalated" value={t.followUps.filter((f) => f.outcome === "barrier").length} sub="barrier sent to the BEO" accent="#fca5a5" />
            <StatTile
              label="Overall effect (wave 1 vs 2)"
              value={`${t.overall.effect > 0 ? "+" : ""}${t.overall.effect} pts`}
              sub={`95% interval ${t.overall.ci[0]} to ${t.overall.ci[1]}`}
              accent="#7dd3fc"
            />
          </div>

          <Glass className="p-5">
            <SectionTitle
              eyebrow="Which practices transfer?"
              title="Estimated effect per practice (percentage points)"
              sub="Bar = difference-in-differences, wave 1 vs wave 2, averaged over reading and maths; line = 95% interval. Blue when the whole interval is above zero. One term is an early signal — the next cycle adds power."
            />
            <EffectBars
              rows={t.byPractice.map((b) => ({
                label: `${PRACTICES[b.practice].label} (${b.adopters}/${b.wave1} adopted)`,
                effect: b.effect,
                ci: b.ci,
                truth: reveal ? b.trueEffect : undefined,
              }))}
            />
            {reveal && <p className="mt-2 text-xs text-[var(--color-ink-3)]">Gold tick = the true average effect in these wave-1 schools given who actually adopted (known only to the simulator).</p>}
          </Glass>

          <Glass className="p-5">
            <SectionTitle eyebrow="Day 14" title="What teachers said on the follow-up call" />
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {t.followUps.map((f) => {
                const s = name(f.schoolId)!;
                const rec = state.recs.find((r) => r.schoolId === f.schoolId)!;
                return (
                  <div key={f.schoolId} className="glass-inset p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{s.teacher}</span>
                      <span className="chip" style={{ borderColor: `${OUTCOME[f.outcome].tone}88`, color: OUTCOME[f.outcome].tone }}>
                        <PhoneCall size={11} aria-hidden /> {OUTCOME[f.outcome].label}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-ink-3)]">
                      {s.name} · {PRACTICES[rec.practice].label}
                    </div>
                    <div className={cx("mt-2 font-deva")}>{f.said}</div>
                    <div className="text-xs text-[var(--color-ink-3)]">{f.saidEn}</div>
                  </div>
                );
              })}
            </div>
          </Glass>
        </>
      )}
    </div>
  );
}
