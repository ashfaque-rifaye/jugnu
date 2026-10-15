import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Globe2, Loader2, MessageCircle, Mic, Phone, PhoneOff, RefreshCw, Send, ShieldCheck, Trash2, TriangleAlert, Volume2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { PageHeader } from "../components/kit";
import { InviteCard, type PilotRow } from "../components/Invite";
import { Glass, SectionTitle, cx } from "../components/ui";
import { codeInterview } from "../engine/interview";
import { PRACTICES, type PracticeId } from "../engine/practices";
import type { Interview } from "../engine/types";
import { delJSON, postJSON, usePoll, useStatus } from "../lib/api";
import { useT } from "../lib/prefs";
import { canListen, listen, speak, stopSpeaking } from "../lib/speech";
import { usePipeline } from "../lib/store";
import { tint } from "../lib/status";

type Tab = "pilot" | "simulated" | "phone";

export default function AskPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("pilot");
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("Interviews", "बातचीत")}
        sub={t(
          "Jugnu talks to bright-spot teachers — and teachers in similar ordinary schools — for 12 minutes in their language: a voice call on any Android phone, or an ordinary phone call. It asks about concrete routines and follows up when an answer is vague.",
          "जुगनू अच्छे स्कूलों के — और उन जैसे सामान्य स्कूलों के — शिक्षकों से उनकी भाषा में 12 मिनट बात करता है: किसी भी Android फ़ोन पर आवाज़-कॉल से, या सामान्य फ़ोन कॉल से। वह ठोस रोज़ के तरीकों के बारे में पूछता है, और अधूरे जवाब पर एक और सवाल करता है।",
        )}
      />

      <div className="inline-flex flex-wrap rounded-full border border-white/10 bg-black/20 p-1">
        {(
          [
            ["pilot", t("Live pilot", "लाइव पायलट"), Globe2],
            ["phone", t("Phone line", "फ़ोन लाइन"), Phone],
            ["simulated", t("Demo interview history", "डेमो बातचीत का इतिहास"), MessageCircle],
          ] as const
        ).map(([id, label, Icon]) => (
          <button key={id} className={cx("flex items-center gap-1.5 rounded-full px-4 py-2 text-sm", tab === id ? "bg-white/15 text-white" : "text-[var(--color-ink-2)]")} onClick={() => setTab(id)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "pilot" && <PilotPanel />}
      {tab === "phone" && <PhoneLine />}
      {tab === "simulated" && <SimulatedInterviews />}
    </div>
  );
}

// ================================================================== live pilot

const STATUS: Record<PilotRow["status"], [string, string, string]> = {
  invited: ["Invited", "आमंत्रित", "var(--tone-muted)"],
  in_progress: ["Talking", "बातचीत जारी", "var(--tone-warn)"],
  completed: ["Completed", "पूरी", "var(--tone-teal)"],
  declined: ["Declined", "मना किया", "var(--tone-bad)"],
};

function StatusChip({ s }: { s: PilotRow["status"] }) {
  const t = useT();
  const [en, hi, color] = STATUS[s];
  return (
    <span className="chip text-[11px]" style={{ borderColor: tint(color, 55), background: tint(color, 12) }}>
      {t(en, hi)}
    </span>
  );
}

function PilotPanel() {
  const t = useT();
  const [rows, err, reload] = usePoll<PilotRow[]>("/api/interviews", 5000);
  const [open, setOpen] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ link: string; row: PilotRow } | null>(null);
  const done = rows?.filter((r) => r.status === "completed").length ?? 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <div className="space-y-5">
        <InviteForm
          onCreated={(link, row) => {
            setInvite({ link, row });
            reload();
          }}
        />
        {invite && <InviteCard link={invite.link} row={invite.row} />}
      </div>
      <div className="space-y-5">
        <Glass className="p-4">
          <SectionTitle
            eyebrow={t("Real interviews from the field", "मैदान से असली बातचीत")}
            title={t(`${rows?.length ?? 0} interview${rows?.length === 1 ? "" : "s"} · ${done} completed`, `${rows?.length ?? 0} बातचीत · ${done} पूरी`)}
            right={
              <a className="btn btn-glass" href="/talk" target="_blank" rel="noreferrer">
                <ExternalLink size={15} /> {t("Try the teacher side", "शिक्षक की तरफ़ से आज़माएँ")}
              </a>
            }
          />
          {err && <p className="text-sm text-red-300">{err}</p>}
          {rows && rows.length === 0 && <p className="glass-inset p-4 text-sm text-[var(--color-ink-3)]">{t("No interviews yet. Invite a teacher on the left, or open the teacher side yourself.", "अभी कोई बातचीत नहीं। बाईं ओर किसी शिक्षक को आमंत्रित करें, या खुद शिक्षक की तरफ़ से आज़माएँ।")}</p>}
          <ul className="scroll-thin max-h-[380px] space-y-2 overflow-y-auto pr-1">
            {rows?.map((r) => (
              <li key={r.id}>
                <button className={cx("glass-inset w-full p-3 text-left transition hover:bg-white/8", open === r.id && "ring-1 ring-amber-200/60")} onClick={() => setOpen(r.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{r.teacher_name || t("Teacher", "शिक्षक")} <span className="text-xs font-normal text-[var(--color-ink-3)]">· {r.school_name || "—"}</span></span>
                    <span className="flex items-center gap-1.5">
                      {r.channel !== "web" ? <Phone size={13} className="text-[var(--color-ink-3)]" /> : <Globe2 size={13} className="text-[var(--color-ink-3)]" />}
                      <StatusChip s={r.status} />
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-ink-3)]">
                    {r.grp === "bright" ? t("bright spot", "अच्छा स्कूल") : r.grp === "comparison" ? t("comparison school", "तुलना स्कूल") : t("pilot", "पायलट")} · {r.turns} {t("answers", "जवाब")} · {new Date(r.created_at).toLocaleString()}
                  </div>
                  {r.practices.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {[...new Set(r.practices)].map((p) => (
                        <span key={p} className="chip text-[10px]">
                          {p in PRACTICES ? PRACTICES[p as PracticeId].label : p}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Glass>
        {open && <InterviewDetail id={open} onDeleted={() => (setOpen(null), reload())} />}
      </div>
    </div>
  );
}

function InviteForm({ onCreated }: { onCreated: (link: string, row: PilotRow) => void }) {
  const t = useT();
  const [teacherName, setTeacher] = useState("");
  const [schoolName, setSchool] = useState("");
  const [group, setGroup] = useState<"bright" | "comparison" | "live">("bright");
  const [language, setLanguage] = useState<"hi" | "en">("hi");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await postJSON<{ interview: PilotRow; link: string }>("/api/interviews", { teacherName, schoolName, group, language });
      onCreated(`${location.origin}${r.link}`, r.interview);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const field = "w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm outline-none focus:border-amber-200/60";
  return (
    <Glass className="p-5">
      <SectionTitle eyebrow={t("Invite a teacher", "शिक्षक को आमंत्रित करें")} title={t("Send an interview link", "बातचीत का लिंक भेजें")} sub={t("The teacher opens it on their phone and talks to Jugnu by voice. No app, no login.", "शिक्षक इसे अपने फ़ोन पर खोलते हैं और आवाज़ से जुगनू से बात करते हैं। न ऐप, न लॉगिन।")} />
      <div className="grid gap-3">
        <label className="text-xs text-[var(--color-ink-3)]">
          {t("Teacher's name", "शिक्षक का नाम")}
          <input className={field} value={teacherName} onChange={(e) => setTeacher(e.target.value)} placeholder="Sunita Devi" />
        </label>
        <label className="text-xs text-[var(--color-ink-3)]">
          {t("School", "स्कूल")}
          <input className={field} value={schoolName} onChange={(e) => setSchool(e.target.value)} placeholder="GPS Kanharkhedi" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-[var(--color-ink-3)]">
            {t("Why this school", "यह स्कूल क्यों")}
            <select className={field} value={group} onChange={(e) => setGroup(e.target.value as typeof group)}>
              <option value="bright">{t("Verified bright spot", "सत्यापित अच्छा स्कूल")}</option>
              <option value="comparison">{t("Comparison school", "तुलना स्कूल")}</option>
              <option value="live">{t("Other / pilot", "अन्य / पायलट")}</option>
            </select>
          </label>
          <label className="text-xs text-[var(--color-ink-3)]">
            {t("Language", "भाषा")}
            <select className={field} value={language} onChange={(e) => setLanguage(e.target.value as "hi" | "en")}>
              <option value="hi">हिंदी</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        <button className="btn btn-primary justify-center" onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {t("Create the link", "लिंक बनाएँ")}
        </button>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <p className="flex items-start gap-2 text-xs text-[var(--color-ink-3)]">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-teal-300" />
          {t("Jugnu asks for consent first. If the teacher says no, nothing is kept. Phone numbers and other personal numbers are removed from transcripts.", "जुगनू पहले अनुमति लेता है। शिक्षक मना करें तो कुछ भी नहीं रखा जाता। फ़ोन नंबर जैसी निजी जानकारी बातचीत से हटा दी जाती है।")}
        </p>
      </div>
    </Glass>
  );
}

interface Detail {
  interview: PilotRow & { call_sid: string | null };
  turns: { idx: number; speaker: "jugnu" | "teacher"; text: string; text_en: string | null; kind: string | null; topic: string | null; source: string | null; confidence: number | null }[];
  codings: { practice: string | null; new_name: string | null; quote: string; specificity: number; grounded: number; coder: string; note: string | null }[];
}

function InterviewDetail({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const t = useT();
  const [data, , reload] = usePoll<Detail>(`/api/interviews/${id}`, 4000);
  const [coding, setCoding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [en, setEn] = useState(false);
  if (!data) return <Glass className="p-6"><Loader2 className="animate-spin text-amber-200" /></Glass>;
  const recode = async () => {
    setCoding(true);
    try {
      const r = await postJSON<{ source: string; warning?: string }>(`/api/interviews/${id}/code`, {});
      setNote(r.warning ?? (r.source === "claude" ? t("Coded by Claude · quotes verified against the transcript", "Claude ने कोड किया · उद्धरण बातचीत से जाँचे गए") : t("Coded by the offline engine", "ऑफ़लाइन इंजन ने कोड किया")));
      reload();
    } finally {
      setCoding(false);
    }
  };
  const erase = async () => {
    if (!window.confirm(t("Delete this interview and its transcript permanently? (Use when a teacher asks for their data to be removed.)", "यह बातचीत और उसका पूरा रिकॉर्ड हमेशा के लिए हटाएँ? (जब शिक्षक अपनी जानकारी हटाने को कहें।)"))) return;
    await delJSON(`/api/interviews/${id}`);
    onDeleted();
  };
  const i = data.interview;
  return (
    <Glass className="p-5">
      <SectionTitle
        eyebrow={`${i.channel === "web" ? t("Web voice call", "वेब वॉइस कॉल") : t("Phone call", "फ़ोन कॉल")} · ${i.consent ? t("consent given", "अनुमति दी") : t("no consent yet", "अनुमति अभी नहीं")}`}
        title={`${i.teacher_name || t("Teacher", "शिक्षक")} · ${i.school_name || "—"}`}
        right={
          <div className="flex gap-2">
            <button className="btn btn-glass !py-1.5" onClick={() => setEn((v) => !v)}>{en ? "हिंदी" : "English"}</button>
            <button className="btn btn-glass !py-1.5" onClick={recode} disabled={coding || i.status !== "completed"}>
              {coding ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("Re-code", "फिर से कोड करें")}
            </button>
            <button className="btn btn-glass !py-1.5" onClick={erase} title={t("Delete on request", "अनुरोध पर हटाएँ")}>
              <Trash2 size={14} />
            </button>
          </div>
        }
      />
      {note && <p className="mb-3 text-xs text-teal-200">{note}</p>}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass-inset scroll-thin max-h-[480px] space-y-2 overflow-y-auto p-3">
          {data.turns.map((tu) => (
            <div key={tu.idx} className={cx("flex", tu.speaker === "teacher" ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[85%] rounded-2xl px-3 py-2 text-sm", tu.speaker === "teacher" ? "rounded-br-sm bg-amber-200/12" : "rounded-bl-sm bg-white/8")}>
                <div className={cx(!en && "font-deva")}>{en ? tu.text_en ?? tu.text : tu.text}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-[var(--color-ink-3)]">
                  {tu.kind && <span>{tu.kind.replace("_", " ")}</span>}
                  {tu.source && <span>· {tu.source === "claude" ? "Claude" : tu.source === "asr" ? t("speech", "आवाज़") : tu.source}</span>}
                  {tu.confidence != null && <span>· {Math.round(tu.confidence * 100)}%</span>}
                </div>
              </div>
            </div>
          ))}
          {data.turns.length === 0 && <p className="text-sm text-[var(--color-ink-3)]">{i.status === "declined" ? t("The teacher declined — no transcript was kept.", "शिक्षक ने मना किया — कोई रिकॉर्ड नहीं रखा गया।") : t("Waiting for the teacher to open the link.", "शिक्षक के लिंक खोलने का इंतज़ार।")}</p>}
        </div>
        <div>
          <div className="label mb-2">{t("Coded practices", "कोड किए गए तरीके")}</div>
          {data.codings.length === 0 ? (
            <p className="glass-inset p-3 text-sm text-[var(--color-ink-3)]">{i.status === "completed" ? t("Coding…", "कोडिंग जारी…") : t("Appears when the interview ends.", "बातचीत खत्म होने पर दिखेगा।")}</p>
          ) : (
            <ul className="space-y-2">
              {data.codings.map((c, k) => (
                <li key={k} className="glass-inset p-3" style={{ borderStyle: c.specificity >= 2 ? "solid" : "dashed" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{c.practice ? PRACTICES[c.practice as PracticeId]?.label ?? c.practice : `✦ ${c.new_name}`}</span>
                    <span className="chip text-[10px]">{c.specificity >= 2 ? t(`specific · ${c.specificity}`, `ठोस · ${c.specificity}`) : t("vague", "अस्पष्ट")}</span>
                  </div>
                  <div className="mt-1 font-deva text-xs text-[var(--color-ink-2)]">“{c.quote}”</div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--color-ink-3)]">
                    {c.grounded ? <ShieldCheck size={11} className="text-teal-300" /> : <TriangleAlert size={11} className="text-red-300" />}
                    {c.grounded ? t("verbatim in transcript", "बातचीत में शब्दशः") : t("not found in transcript", "बातचीत में नहीं मिला")} · {c.coder}
                  </div>
                  {c.note && <div className="mt-1 text-[11px] text-[var(--color-ink-3)]">{c.note}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Glass>
  );
}

// ================================================================== phone line (IVR) simulator
interface SimReply {
  reply: { say: string; done: boolean; kind: string };
  source: string;
  status: string;
  twiml: string;
}

function PhoneLine() {
  const t = useT();
  const status = useStatus();
  const [token, setToken] = useState<string | null>(null);
  const [log, setLog] = useState<{ who: "jugnu" | "teacher"; text: string; twiml?: string }[]>([]);
  const [state, setState] = useState<"idle" | "ringing" | "on" | "ended">("idle");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [showTwiml, setShowTwiml] = useState(true);
  const stopRef = useRef<() => void>(() => {});

  const dial = async () => {
    setState("ringing");
    const { token: tok } = await postJSON<{ token: string }>("/api/talk/demo", { language: "hi", schoolName: "Phone-line test" });
    setToken(tok);
    window.setTimeout(async () => {
      const r = await postJSON<{ twiml: string; lines: string[] }>(`/api/ivr/sim/${tok}/start`, {});
      setState("on");
      setLog(r.lines.map((l, i) => ({ who: "jugnu" as const, text: l, twiml: i === r.lines.length - 1 ? r.twiml : undefined })));
      for (const l of r.lines) await speak(l, "hi-IN");
    }, 900);
  };

  const say = async (text: string) => {
    if (!token || !text.trim()) return;
    setBusy(true);
    setDraft("");
    setLog((l) => [...l, { who: "teacher", text }]);
    const r = await postJSON<SimReply>(`/api/ivr/sim/${token}/say`, { text, confidence: 0.82 });
    setLog((l) => [...l, { who: "jugnu", text: r.reply.say, twiml: r.twiml }]);
    setBusy(false);
    await speak(r.reply.say, "hi-IN");
    if (r.reply.done) setState("ended");
  };

  const mic = async () => {
    if (listening) return stopRef.current();
    stopSpeaking();
    const h = listen("hi-IN", setDraft);
    stopRef.current = h.stop;
    setListening(true);
    try {
      const text = await h.promise;
      setListening(false);
      if (text) await say(text);
    } catch {
      setListening(false);
    }
  };

  const lastTwiml = [...log].reverse().find((l) => l.twiml)?.twiml;
  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <Glass className="p-5">
        <div className="on-dark mx-auto w-full max-w-[300px] rounded-[2.4rem] border border-white/15 bg-[#0b0f17] p-4 shadow-2xl">
          <div className="mb-3 text-center text-xs text-[var(--color-ink-3)]">{state === "idle" ? t("Basic phone", "साधारण फ़ोन") : state === "ringing" ? t("Incoming call…", "कॉल आ रही है…") : state === "on" ? t("On call · Jugnu (Block office)", "कॉल पर · जुगनू (ब्लॉक कार्यालय)") : t("Call ended", "कॉल खत्म")}</div>
          <div className="scroll-thin h-72 space-y-2 overflow-y-auto rounded-2xl bg-white/5 p-2">
            <AnimatePresence initial={false}>
              {log.map((l, i) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cx("rounded-xl px-3 py-1.5 font-deva text-[13px]", l.who === "teacher" ? "ml-6 bg-amber-200/15" : "mr-6 bg-white/10")}>
                  {l.who === "jugnu" && <Volume2 size={11} className="mr-1 inline text-amber-200" />}
                  {l.text}
                </motion.div>
              ))}
            </AnimatePresence>
            {busy && <Loader2 size={14} className="animate-spin text-amber-200" />}
          </div>
          <div className="mt-3 flex items-center justify-center gap-3">
            {state === "idle" || state === "ended" ? (
              <button className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-black" onClick={() => (setLog([]), void dial())} aria-label="call">
                <Phone size={22} />
              </button>
            ) : (
              <>
                <button className={cx("grid h-14 w-14 place-items-center rounded-full", listening ? "accent-solid" : "bg-white/15")} onClick={mic} disabled={!canListen() || busy || state !== "on"} aria-label="speak">
                  <Mic size={22} />
                </button>
                <button className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-black" onClick={() => (stopSpeaking(), setState("ended"))} aria-label="hang up">
                  <PhoneOff size={22} />
                </button>
              </>
            )}
          </div>
          {state === "on" && (
            <form className="mt-3 flex gap-1" onSubmit={(e) => (e.preventDefault(), void say(draft))}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("or type what the teacher says", "या शिक्षक का जवाब लिखें")} className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 font-deva text-xs outline-none" />
              <button className="btn btn-glass !px-2 !py-1" disabled={busy}>
                <Send size={13} />
              </button>
            </form>
          )}
        </div>
      </Glass>
      <Glass className="p-5">
        <SectionTitle
          eyebrow={status.ivr ? t("Phone line connected (Twilio)", "फ़ोन लाइन जुड़ी है (Twilio)") : t("Simulator — the phone line uses the same code", "सिम्युलेटर — फ़ोन लाइन यही कोड चलाती है")}
          title={t("Interviews on any phone — no smartphone, no data", "किसी भी फ़ोन पर बातचीत — न स्मार्टफ़ोन, न डेटा")}
          sub={t(
            "Twilio dials the teacher, speaks each question in Hindi, and sends the spoken answer (hi-IN speech recognition) to Jugnu's interviewer. Claude gets 8 seconds per turn; if it is slower, the offline interviewer answers so the caller never waits. Below is the exact TwiML the server returns at each step.",
            "Twilio शिक्षक को कॉल करता है, हर सवाल हिंदी में बोलता है, और बोले गए जवाब (hi-IN पहचान) को जुगनू के इंटरव्यूअर तक भेजता है। Claude को हर बारी में 8 सेकंड मिलते हैं; देर हो तो ऑफ़लाइन इंटरव्यूअर जवाब देता है।",
          )}
          right={
            <button className="btn btn-glass" onClick={() => setShowTwiml((v) => !v)}>
              {showTwiml ? t("Hide TwiML", "TwiML छिपाएँ") : t("Show TwiML", "TwiML दिखाएँ")}
            </button>
          }
        />
        {showTwiml && <pre className="glass-inset scroll-thin max-h-[420px] overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-[11px] leading-relaxed text-teal-100">{lastTwiml ? prettyXml(lastTwiml) : t("Press the green button to place a test call.", "टेस्ट कॉल के लिए हरा बटन दबाएँ।")}</pre>}
        <ul className="mt-4 grid gap-2 text-sm text-[var(--color-ink-2)] md:grid-cols-3">
          <li className="glass-inset p-3"><b className="text-white">{t("Consent first", "पहले अनुमति")}</b><br />{t("“Shall we begin? Say yes or no.” A no deletes the call.", "“क्या हम शुरू करें?” — ना कहने पर कुछ नहीं रखा जाता।")}</li>
          <li className="glass-inset p-3"><b className="text-white">{t("Signed webhooks", "हस्ताक्षरित वेबहुक")}</b><br />{t("Every Twilio request is verified with its HMAC signature.", "हर Twilio अनुरोध की HMAC जाँच होती है।")}</li>
          <li className="glass-inset p-3"><b className="text-white">{t("No phone numbers stored", "फ़ोन नंबर नहीं रखे जाते")}</b><br />{t("Only a salted hash, to avoid calling twice.", "सिर्फ़ एक हैश, ताकि दोबारा कॉल न हो।")}</li>
        </ul>
      </Glass>
    </div>
  );
}

function prettyXml(x: string) {
  return x.replace(/></g, ">\n<").replace(/(<Say[^>]*>)/g, "  $1").replace(/(<Gather[^>]*>)/g, "$1");
}

// ================================================================== simulated block (evaluation set)
function SimulatedInterviews() {
  const t = useT();
  const { state } = usePipeline();
  const [filter, setFilter] = useState<"bright" | "comparison">("bright");
  const list = state.interviews.filter((i) => i.group === filter);
  const [open, setOpen] = useState<string | null>(list[0]?.schoolId ?? null);
  const current = state.interviews.find((i) => i.schoolId === open);
  const nameOf = (id: string) => state.block.schools.find((s) => s.id === id);
  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Glass className="p-4">
        <p className="mb-3 text-xs text-[var(--color-ink-3)]">{t("Simulated teachers answer from their school's hidden practices — so every later step can be scored against known truth.", "सिम्युलेटेड शिक्षक अपने स्कूल के छिपे तरीकों से जवाब देते हैं — ताकि हर अगले चरण को असली सच से जाँचा जा सके।")}</p>
        <div className="mb-3 inline-flex rounded-full border border-white/10 bg-black/20 p-1">
          {(["bright", "comparison"] as const).map((g) => (
            <button key={g} className={cx("rounded-full px-3 py-1.5 text-sm", filter === g ? "bg-white/15 text-white" : "text-[var(--color-ink-2)]")} onClick={() => setFilter(g)}>
              {g === "bright" ? `${t("Bright spots", "अच्छे स्कूल")} (${state.interviews.filter((i) => i.group === "bright").length})` : `${t("Comparison", "तुलना")} (${state.interviews.filter((i) => i.group === "comparison").length})`}
            </button>
          ))}
        </div>
        <ul className="scroll-thin max-h-[560px] space-y-2 overflow-y-auto pr-1">
          {list.map((i) => {
            const s = nameOf(i.schoolId)!;
            return (
              <li key={i.schoolId}>
                <button className={cx("glass-inset w-full p-3 text-left transition hover:bg-white/8", open === i.schoolId && "ring-1 ring-amber-200/60")} onClick={() => setOpen(i.schoolId)}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{s.teacher}</span>
                    <span className="text-xs text-[var(--color-ink-3)]">{i.minutes} min</span>
                  </div>
                  <div className="text-xs text-[var(--color-ink-3)]">
                    {s.name} · {s.clusterName}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {i.mentions.filter((m) => m.specificity >= 2).map((m) => (
                      <span key={m.practice} className="chip text-[10px]">
                        {PRACTICES[m.practice].label}
                      </span>
                    ))}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Glass>
      {current ? <Transcript interview={current} /> : <Glass className="p-6 text-sm text-[var(--color-ink-2)]">{t("No interviews for this block yet.", "इस ब्लॉक में अभी कोई बातचीत नहीं।")}</Glass>}
    </div>
  );
}

function Transcript({ interview }: { interview: Interview }) {
  const { state } = usePipeline();
  const s = state.block.schools.find((x) => x.id === interview.schoolId)!;
  const [en, setEn] = useState(false);
  const coded = useMemo(() => interview.turns.map((t) => (t.speaker === "teacher" ? codeInterview([t]) : [])), [interview]);
  return (
    <Glass className="p-5">
      <SectionTitle
        eyebrow={`${interview.group === "bright" ? "Verified bright spot" : "Comparison school"} · coded by ${interview.codedBy}`}
        title={`${s.teacher} · ${s.name}`}
        right={
          <button className="btn btn-glass" onClick={() => setEn((v) => !v)}>
            {en ? "हिंदी" : "English"}
          </button>
        }
      />
      <div className="scroll-thin max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {interview.turns.map((t, i) => (
          <div key={i} className={cx("flex", t.speaker === "teacher" ? "justify-end" : "justify-start")}>
            <div className={cx("max-w-[80%] rounded-2xl px-4 py-2 text-sm", t.speaker === "teacher" ? "rounded-br-sm bg-amber-200/12" : "rounded-bl-sm bg-white/8")}>
              <div className={cx(!en && "font-deva")}>{en ? t.textEn ?? t.text : t.text}</div>
              {coded[i].length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {coded[i].map((m) => (
                    <span key={m.practice} className="chip text-[10px]" style={{ borderStyle: m.specificity >= 2 ? "solid" : "dashed" }}>
                      {PRACTICES[m.practice].label} · {m.specificity >= 2 ? "specific" : "vague"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Glass>
  );
}

