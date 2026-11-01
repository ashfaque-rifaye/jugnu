import { ExternalLink, Globe2, Loader2, Phone, Send, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/kit";
import { InviteCard, type PilotRow } from "../components/Invite";
import { Glass, SectionTitle, cx } from "../components/ui";
import { PRACTICES, type PracticeId } from "../engine/practices";
import { delJSON, postJSON, usePoll } from "../lib/api";
import { useT } from "../lib/prefs";
import { tint } from "../lib/status";

type Tab = "pilot" | "phone";

export default function AskPage() {
  const t = useT();
  const [params] = useSearchParams();
  const asked = params.get("tab") === "phone" ? "phone" : null;
  const [tab, setTab] = useState<Tab>(asked ?? "pilot");
  // The agent opens the phone line by address, sometimes while this page is already up.
  useEffect(() => {
    if (asked) setTab(asked);
  }, [asked]);
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("Talk to teachers", "शिक्षकों से बात")}
        sub={t(
          "Jugnu has a 12-minute conversation with a teacher, in their language, about what actually happens in class: on a link or an ordinary phone call. It asks for details when an answer is vague, and you only need a few teachers from each school.",
          "जुगनू शिक्षक से उनकी भाषा में 12 मिनट बात करता है कि कक्षा में असल में क्या होता है: लिंक या साधारण फ़ोन कॉल पर। जवाब अधूरा हो तो विस्तार से पूछता है, और हर स्कूल से कुछ ही शिक्षक काफ़ी हैं।",
        )}
      />

      <div className="inline-flex flex-wrap rounded-full border border-white/10 bg-black/20 p-1">
        {(
          [
            ["pilot", t("Conversations", "बातचीत"), Globe2],
            ["phone", t("Phone line", "फ़ोन लाइन"), Phone],
          ] as const
        ).map(([id, label, Icon]) => (
          <button key={id} className={cx("seg-item flex items-center gap-1.5 rounded-full px-4 py-2 text-sm", tab === id ? "bg-white/15 text-white" : "text-[var(--color-ink-2)]")} onClick={() => setTab(id)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "pilot" && <PilotPanel />}
      {tab === "phone" && <PhoneLine />}
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
    <span className="chip text-xs" style={{ borderColor: tint(color, 55), background: tint(color, 12) }}>
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
            eyebrow={t("Teachers so far", "अब तक के शिक्षक")}
            title={t(`${rows?.length ?? 0} conversation${rows?.length === 1 ? "" : "s"} · ${done} finished`, `${rows?.length ?? 0} बातचीत · ${done} पूरी`)}
            right={
              <a className="btn btn-glass" href="/talk" target="_blank" rel="noreferrer">
                <ExternalLink size={15} /> {t("Try it as a teacher", "शिक्षक बनकर आज़माएँ")}
              </a>
            }
          />
          {err && <p className="text-sm text-red-300">{err}</p>}
          {rows && rows.length === 0 && <p className="glass-inset p-4 text-sm text-[var(--color-ink-3)]">{t("No interviews yet. Invite a teacher on the left, or open the teacher side yourself.", "अभी कोई बातचीत नहीं। बाईं ओर किसी शिक्षक को आमंत्रित करें, या खुद शिक्षक की तरफ़ से आज़माएँ।")}</p>}
          <ul className="scroll-thin space-y-2 lg:max-h-[380px] lg:overflow-y-auto lg:pr-1">
            {rows?.map((r) => (
              <li key={r.id}>
                <button className={cx("glass-inset w-full p-3 text-left transition hover:bg-white/8", open === r.id && "ring-1 ring-amber-200/60")} onClick={() => setOpen(r.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{r.teacher_name || t("Teacher", "शिक्षक")} <span className="text-xs font-normal text-[var(--color-ink-3)]">· {r.school_name || "—"}{r.id.startsWith("demo-iv-") ? ` · ${t("sample", "नमूना")}` : ""}</span></span>
                    <span className="flex items-center gap-1.5">
                      {r.channel !== "web" ? <Phone size={13} className="text-[var(--color-ink-3)]" /> : <Globe2 size={13} className="text-[var(--color-ink-3)]" />}
                      <StatusChip s={r.status} />
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-ink-3)]">
                    {r.grp === "bright" ? t("school doing well", "अच्छा कर रहा स्कूल") : r.grp === "comparison" ? t("similar school", "वैसा ही स्कूल") : t("other school", "अन्य स्कूल")} · {r.turns} {t("answers", "जवाब")} · {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  {r.practices.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {[...new Set(r.practices)].map((p) => (
                        <span key={p} className="chip text-xs">
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
          <input className={field} value={teacherName} onChange={(e) => setTeacher(e.target.value)} placeholder="Sunita Sharma" />
        </label>
        <label className="text-xs text-[var(--color-ink-3)]">
          {t("School", "स्कूल")}
          <input className={field} value={schoolName} onChange={(e) => setSchool(e.target.value)} placeholder="GPS Tendukheda" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-[var(--color-ink-3)]">
            {t("Why this school", "यह स्कूल क्यों")}
            <select className={field} value={group} onChange={(e) => setGroup(e.target.value as typeof group)}>
              <option value="bright">{t("School doing well", "अच्छा कर रहा स्कूल")}</option>
              <option value="comparison">{t("Similar school, to compare", "तुलना के लिए वैसा ही स्कूल")}</option>
              <option value="live">{t("Other school", "अन्य स्कूल")}</option>
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
  const [data] = usePoll<Detail>(`/api/interviews/${id}`, 4000);
  const [en, setEn] = useState(false);
  if (!data) return <Glass className="p-6"><Loader2 className="animate-spin text-amber-200" /></Glass>;
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
            <button className="btn btn-glass !py-1.5" onClick={erase} title={t("Delete on request", "अनुरोध पर हटाएँ")}>
              <Trash2 size={14} />
            </button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass-inset scroll-thin max-h-[480px] space-y-2 overflow-y-auto p-3">
          {data.turns.map((tu) => (
            <div key={tu.idx} className={cx("flex", tu.speaker === "teacher" ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[85%] rounded-2xl px-3 py-2 text-sm", tu.speaker === "teacher" ? "rounded-br-sm bg-amber-200/12" : "rounded-bl-sm bg-white/8")}>
                <div className={cx(!en && "font-deva")}>{en ? tu.text_en ?? tu.text : tu.text}</div>
              </div>
            </div>
          ))}
          {data.turns.length === 0 && <p className="text-sm text-[var(--color-ink-3)]">{i.status === "declined" ? t("The teacher declined — no transcript was kept.", "शिक्षक ने मना किया — कोई रिकॉर्ड नहीं रखा गया।") : t("Waiting for the teacher to open the link.", "शिक्षक के लिंक खोलने का इंतज़ार।")}</p>}
        </div>
        <div>
          <div className="label mb-2">{t("Coded methods", "कोड किए गए तरीके")}</div>
          {data.codings.length === 0 ? (
            <p className="glass-inset p-3 text-sm text-[var(--color-ink-3)]">{i.status === "completed" ? t("Reading the conversation…", "बातचीत पढ़ी जा रही है…") : t("Appears when the conversation ends.", "बातचीत खत्म होने पर दिखेगा।")}</p>
          ) : (
            <ul className="space-y-2">
              {data.codings.map((c, k) => (
                <li key={k} className="glass-inset p-3" style={{ borderStyle: c.specificity >= 2 ? "solid" : "dashed" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{c.practice ? PRACTICES[c.practice as PracticeId]?.label ?? c.practice : `✦ ${c.new_name}`}</span>
                    <span className="chip text-xs">{c.specificity >= 2 ? t("clear detail", "साफ़ जानकारी") : t("vague", "अस्पष्ट")}</span>
                  </div>
                  <div className="mt-1 font-deva text-xs text-[var(--color-ink-2)]">“{c.quote}”</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Glass>
  );
}

// ================================================================== phone line (real calls via Exotel / Plivo)
interface Telephony {
  active: "exotel" | "plivo" | null;
  publicUrl: string | null;
  voice: boolean;
  providers: { exotel: { configured: boolean; from: string | null }; plivo: { configured: boolean; from: string | null } };
}

const CALL_STATE: Record<string, [string, string, string]> = {
  dialing: ["Dialing", "फ़ोन लग रहा है", "var(--tone-warn)"],
  "in-call": ["On the line", "बात चल रही है", "var(--tone-teal)"],
  completed: ["Call ended", "कॉल खत्म", "var(--tone-muted)"],
  "no-answer": ["No answer", "जवाब नहीं", "var(--tone-bad)"],
  busy: ["Busy", "व्यस्त", "var(--tone-bad)"],
  failed: ["Failed", "नहीं लगा", "var(--tone-bad)"],
};

function PhoneLine() {
  const t = useT();
  const [tel] = usePoll<Telephony>("/api/ivr/status", 15000);
  const [rows, , reload] = usePoll<PilotRow[]>("/api/interviews", 4000);
  const [to, setTo] = useState("+91");
  const [teacherName, setTeacherName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [group, setGroup] = useState<"bright" | "comparison" | "live">("live");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const calls = useMemo(() => (rows ?? []).filter((r) => r.channel === "phone"), [rows]);
  // A call on the line opens by itself, so its words can be followed as they are spoken.
  const liveCall = calls.find((r) => r.call_status === "dialing" || r.call_status === "in-call")?.id;
  useEffect(() => {
    if (liveCall) setOpen(liveCall);
  }, [liveCall]);
  const ready = !!tel?.active && !!tel?.publicUrl && !!tel?.voice;
  const from = tel?.active ? tel.providers[tel.active].from : null;

  const dial = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const r = await postJSON<{ interview: PilotRow; callSid: string; provider: string }>("/api/ivr/call", { to, teacherName, schoolName, group, language: "hi" });
      setNote({ kind: "ok", text: t(`Ringing ${to} via ${r.provider === "exotel" ? "Exotel" : "Plivo"} (call ${r.callSid.slice(0, 10)}…)`, `${to} पर फ़ोन लग रहा है (${r.provider === "exotel" ? "Exotel" : "Plivo"})`) });
      setOpen(r.interview.id);
      reload();
    } catch (err) {
      setNote({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
      <div className="space-y-4">
        <Glass className="p-5">
          <SectionTitle
            eyebrow={ready ? t("Line open", "लाइन खुली") : t("Line closed", "लाइन बंद")}
            title={t("Dial a teacher", "शिक्षक को फ़ोन करें")}
            sub={t("A real call on any basic phone. Jugnu asks which language the teacher prefers, Hindi or English, then has the same 12-minute conversation.", "किसी भी साधारण फ़ोन पर असली कॉल। जुगनू हिंदी में बोलता है, सुनता है, और वही 12 मिनट की बातचीत करता है।")}
          />
          <form className="space-y-3" onSubmit={dial}>
            <label className="block">
              <span className="label">{t("Mobile number", "मोबाइल नंबर")}</span>
              <input value={to} onChange={(e) => setTo(e.target.value)} inputMode="tel" placeholder="+91 98765 43210" className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm outline-none focus:border-amber-200/60" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder={t("Teacher (optional)", "शिक्षक (वैकल्पिक)")} className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none" />
              <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder={t("School (optional)", "स्कूल (वैकल्पिक)")} className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none" />
            </div>
            <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1 text-xs">
              {(["live", "bright", "comparison"] as const).map((g) => (
                <button type="button" key={g} className={cx("rounded-full px-3 py-1", group === g ? "bg-white/15 text-white" : "text-[var(--color-ink-2)]")} onClick={() => setGroup(g)}>
                  {g === "live" ? t("Other", "अन्य") : g === "bright" ? t("Doing well", "अच्छा") : t("Similar", "वैसा ही")}
                </button>
              ))}
            </div>
            <button className="btn btn-primary w-full" disabled={busy || !ready}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />} {t("Place the call", "कॉल लगाएँ")}
            </button>
          </form>
          {note && <p className={cx("mt-3 text-xs", note.kind === "ok" ? "text-teal-200" : "text-red-300")}>{note.text}</p>}
          {!ready && (
            <p className="mt-3 text-xs text-[var(--color-ink-3)]">
              {!tel?.active
                ? t("No telephony provider is configured on this server (EXOTEL_* or PLIVO_*).", "इस सर्वर पर कोई टेलीफ़ोनी प्रदाता सेट नहीं है (EXOTEL_* या PLIVO_*)।")
                : !tel.publicUrl
                  ? t("PUBLIC_URL is not set — the provider cannot reach this server for audio.", "PUBLIC_URL सेट नहीं है — प्रदाता आवाज़ के लिए इस सर्वर तक नहीं पहुँच सकता।")
                  : t("Voice (GOOGLE_CLOUD_API_KEY) is not configured.", "आवाज़ (GOOGLE_CLOUD_API_KEY) सेट नहीं है।")}
            </p>
          )}
        </Glass>
        <Glass className="p-4 text-xs text-[var(--color-ink-2)]">
          <ul className="space-y-1.5">
            <li>{t("It asks the language first, then: “Shall we begin? Say yes or no.” A no keeps nothing.", "पहले पूछता है: “क्या हम शुरू करें? हाँ या ना बोलिए।” ना कहने पर कुछ नहीं रखा जाता।")}</li>
            <li>{t("The phone number is never kept, only a one-way code.", "फ़ोन नंबर कभी नहीं रखा जाता, केवल एक कोड।")}</li>
            {from && <li>{t(`Calls come from ${from}.`, `कॉल ${from} से आती है।`)}</li>}
          </ul>
        </Glass>
      </div>
      <div className="space-y-4">
        <Glass className="p-4">
          <div className="label mb-2">{t("Phone calls", "फ़ोन कॉल")} · {calls.length}</div>
          {calls.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">{t("No phone calls yet. Dial a teacher on the left.", "अभी तक कोई फ़ोन कॉल नहीं। बाईं ओर से किसी शिक्षक को फ़ोन करें।")}</p>
          ) : (
            <ul className="scroll-thin max-h-[320px] space-y-1 overflow-y-auto">
              {calls.map((r) => {
                const cs = r.call_status ? CALL_STATE[r.call_status] ?? [r.call_status, r.call_status, "var(--tone-muted)"] : null;
                return (
                  <li key={r.id}>
                    <button className={cx("flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm", open === r.id ? "bg-white/12" : "hover:bg-white/6")} onClick={() => setOpen(r.id)}>
                      <span className="min-w-0 truncate">{r.teacher_name || t("Teacher", "शिक्षक")} · {r.school_name || "—"}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {cs && <span className="chip text-xs" style={{ borderColor: tint(cs[2], 55), background: tint(cs[2], 12) }}>{t(cs[0], cs[1])}</span>}
                        <StatusChip s={r.status} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Glass>
        {open && <InterviewDetail id={open} onDeleted={() => (setOpen(null), reload())} />}
      </div>
    </div>
  );
}
