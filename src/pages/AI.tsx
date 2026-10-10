// Where AI is used, layer by layer, with the live trace of every call: which task, Claude or the
// offline engine, latency, tokens, and the result of each deterministic guardrail.
import { Activity, Cpu, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { Glass, SectionTitle, StatTile, cx } from "../components/ui";
import { usePoll, useStatus } from "../lib/api";
import { useT } from "../lib/prefs";

interface CheckRow {
  name: string;
  passed: boolean;
  detail?: string;
}
interface Call {
  id: number;
  task: string;
  ref: string | null;
  source: string;
  model: string | null;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  checks: CheckRow[];
  ok: boolean;
  error: string | null;
  created_at: string;
}
interface Trace {
  summary: { tasks: { task: string; source: string; ok: number; n: number; ms: number; tin: number | null; tout: number | null }[]; checks: { name: string; passed: number; failed: number }[] };
  calls: Call[];
}

const TASKS: { id: string; en: string; hi: string; input: string; model: string; guard: string; evals: string; output: string; fallback: string }[] = [
  {
    id: "interview.next",
    en: "Adaptive interviewer",
    hi: "बातचीत करने वाला AI",
    input: "Transcript so far, script areas already covered, interview language",
    model: "Claude, structured output: next utterance + kind (question / follow-up / clarify / closing) + area; 8 s deadline on the phone, 15 s on the web",
    guard: "On classroom routines only (no caste, religion, politics, pay, personal life) · under 40 words · in the teacher's language · never repeats a question · may not close before 5 areas",
    evals: "Coverage of script areas and follow-up rate per interview; replayed against the simulated teachers",
    output: "Spoken by browser TTS or Twilio <Say>; stored as a turn",
    fallback: "Scripted interviewer with one follow-up on vague answers",
  },
  {
    id: "interview.code",
    en: "Transcript coding",
    hi: "बातचीत की कोडिंग",
    input: "Teacher turns only + the practice taxonomy",
    model: "Claude reads meaning in code-mixed Hindi/English; also proposes brand-new practices",
    guard: "Every quote must be verbatim in what the teacher said (else dropped) · specificity re-scored deterministically · agreement with the keyword coder recorded",
    evals: "Precision/recall vs labelled transcripts (npm run eval); grounding rate",
    output: "Practice mentions with quotes → Contrast (Beta-Binomial)",
    fallback: "Keyword lexicon coder",
  },
  {
    id: "spread.card",
    en: "Practice-card writer",
    hi: "तरीके का कार्ड",
    input: "Verbatim quotes from bright-spot teachers for one distinctive practice",
    model: "Claude turns quotes into 3–5 steps, materials, time — citing quote ids",
    guard: "Every step cites a real quote · no number that is not in the cited quotes · Hindi · on-topic",
    evals: "Reviewer approve / edit / reject rate",
    output: "Human review queue → approved cards reach teachers",
    fallback: "Card built directly from the quotes",
  },
  {
    id: "spread.voice_note",
    en: "Peer voice-note writer",
    hi: "वॉइस नोट",
    input: "Draft note in the demonstrator's own words + practice",
    model: "Claude rewrites into a warm 60-second spoken note",
    guard: "Keeps every number · invents none · ≤ 170 words · Hindi · on-topic",
    evals: "Reviewer edits; teacher clarity rating in testing",
    output: "Review queue → WhatsApp/IVR voice note",
    fallback: "The original draft",
  },
  {
    id: "track.follow_up",
    en: "Follow-up reader",
    hi: "फ़ॉलो-अप समझना",
    input: "Teacher's answer to the day-14 call",
    model: "Claude classifies adopted / trying / barrier / not tried, extracts the barrier and who can remove it",
    guard: "Evidence quote must be verbatim · a barrier must have an owner",
    evals: "Agreement with CRP's own reading in pilot",
    output: "Action board status; stuck items escalate to the BEO",
    fallback: "Keyword rules",
  },
  {
    id: "officer.ask",
    en: "Officer Q&A agent",
    hi: "अधिकारी के सवाल",
    input: "The officer's question (typed or spoken)",
    model: "Claude agent with 6 read-only tools over the block's data and live interviews (adaptive thinking, up to 8 steps)",
    guard: "Must look data up before answering · school names checked against the block · no ranking or shaming",
    evals: "Tool-use rate; unknown-name rate",
    output: "Answer, schools, one next step with an owner",
    fallback: "Rule-based answers for common questions",
  },
];

export default function AIPage() {
  const t = useT();
  const status = useStatus();
  const [trace, err] = usePoll<Trace>("/api/ai/trace", 8000);
  const total = trace?.summary.tasks.reduce((a, b) => a + b.n, 0) ?? 0;
  const claude = trace?.summary.tasks.filter((x) => x.source === "claude" && x.ok).reduce((a, b) => a + b.n, 0) ?? 0;
  const rejected = trace?.calls.filter((c) => c.error === "rejected by guardrails").length ?? 0;
  const tokens = trace?.summary.tasks.reduce((a, b) => a + (b.tin ?? 0) + (b.tout ?? 0), 0) ?? 0;
  return (
    <div className="space-y-5">
      <Glass strong className="p-5 md:p-7">
        <div className="label">{t("Effective AI use", "AI का सही इस्तेमाल")}</div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t("Six AI tasks, each in five layers", "छह AI काम, हर एक पाँच परतों में")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-2)]">
          {t(
            "Claude does what language models are good at — conversation, reading meaning in code-mixed Hindi, writing from evidence, using tools. Statistics does the counting (who beats expectation, what is distinctive, did it work). Deterministic guardrails sit between the model and the user, and the offline engine answers whenever Claude is slow, unavailable or fails a check.",
            "Claude वह करता है जिसमें भाषा मॉडल अच्छे हैं — बातचीत, मिली-जुली हिंदी का अर्थ समझना, प्रमाण से लिखना, टूल चलाना। गिनती का काम सांख्यिकी करती है। मॉडल और उपयोगकर्ता के बीच तय नियमों वाली जाँच होती है, और Claude धीमा या अनुपलब्ध हो तो ऑफ़लाइन इंजन जवाब देता है।",
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip">{status.claude ? <Sparkles size={12} className="text-emerald-300" /> : <Cpu size={12} />} {status.claude ? `Claude · ${status.model}` : t("Offline engine (no API key on this server)", "ऑफ़लाइन इंजन (इस सर्वर पर API key नहीं)")}</span>
        </div>
      </Glass>

      <div className="grid gap-3 md:grid-cols-4">
        <StatTile label={t("AI calls logged", "दर्ज AI कॉल")} value={total} />
        <StatTile label={t("Answered by Claude", "Claude के जवाब")} value={claude} sub={total ? `${Math.round((100 * claude) / total)}%` : undefined} />
        <StatTile label={t("Rejected by guardrails", "जाँच में अस्वीकार")} value={rejected} sub={t("offline engine used instead", "ऑफ़लाइन इंजन से जवाब")} />
        <StatTile label={t("Tokens used", "टोकन")} value={tokens.toLocaleString()} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {TASKS.map((x) => {
          const rows = trace?.summary.tasks.filter((r) => r.task === x.id) ?? [];
          const n = rows.reduce((a, b) => a + b.n, 0);
          return (
            <Glass key={x.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-[11px] text-[var(--color-ink-3)]">{x.id}</div>
                  <h3 className="text-lg font-bold">{t(x.en, x.hi)}</h3>
                </div>
                <span className="chip text-[11px]">
                  <Activity size={11} /> {n} {t("calls", "कॉल")}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-sm">
                {(
                  [
                    ["1 · Input", x.input],
                    ["2 · Processing", x.model],
                    ["3 · Guardrails", x.guard],
                    ["4 · Evaluation", x.evals],
                    ["5 · Output", x.output],
                    ["↺ Fallback", x.fallback],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
                    <dt className={cx("label !text-[10px]", k.startsWith("3") && "text-teal-200", k.startsWith("↺") && "text-amber-200")}>{k}</dt>
                    <dd className="text-[var(--color-ink-2)]">{v}</dd>
                  </div>
                ))}
              </dl>
            </Glass>
          );
        })}
      </div>

      <Glass className="p-5">
        <SectionTitle eyebrow={t("Guardrails in action", "जाँच का असर")} title={t("Every check, how often it passed", "हर जाँच कितनी बार पास हुई")} />
        {!trace?.summary.checks.length && <p className="text-sm text-[var(--color-ink-3)]">{t("Checks run on Claude's outputs; they appear here once Claude is connected and in use.", "जाँच Claude के जवाबों पर चलती है; Claude जुड़ने पर यहाँ दिखेगी।")}</p>}
        <div className="grid gap-2 md:grid-cols-2">
          {trace?.summary.checks.map((c) => (
            <div key={c.name} className="glass-inset flex items-center justify-between p-3 text-sm">
              <span>{c.name}</span>
              <span className="tabular-nums">
                <span className="text-teal-200">✓ {c.passed}</span> <span className={cx(c.failed ? "text-red-300" : "text-[var(--color-ink-3)]")}>✗ {c.failed}</span>
              </span>
            </div>
          ))}
        </div>
      </Glass>

      <Glass className="p-5">
        <SectionTitle eyebrow={t("Live trace", "लाइव ट्रेस")} title={t("The last 150 AI calls", "पिछली 150 AI कॉल")} />
        {err && <p className="text-sm text-[var(--color-ink-3)]">{err}</p>}
        <div className="scroll-thin max-h-[520px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[var(--color-ink-3)]">
              <tr>
                <th className="py-2 pr-3">{t("time", "समय")}</th>
                <th className="pr-3">{t("task", "काम")}</th>
                <th className="pr-3">{t("by", "किसने")}</th>
                <th className="pr-3">ms</th>
                <th className="pr-3">{t("tokens", "टोकन")}</th>
                <th>{t("guardrails", "जाँच")}</th>
              </tr>
            </thead>
            <tbody>
              {trace?.calls.map((c) => (
                <tr key={c.id} className="border-t border-white/5 align-top">
                  <td className="py-2 pr-3 tabular-nums text-[var(--color-ink-3)]">{new Date(c.created_at).toLocaleTimeString()}</td>
                  <td className="pr-3 font-mono">{c.task}</td>
                  <td className="pr-3">{c.source === "claude" ? (c.ok ? "Claude" : <span className="text-amber-200">Claude → offline</span>) : t("offline", "ऑफ़लाइन")}</td>
                  <td className="pr-3 tabular-nums">{c.latency_ms}</td>
                  <td className="pr-3 tabular-nums">{c.input_tokens != null ? `${c.input_tokens}+${c.output_tokens}` : "—"}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {c.checks.map((k) => (
                        <span key={k.name} className="chip !py-0 text-[10px]" title={k.detail}>
                          {k.passed ? <ShieldCheck size={10} className="text-teal-300" /> : <ShieldAlert size={10} className="text-red-300" />} {k.name}
                        </span>
                      ))}
                      {c.error && <span className="text-[10px] text-amber-200">{c.error}</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Glass>
    </div>
  );
}
