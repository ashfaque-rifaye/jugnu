// The things people do in the field, recorded in the block's shared activity log:
// a 15-child spot check, moving an action along, a follow-up call, and the peer voice note.
import { Check, CircleDashed, Loader2, Minus, Pause, Plus, Send, Sparkles, TriangleAlert, Volume2 } from "lucide-react";
import { useState } from "react";
import { PRACTICES } from "../engine/practices";
import type { Action, Recommendation, School } from "../engine/types";
import { postJSON, usePoll, useStatus } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";
import { speak, stopSpeaking } from "../lib/speech";
import { usePipeline } from "../lib/store";
import { VoiceText } from "./Feedback";
import { fieldClass } from "./kit";
import { cx } from "./ui";
import { tint } from "../lib/status";

/** A count: type it, or tap − / + (big targets for phones). */
function Stepper({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max: number }) {
  const clamp = (v: number) => Math.max(0, Math.min(max, Number.isFinite(v) ? Math.round(v) : 0));
  return (
    <div className="card-inset flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-2">
        <button type="button" className="btn btn-glass !p-2" onClick={() => onChange(clamp(value - 1))} aria-label={`${label} −1`}>
          <Minus size={16} />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          onFocus={(e) => e.target.select()}
          className="w-14 rounded-lg border border-white/15 bg-black/30 py-1 text-center font-display text-xl font-bold tabular-nums outline-none focus:border-amber-200/70"
          aria-label={label}
        />
        <button type="button" className="btn btn-glass !p-2" onClick={() => onChange(clamp(value + 1))} aria-label={`${label} +1`}>
          <Plus size={16} />
        </button>
      </span>
    </div>
  );
}

/** 15 Grade-3 children, one Std II paragraph and one 2-digit subtraction — about 15 minutes. */
export function SpotCheckForm({ school, onSaved }: { school: School; onSaved?: () => void }) {
  const t = useT();
  const { record } = usePipeline();
  const [n, setN] = useState(15);
  const [read, setRead] = useState(0);
  const [maths, setMaths] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await record("spotcheck", school.id, { sampled: n, proficient: Math.min(read, n), numeracyProficient: Math.min(maths, n) });
      onSaved?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--color-ink-2)]">
        <li>{t("Pick Grade 3 children at random from the register (not the teacher's choice).", "रजिस्टर से कक्षा 3 के बच्चे बिना चुने लें (शिक्षक की पसंद से नहीं)।")}</li>
        <li>
          {t("Each child reads a short Std II paragraph aloud, then does one 2-digit subtraction with borrowing.", "हर बच्चा कक्षा 2 का छोटा अनुच्छेद पढ़े, फिर हासिल वाला 2 अंकों का एक घटाव करे।")}
        </li>
        <li>{t("Count how many could do each. No names are recorded.", "गिनें कि कितने बच्चे कर पाए। कोई नाम दर्ज नहीं होता।")}</li>
      </ol>
      <Stepper label={t("Children checked", "जाँचे गए बच्चे")} value={n} onChange={(v) => (setN(Math.max(5, v)), setRead((r) => Math.min(r, v)), setMaths((m) => Math.min(m, v)))} max={40} />
      <Stepper label={t("Read the paragraph fluently", "अनुच्छेद ठीक से पढ़ा")} value={read} onChange={setRead} max={n} />
      <Stepper label={t("Did the subtraction correctly", "घटाव सही किया")} value={maths} onChange={setMaths} max={n} />
      <button className="btn btn-primary w-full justify-center" onClick={save} disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {t("Save spot check", "जाँच सहेजें")}
      </button>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <p className="text-xs text-[var(--color-ink-3)]">
        {t(
          "Jugnu compares this with the results the school reported. If they clearly disagree, the school is marked for a respectful revisit — never a penalty.",
          "जुगनू इसकी तुलना स्कूल के दर्ज परिणामों से करता है। साफ़ अंतर हो तो सम्मान से दोबारा देखने को कहा जाता है — कभी सज़ा नहीं।",
        )}
      </p>
    </div>
  );
}

const STATUS_STYLE: Record<Action["status"], { en: string; hi: string; color: string }> = {
  todo: { en: "To do", hi: "करना है", color: "var(--tone-muted)" },
  scheduled: { en: "Scheduled", hi: "तय है", color: "var(--tone-info)" },
  done: { en: "Done", hi: "पूरा", color: "var(--tone-good)" },
  stuck: { en: "Stuck", hi: "अटका", color: "var(--tone-bad)" },
};

export function ActionStatus({ status }: { status: Action["status"] }) {
  const t = useT();
  const s = STATUS_STYLE[status];
  return (
    <span className="chip !text-[11px]" style={{ borderColor: tint(s.color, 50), color: s.color, background: tint(s.color, 8) }}>
      {status === "done" ? <Check size={11} /> : status === "stuck" ? <TriangleAlert size={11} /> : <CircleDashed size={11} />} {t(s.en, s.hi)}
    </span>
  );
}

/** One owned action with its controls: anyone can move it along; "stuck" needs a reason. */
export function ActionRow({ action, school, compact }: { action: Action; school?: School; compact?: boolean }) {
  const t = useT();
  const { record } = usePipeline();
  const [stuck, setStuck] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const set = async (status: Action["status"], n?: string) => {
    setBusy(true);
    try {
      await record("action", action.id, n ? { status, note: n } : { status });
      setStuck(false);
      setNote("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={cx("card-inset p-3", action.status === "stuck" && "border-red-400/40")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {school && !compact && <div className="text-xs font-semibold text-[var(--color-ink-2)]">{school.name}</div>}
          <div className="text-[15px] font-medium">{action.task}</div>
          <div className="text-xs text-[var(--color-ink-3)]">
            {action.owner} · {t(`day ${action.due} of the plan`, `योजना का दिन ${action.due}`)}
          </div>
          {action.note && <div className="mt-1 text-sm italic text-[var(--color-ink-2)]">“{action.note}”</div>}
        </div>
        <ActionStatus status={action.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {action.status !== "done" && (
          <button className="btn btn-glass !px-3 !py-1 text-xs" onClick={() => set("done")} disabled={busy}>
            <Check size={13} /> {t("Mark done", "पूरा करें")}
          </button>
        )}
        {action.status === "todo" && (
          <button className="btn btn-glass !px-3 !py-1 text-xs" onClick={() => set("scheduled")} disabled={busy}>
            {t("Scheduled", "तय किया")}
          </button>
        )}
        {action.status !== "stuck" && (
          <button className="btn btn-glass !px-3 !py-1 text-xs" onClick={() => setStuck((v) => !v)} disabled={busy}>
            <TriangleAlert size={13} /> {t("It's stuck", "अटका है")}
          </button>
        )}
        {(action.status === "done" || action.status === "stuck") && (
          <button className="btn btn-glass !px-3 !py-1 text-xs" onClick={() => set("todo")} disabled={busy}>
            {t("Reopen", "फिर खोलें")}
          </button>
        )}
        {busy && <Loader2 size={14} className="animate-spin text-amber-200" />}
      </div>
      {stuck && (
        <div className="mt-2 flex gap-2">
          <input
            className={fieldClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("What is in the way? Who can fix it?", "क्या रुकावट है? कौन ठीक कर सकता है?")}
            autoFocus
          />
          <button className="btn btn-primary" onClick={() => set("stuck", note.trim())} disabled={!note.trim() || busy}>
            {t("Escalate", "ऊपर भेजें")}
          </button>
        </div>
      )}
    </div>
  );
}

type Outcome = "adopted" | "trying" | "barrier" | "no_answer";

/** Day-14 call: "Did you try it? What happened?" — recorded by the CRP, or read by Jugnu from the teacher's words. */
export function FollowUpForm({ school, practice }: { school: School; practice: string }) {
  const t = useT();
  const status = useStatus();
  const { record } = usePipeline();
  const [said, setSaid] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [ai, setAi] = useState<{ summary: string; barrier: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const read = async () => {
    setReading(true);
    const out = await postJSON<{ value: { outcome: string; owner: string | null; summary_en: string; barrier: string | null }; source: string }>("/api/followup/read", {
      reply: said,
      practice,
      schoolId: school.id,
    }).catch(() => null);
    setReading(false);
    if (!out) return;
    const o = out.value.outcome === "not_tried" ? "barrier" : (out.value.outcome as Outcome);
    setOutcome(o);
    setOwner(out.value.owner);
    setAi({ summary: out.value.summary_en, barrier: out.value.barrier });
    setHint(
      `${out.source === "claude" ? "Claude" : t("Offline reader", "ऑफ़लाइन")}: ${out.value.summary_en}${out.value.barrier ? ` — ${out.value.barrier}${out.value.owner ? ` (${out.value.owner})` : ""}` : ""}`,
    );
  };
  const save = async () => {
    if (!outcome) return;
    setBusy(true);
    await record("followup", school.id, {
      outcome,
      said: said.trim() || undefined,
      summary: ai ? [ai.summary, ai.summary] : undefined,
      barrier: outcome === "barrier" ? (ai?.barrier ?? undefined) : undefined,
      barrierOwner: outcome === "barrier" ? (owner ?? undefined) : undefined,
    }).catch(() => null);
    setBusy(false);
    setDone(true);
  };
  if (done) return <p className="text-sm text-emerald-300">{t("Saved. The support plan and Results are updated for everyone.", "सहेज लिया। योजना और नतीजे सबके लिए अपडेट हो गए।")}</p>;
  const OPTIONS: [Outcome, string, string][] = [
    ["adopted", t("Doing it regularly", "नियमित कर रहे हैं"), "#4ade80"],
    ["trying", t("Trying it", "आज़मा रहे हैं"), "#facc15"],
    ["barrier", t("Something is in the way", "कोई रुकावट है"), "#f87171"],
    ["no_answer", t("Did not answer", "जवाब नहीं मिला"), "#9ca3af"],
  ];
  return (
    <div className="space-y-3">
      <VoiceText
        value={said}
        onChange={setSaid}
        placeholder={t(`What did ${school.teacher.split(" ")[0]} say? (type or speak)`, `${school.teacher.split(" ")[0]} ने क्या कहा? (लिखें या बोलें)`)}
        rows={2}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-glass !py-1.5 text-sm" onClick={read} disabled={!said.trim() || reading}>
          {reading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {status.claude ? t("Let Claude read it", "Claude से समझें") : t("Let Jugnu read it", "जुगनू से समझें")}
        </button>
        {hint && <span className="text-xs text-[var(--color-ink-2)]">{hint}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map(([k, label, color]) => (
          <button
            key={k}
            className={cx("rounded-xl border px-3 py-2 text-left text-sm transition", outcome === k ? "bg-white/10" : "border-white/12 hover:bg-white/5")}
            style={outcome === k ? { borderColor: color, color } : undefined}
            onClick={() => setOutcome(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <button className="btn btn-primary w-full justify-center" onClick={save} disabled={!outcome || busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {t("Save the follow-up", "फ़ॉलो-अप सहेजें")}
      </button>
    </div>
  );
}

interface ReviewItem {
  id: string;
  kind: string;
  ref: string | null;
  status: "pending" | "approved" | "rejected";
  payload: { voice_hi?: string; voice_en?: string; source?: string };
}

/** The demonstrator's 60-second voice note: listen, send for approval, then share on WhatsApp. */
export function VoiceNote({ rec, school, demo }: { rec: Recommendation; school: School; demo: School }) {
  const t = useT();
  const { lang } = usePrefs();
  const status = useStatus();
  const [reviews, , reload] = usePoll<ReviewItem[]>("/api/reviews?status=all", 10000);
  const mine = reviews?.filter((r) => r.kind === "voice_note" && r.ref === school.id) ?? [];
  const approved = mine.find((r) => r.status === "approved");
  const pending = mine.find((r) => r.status === "pending");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const hi = approved?.payload.voice_hi ?? pending?.payload.voice_hi ?? rec.voiceNoteHi;
  const en = approved?.payload.voice_en ?? pending?.payload.voice_en ?? rec.voiceNoteEn;
  const play = async () => {
    if (playing) return (stopSpeaking(), setPlaying(false));
    setPlaying(true);
    await speak(hi, "hi-IN");
    setPlaying(false);
  };
  const send = async () => {
    setBusy(true);
    await postJSON("/api/reviews/voice-note", { draftHi: rec.voiceNoteHi, draftEn: rec.voiceNoteEn, practice: PRACTICES[rec.practice].label, schoolId: school.id }).catch(() => null);
    setBusy(false);
    reload();
  };
  return (
    <div className="rounded-2xl border border-amber-200/25 bg-amber-200/[0.06] p-4">
      <div className="label mb-1 text-amber-100/80">{t(`60-second voice note in ${demo.teacher.split(" ")[0]}'s words`, `${demo.teacher.split(" ")[0]} के शब्दों में 60 सेकंड का वॉइस नोट`)}</div>
      <p className="font-deva text-[15px] leading-relaxed">{hi}</p>
      {lang === "en" && <p className="mt-1.5 text-xs text-[var(--color-ink-3)]">{en}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn btn-glass !py-1.5" onClick={play}>
          {playing ? <Pause size={15} /> : <Volume2 size={15} />} {playing ? t("Stop", "रोकें") : t("Listen", "सुनें")}
        </button>
        {approved ? (
          <a className="btn btn-primary !py-1.5" href={`https://wa.me/?text=${encodeURIComponent(hi)}`} target="_blank" rel="noreferrer">
            <Send size={15} /> {t(`Send to ${school.teacher.split(" ")[0]} on WhatsApp`, `${school.teacher.split(" ")[0]} को WhatsApp पर भेजें`)}
          </a>
        ) : pending ? (
          <a className="chip" href="/review">
            {t("Waiting for approval →", "मंज़ूरी का इंतज़ार →")}
          </a>
        ) : (
          <button className="btn btn-primary !py-1.5" onClick={send} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{" "}
            {status.claude ? t("Polish with Claude & send for approval", "Claude से सुधारें व मंज़ूरी भेजें") : t("Send for approval", "मंज़ूरी के लिए भेजें")}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-[var(--color-ink-3)]">{t("Nothing reaches a teacher until a CRP or the BEO approves it.", "CRP या BEO की मंज़ूरी के बिना कुछ भी शिक्षक तक नहीं जाता।")}</p>
    </div>
  );
}
