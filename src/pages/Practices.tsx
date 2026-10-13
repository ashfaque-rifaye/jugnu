import { Eye, EyeOff, FileCheck2, Loader2, Quote } from "lucide-react";
import { useState } from "react";
import { Dumbbell } from "../components/charts";
import { Glass, SectionTitle, cx } from "../components/ui";
import { HeroMedia } from "../components/media";
import { MEDIA } from "../lib/clips";
import { EFFECTIVE, PRACTICES } from "../engine/practices";
import type { PracticeEvidence } from "../engine/types";
import { postJSON } from "../lib/api";
import { useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";

const VERDICT_LABEL: Record<PracticeEvidence["verdict"], { label: string; tone: string }> = {
  distinctive: { label: "Travels — specific to bright spots", tone: "#bef264" },
  common_everywhere: { label: "Common everywhere — not the difference", tone: "#9ca3af" },
  no_difference: { label: "No clear difference", tone: "#9ca3af" },
  not_enough_evidence: { label: "Not enough evidence yet", tone: "#9ca3af" },
};

export default function PracticesPage() {
  const tx = useT();
  const { state, evaluation } = usePipeline();
  const [reveal, setReveal] = useState(false);
  const name = (id: string) => state.block.schools.find((s) => s.id === id);
  const distinctive = state.evidence.filter((e) => e.verdict === "distinctive");
  const rest = state.evidence.filter((e) => e.verdict !== "distinctive");

  if (!state.interviews.length) {
    return <Glass className="p-8 text-center text-[var(--color-ink-2)]">Imported data: run field interviews (Ask page) to contrast practices.</Glass>;
  }

  return (
    <div className="space-y-5">
      <HeroMedia video={MEDIA.demo} className="p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="label">{tx("Step 3 · Contrast", "चरण 3 · तुलना")}</div>
            <h1 className="text-2xl font-extrabold tracking-tight">{tx("Not “best practices” — the practices that make the difference here", "“सबसे अच्छे तरीके” नहीं — वे तरीके जो यहाँ फ़र्क लाते हैं")}</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-2)]">
              {tx("For each practice: the share of bright-spot teachers who describe it specifically (a duration, frequency, materials, steps) versus similar ordinary schools. A Beta-Binomial model gives the probability it is genuinely more common in bright spots. Practices everyone claims (“we follow the lesson plan”) are set aside.", "हर तरीके के लिए: कितने अच्छे-स्कूल शिक्षक उसे ठोस रूप से (समय, कितनी बार, सामग्री, कदम) बताते हैं, उन जैसे सामान्य स्कूलों के मुकाबले। Beta-Binomial मॉडल बताता है कि वह सच में अच्छे स्कूलों में ज़्यादा है या नहीं। जो सब कहते हैं (“हम पाठ योजना से पढ़ाते हैं”) उसे अलग रखा जाता है।")}
            </p>
          </div>
          {state.block.truth && (
            <button className="btn btn-glass" onClick={() => setReveal((v) => !v)}>
              {reveal ? <Eye size={16} /> : <EyeOff size={16} />} {reveal ? tx("Showing hidden truth", "छिपा सच दिख रहा है") : tx("Reveal hidden truth", "छिपा सच दिखाएँ")}
            </button>
          )}
        </div>
        {reveal && evaluation && (
          <div className="mt-3 rounded-xl border border-dashed border-white/20 p-3 text-sm text-[var(--color-ink-2)]">
            Truly effective practices in this simulation: {EFFECTIVE.map((p) => PRACTICES[p].label).join(", ")}. Found: <b className="text-white">{evaluation.practices.found.map((p) => PRACTICES[p].label).join(", ") || "—"}</b>
            {evaluation.practices.missed.length ? ` · not yet found: ${evaluation.practices.missed.map((p) => PRACTICES[p].label).join(", ")}` : ""} · decoys wrongly promoted:{" "}
            <b className="text-white">{evaluation.practices.falseDistinctive.length || "none"}</b>
          </div>
        )}
      </HeroMedia>

      <div className="grid gap-4 lg:grid-cols-2">
        {distinctive.map((e, i) => (
          <Glass key={e.practice} className="p-5" delay={i * 0.04}>
            <PracticeCard e={e} name={name} reveal={reveal} />
          </Glass>
        ))}
      </div>

      <Glass className="p-5">
        <SectionTitle eyebrow={tx("Set aside", "अलग रखे गए")} title={tx("Claimed by many, not what separates bright spots", "बहुत लोग कहते हैं, पर यही अच्छे स्कूलों को अलग नहीं करता")} />
        <div className="grid gap-3 md:grid-cols-2">
          {rest.map((e) => (
            <div key={e.practice} className="glass-inset p-4">
              <PracticeCard e={e} name={name} reveal={reveal} compact />
            </div>
          ))}
        </div>
      </Glass>
    </div>
  );
}

function PracticeCard({ e, name, reveal, compact }: { e: PracticeEvidence; name: (id: string) => { teacher: string; village: string } | undefined; reveal: boolean; compact?: boolean }) {
  const p = PRACTICES[e.practice];
  const v = VERDICT_LABEL[e.verdict];
  const bShare = e.bright.k / Math.max(1, e.bright.n);
  const cShare = e.comparison.k / Math.max(1, e.comparison.n);
  const effective = EFFECTIVE.includes(e.practice);
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className={cx("font-bold", !compact && "text-lg")}>{p.label}</h3>
          <div className="font-deva text-xs text-[var(--color-ink-3)]">{p.labelHi}</div>
        </div>
        <span className="chip" style={{ borderColor: `${v.tone}88`, color: v.tone }}>
          {v.label}
        </span>
      </div>
      {!compact && <p className="mt-2 text-sm text-[var(--color-ink-2)]">{p.what}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--color-ink-2)]">
        <div className="flex-1">
          <Dumbbell bright={bShare} comparison={cShare} />
          <div className="mt-1 flex justify-between tabular-nums">
            <span>
              <span className="inline-block h-2 w-2 rounded-full bg-[#fde047]" /> bright spots {e.bright.k}/{e.bright.n}
            </span>
            <span>
              <span className="inline-block h-2 w-2 rounded-full bg-gray-400" /> comparison {e.comparison.k}/{e.comparison.n}
            </span>
          </div>
        </div>
        <div className="tabular-nums">
          <div>
            lift <b className="text-white">{e.lift.toFixed(1)}×</b>
          </div>
          <div>
            P(more common) <b className="text-white">{Math.round(e.pDistinctive * 100)}%</b>
          </div>
          <div>
            cost <b className="text-white">{p.cost}</b>
          </div>
        </div>
      </div>
      {!compact && e.quotes.length > 0 && (
        <ul className="mt-4 space-y-2">
          {e.quotes.map((q) => (
            <li key={q.schoolId} className="glass-inset flex gap-2 p-3 text-sm">
              <Quote size={14} className="mt-0.5 shrink-0 text-amber-200" aria-hidden />
              <div>
                <div className="font-deva">{q.quote}</div>
                <div className="mt-1 text-xs text-[var(--color-ink-3)]">
                  — {name(q.schoolId)?.teacher}, {name(q.schoolId)?.village}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!compact && e.quotes.length > 0 && <DraftCard e={e} name={name} />}
      {reveal && <div className="mt-2 text-xs text-[var(--color-ink-3)]">Hidden truth: {effective ? `effective (reading +${p.effect.reading}, maths +${p.effect.numeracy} logit)` : "no effect (decoy)"}</div>}
    </div>
  );
}

/** Ask Claude to turn the teachers' own quotes into a one-page practice card — it lands in the review queue. */
function DraftCard({ e, name }: { e: PracticeEvidence; name: (id: string) => { teacher: string; village: string } | undefined }) {
  const [state, setState] = useState<"idle" | "busy" | "queued">("idle");
  const [source, setSource] = useState<string>("");
  const [checks, setChecks] = useState<{ name: string; passed: boolean; detail?: string }[]>([]);
  const draft = async () => {
    setState("busy");
    const out = await postJSON<{ source: string; checks: typeof checks }>("/api/reviews/card", {
      practice: e.practice,
      quotes: e.quotes.map((q) => ({ school: `${name(q.schoolId)?.teacher ?? ""}, ${name(q.schoolId)?.village ?? ""}`, quote: q.quote })),
    }).catch(() => null);
    if (out) {
      setSource(out.source);
      setChecks(out.checks);
    }
    setState(out ? "queued" : "idle");
  };
  return (
    <div className="mt-3">
      {state !== "queued" ? (
        <button className="btn btn-glass !py-1.5 text-sm" onClick={draft} disabled={state === "busy"}>
          {state === "busy" ? <Loader2 size={14} className="animate-spin" /> : <FileCheck2 size={14} />} Draft a practice card for review
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <a className="chip" href="/review">
            {source === "claude" ? "Claude drafted it" : "Offline draft"} · waiting for approval →
          </a>
          {checks.map((c) => (
            <span key={c.name} className="chip text-[10px]" style={{ borderColor: c.passed ? "#2dd4bf88" : "#f8717188" }} title={c.detail}>
              {c.passed ? "✓" : "✗"} {c.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
