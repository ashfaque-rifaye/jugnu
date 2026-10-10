import { Loader2, Pause, Sparkles, Volume2 } from "lucide-react";
import { useMemo, useState } from "react";
import { BlockMap } from "../components/charts";
import { Glass, SectionTitle, StatTile, cx } from "../components/ui";
import { HeroMedia } from "../components/media";
import { MEDIA } from "../lib/clips";
import { PRACTICES } from "../engine/practices";
import type { Action, Recommendation } from "../engine/types";
import { postJSON, useStatus } from "../lib/api";
import { usePipeline } from "../lib/store";
import { speak, stopSpeaking } from "../lib/speech";

const COLUMNS: { key: Action["status"]; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "scheduled", label: "Scheduled" },
  { key: "done", label: "Done" },
  { key: "stuck", label: "Stuck — needs the BEO" },
];

export default function SpreadPage() {
  const { state, selected, select } = usePipeline();
  const { block, find, recs } = state;
  const [wave, setWave] = useState<1 | 2>(1);
  const byId = useMemo(() => new Map(block.schools.map((s) => [s.id, s])), [block]);
  const meanZ = useMemo(() => Object.fromEntries(block.schools.map((s) => [s.id, find.z[s.id].reduce((a, b) => a + b, 0) / 3])), [block, find]);
  const bright = new Set(state.bright);
  const waveRecs = recs.filter((r) => r.wave === wave);
  const actions = waveRecs.flatMap((r) => r.actions);
  const avgKm = recs.length ? recs.reduce((a, r) => a + r.distanceKm, 0) / recs.length : 0;
  const practiceCounts = recs.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.practice]: (acc[r.practice] ?? 0) + 1 }), {});
  const current = recs.find((r) => r.schoolId === selected) ?? waveRecs[0];

  if (!recs.length) return <Glass className="p-8 text-center text-[var(--color-ink-2)]">No distinctive practices yet — nothing to spread. Interview more bright spots first.</Glass>;

  return (
    <div className="space-y-5">
      <HeroMedia video={MEDIA.spread} className="p-5 md:p-7">
        <div className="label">Step 4 · Spread — sideways, not top-down</div>
        <h1 className="text-2xl font-extrabold tracking-tight">Every struggling school gets one practice, one nearby teacher, and owners</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-2)]">
          The practice is chosen for the school's gap (reading or maths) and context (home languages, attendance). The demonstrator is the nearest bright-spot teacher who already does it; their own words become a 60-second
          voice note. Schools start in two waves, so wave 2 is the fair comparison that tells us whether wave 1 improved.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Schools supported" value={recs.length} sub={`${recs.filter((r) => r.wave === 1).length} in wave 1 · ${recs.filter((r) => r.wave === 2).length} in wave 2`} />
          <StatTile label="Average distance" value={`${avgKm.toFixed(1)} km`} sub="to a teacher who already does it" accent="#fde68a" />
          <StatTile label="Owned actions" value={recs.reduce((a, r) => a + r.actions.length, 0)} sub="CRP · BEO · Jugnu AI" />
          <StatTile
            label="Practices spreading"
            value={Object.keys(practiceCounts).length}
            sub={Object.entries(practiceCounts)
              .map(([p, n]) => `${PRACTICES[p as keyof typeof PRACTICES].label.split(" ").slice(0, 2).join(" ")} ×${n}`)
              .join(" · ")}
          />
        </div>
      </HeroMedia>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Glass className="p-5">
          <SectionTitle eyebrow="Peer links" title="Who learns from whom" sub="Dashed gold lines connect each struggling school to its demonstrator." />
          <BlockMap
            schools={block.schools}
            z={meanZ}
            bright={bright}
            inflated={new Set()}
            struggling={new Set(recs.map((r) => r.schoolId))}
            selected={current?.schoolId}
            onSelect={select}
            links={recs.filter((r) => r.wave === wave).map((r) => ({ from: r.demonstratorId, to: r.schoolId }))}
            height={380}
          />
        </Glass>
        {current && <RecommendationCard rec={current} />}
      </div>

      <Glass className="p-5">
        <SectionTitle
          eyebrow="Officer's action board"
          title="Every action has an owner and a date"
          right={
            <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1">
              {[1, 2].map((w) => (
                <button key={w} className={cx("rounded-full px-3 py-1.5 text-sm", wave === w ? "bg-white/15 text-white" : "text-[var(--color-ink-2)]")} onClick={() => setWave(w as 1 | 2)}>
                  Wave {w}
                </button>
              ))}
            </div>
          }
        />
        <div className="grid gap-3 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = actions.filter((a) => a.status === col.key);
            return (
              <div key={col.key} className="glass-inset p-3">
                <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                  {col.label} <span className="chip">{items.length}</span>
                </div>
                <ul className="scroll-thin max-h-80 space-y-2 overflow-y-auto pr-1">
                  {items.slice(0, 40).map((a) => (
                    <li key={a.id}>
                      <button className="w-full rounded-xl bg-white/5 p-2.5 text-left text-xs hover:bg-white/10" onClick={() => select(a.schoolId)}>
                        <div className="font-semibold">{byId.get(a.schoolId)?.name}</div>
                        <div className="text-[var(--color-ink-2)]">{a.task}</div>
                        <div className="mt-1 flex justify-between text-[var(--color-ink-3)]">
                          <span>{a.owner}</span>
                          <span>day {a.due}</span>
                        </div>
                        {a.note && <div className="mt-1 italic text-[var(--color-ink-2)]">“{a.note}”</div>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Glass>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const { state } = usePipeline();
  const status = useStatus();
  const s = state.block.schools.find((x) => x.id === rec.schoolId)!;
  const demo = state.block.schools.find((x) => x.id === rec.demonstratorId)!;
  const [note, setNote] = useState<{ hi: string; en: string; source: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const hi = note?.hi ?? rec.voiceNoteHi;
  const en = note?.en ?? rec.voiceNoteEn;
  const p = PRACTICES[rec.practice];

  const play = async () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    await speak(hi, "hi-IN");
    setPlaying(false);
  };
  const [checks, setChecks] = useState<{ name: string; passed: boolean; detail?: string }[]>([]);
  const rewrite = async () => {
    setBusy(true);
    const out = await postJSON<{ value: { voice_hi: string; voice_en: string }; source: string; checks: { name: string; passed: boolean; detail?: string }[] }>("/api/reviews/voice-note", {
      draftHi: rec.voiceNoteHi,
      draftEn: rec.voiceNoteEn,
      practice: p.label,
      schoolId: rec.schoolId,
    }).catch(() => null);
    if (out) {
      setNote({ hi: out.value.voice_hi, en: out.value.voice_en, source: out.source });
      setChecks(out.checks);
    }
    setBusy(false);
  };

  return (
    <Glass className="p-5">
      <div className="label">Wave {rec.wave} · {s.clusterName} cluster</div>
      <h3 className="text-xl font-bold">{s.name}</h3>
      <div className="text-sm text-[var(--color-ink-2)]">{s.teacher}</div>
      <div className="mt-4 rounded-2xl border border-amber-200/30 bg-amber-200/8 p-4">
        <div className="label text-amber-100/80">Recommended practice</div>
        <div className="mt-1 text-lg font-bold">{p.label}</div>
        <div className="text-sm text-[var(--color-ink-2)]">{rec.why}</div>
      </div>
      <div className="mt-3 text-sm">
        <b>Demonstrator:</b> {demo.teacher}, {demo.name} — <span className="tabular-nums">{rec.distanceKm} km</span> away
      </div>
      <div className="mt-4 rounded-2xl bg-black/25 p-4">
        <div className="label mb-1">60-second voice note, in {demo.teacher.split(" ")[0]}'s words</div>
        <p className="font-deva text-sm leading-relaxed">{hi}</p>
        <p className="mt-2 text-xs text-[var(--color-ink-3)]">{en}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={play}>
            {playing ? <Pause size={15} /> : <Volume2 size={15} />} {playing ? "Stop" : "Play"}
          </button>
          <button className="btn btn-glass" onClick={rewrite} disabled={busy || !!note}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {status.claude ? "Polish with Claude · send for review" : "Send for review"}
          </button>
          {note && (
            <a className="chip" href="/review">
              {note.source === "claude" ? "Claude draft" : "Offline draft"} · waiting for CRP/BEO approval →
            </a>
          )}
        </div>
        {checks.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {checks.map((c) => (
              <span key={c.name} className="chip text-[10px]" style={{ borderColor: c.passed ? "#2dd4bf88" : "#f8717188" }} title={c.detail}>
                {c.passed ? "✓" : "✗"} {c.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Glass>
  );
}
