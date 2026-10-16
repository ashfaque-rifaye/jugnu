// User-testing mode for sessions with real teachers, CRPs and BEOs: consent, role-specific tasks
// (done easily / with help / couldn't), the System Usability Scale in Hindi or English, and a
// results dashboard with the "you said → we changed" log — the evidence judges ask for.
import { CheckCircle2, ClipboardList, Download, ExternalLink, Loader2, Play, Square, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { sendFeedback, useSession, VoiceText, type Role } from "../components/Feedback";
import { Glass, SectionTitle, StatTile, cx } from "../components/ui";
import { postJSON, usePoll } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";

interface Task {
  id: string;
  en: string;
  hi: string;
  to: string;
}

const TASKS: Record<Role, Task[]> = {
  teacher: [
    { id: "t-interview", en: "Take a 12-minute interview with Jugnu by voice", hi: "जुगनू से आवाज़ में 12 मिनट बात करें", to: "/talk" },
    { id: "t-voicenote", en: "Listen to a peer voice note — is it clear enough to try?", hi: "एक साथी का वॉइस नोट सुनें — क्या यह आज़माने लायक साफ़ है?", to: "/plan" },
    { id: "t-card", en: "Read a practice card — could you do this tomorrow?", hi: "एक तरीके का कार्ड पढ़ें — क्या आप इसे कल कर सकते हैं?", to: "/review" },
  ],
  crp: [
    { id: "c-find", en: "Find the verified bright spots in a cluster", hi: "किसी क्लस्टर के सत्यापित अच्छे स्कूल खोजें", to: "/schools" },
    { id: "c-invite", en: "Invite a teacher and send the link on WhatsApp", hi: "किसी शिक्षक को आमंत्रित करें और WhatsApp पर लिंक भेजें", to: "/schools?status=bright" },
    { id: "c-review", en: "Review and approve (or fix) a practice card", hi: "किसी कार्ड की समीक्षा करें और मंज़ूर (या ठीक) करें", to: "/review" },
    { id: "c-next", en: "Find what to do next for a school that needs support", hi: "मदद चाहने वाले स्कूल के लिए अगला कदम खोजें", to: "/plan" },
    { id: "c-spotcheck", en: "Record a spot check for a school that is waiting for one", hi: "जिस स्कूल की जाँच बाकी है, उसकी मौके की जाँच दर्ज करें", to: "/schools?status=check_due" },
    { id: "c-followup", en: "Record a follow-up call: the teacher has a problem", hi: "फ़ॉलो-अप कॉल दर्ज करें: शिक्षक को कोई दिक्कत है", to: "/results" },
  ],
  beo: [
    { id: "b-ask", en: "Ask Jugnu: which schools need help with maths, and who can show them?", hi: "जुगनू से पूछें: किन स्कूलों को गणित में मदद चाहिए, और कौन दिखा सकता है?", to: "/?ask=1" },
    { id: "b-stuck", en: "Find the stuck actions and who owns them", hi: "अटके काम और उनके ज़िम्मेदार खोजें", to: "/plan" },
    { id: "b-inflated", en: "Understand why a school's data may be inflated", hi: "समझें कि किसी स्कूल का डेटा बढ़ा-चढ़ा क्यों हो सकता है", to: "/schools" },
    { id: "b-track", en: "Did the practices work? Read the Results page", hi: "क्या तरीके काम आए? 'नतीजे' पेज पढ़ें", to: "/results" },
  ],
  other: [
    { id: "o-tour", en: "Watch the tour and explain Jugnu in one sentence", hi: "टूर देखें और जुगनू को एक वाक्य में समझाएँ", to: "/" },
    { id: "o-interview", en: "Take the teacher interview", hi: "शिक्षक वाली बातचीत करें", to: "/talk" },
  ],
};

const SUS: { en: string; hi: string }[] = [
  { en: "I think I would like to use Jugnu often.", hi: "मुझे लगता है कि मैं जुगनू का अक्सर इस्तेमाल करना चाहूँगा/चाहूँगी।" },
  { en: "I found Jugnu unnecessarily complicated.", hi: "जुगनू मुझे बेवजह जटिल लगा।" },
  { en: "Jugnu was easy to use.", hi: "जुगनू इस्तेमाल करना आसान था।" },
  { en: "I would need help from a technical person to use Jugnu.", hi: "जुगनू चलाने के लिए मुझे किसी तकनीकी व्यक्ति की मदद चाहिए होगी।" },
  { en: "The different parts of Jugnu fit well together.", hi: "जुगनू के अलग-अलग हिस्से अच्छी तरह जुड़े हुए हैं।" },
  { en: "Too many things in Jugnu were inconsistent.", hi: "जुगनू में बहुत-सी चीज़ें बेमेल थीं।" },
  { en: "Most people would learn to use Jugnu very quickly.", hi: "ज़्यादातर लोग जुगनू बहुत जल्दी सीख लेंगे।" },
  { en: "Jugnu was very awkward to use.", hi: "जुगनू इस्तेमाल करना बहुत अटपटा था।" },
  { en: "I felt confident using Jugnu.", hi: "जुगनू इस्तेमाल करते समय मुझे भरोसा था।" },
  { en: "I had to learn a lot before I could use Jugnu.", hi: "जुगनू इस्तेमाल करने से पहले मुझे बहुत कुछ सीखना पड़ा।" },
];

const ROLES: [Role, string, string][] = [
  ["teacher", "Teacher", "शिक्षक"],
  ["crp", "CRP / cluster coordinator", "CRP / क्लस्टर समन्वयक"],
  ["beo", "BEO / block team", "BEO / ब्लॉक टीम"],
  ["other", "Other", "अन्य"],
];

export default function TestingPage() {
  const t = useT();
  const session = useSession();
  return (
    <div className="space-y-5">
      <Glass strong className="p-5 md:p-7">
        <div className="label">{t("User testing", "उपयोगकर्ता परीक्षण")}</div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t("Test Jugnu with the people who will use it", "जुगनू को उन लोगों के साथ परखें जो इसे इस्तेमाल करेंगे")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-2)]">
          {t(
            "A 20-minute session: consent, three or four real tasks, a 10-question usability survey, and open comments by voice. Every rating and comment is tagged with the role and page, and what we change because of it is logged below.",
            "20 मिनट का सत्र: अनुमति, तीन-चार असली काम, 10 सवालों का उपयोगिता सर्वे, और आवाज़ में खुली राय। हर राय पर भूमिका और पेज दर्ज होता है, और उससे जो बदला गया वह नीचे लिखा जाता है।",
          )}
        </p>
      </Glass>
      {session.id && session.role ? <ActiveSession role={session.role} id={session.id} onEnd={session.end} /> : <StartSession onStart={session.begin} />}
      <ResetDemo />
      <Results />
    </div>
  );
}

/** Before a session: clear what earlier testers recorded in the demo block (real interviews are kept). */
function ResetDemo() {
  const t = useT();
  const { state, events, resetBlock } = usePipeline();
  const [busy, setBusy] = useState(false);
  if (state.block.source !== "simulated") return null;
  return (
    <Glass className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="text-sm">
        <div className="font-semibold">{t("Start the demo block fresh", "डेमो ब्लॉक नए सिरे से शुरू करें")}</div>
        <div className="text-[var(--color-ink-2)]">
          {t(`${events.length} recorded actions, spot checks and follow-up calls. Clearing them gives the next tester the same starting point. Real interviews and survey answers are kept.`, `${events.length} दर्ज काम, जाँचें और फ़ॉलो-अप कॉल। इन्हें हटाने से अगले परीक्षक को वही शुरुआत मिलती है। असली बातचीत और सर्वे के जवाब बने रहते हैं।`)}
        </div>
      </div>
      <button
        className="btn btn-glass"
        disabled={busy || !events.length}
        onClick={async () => {
          if (!window.confirm(t("Clear everything recorded in the demo block?", "डेमो ब्लॉक में दर्ज सब कुछ हटाएँ?"))) return;
          setBusy(true);
          await resetBlock().catch(() => null);
          setBusy(false);
        }}
      >
        {t("Clear recorded actions", "दर्ज काम हटाएँ")}
      </button>
    </Glass>
  );
}

function StartSession({ onStart }: { onStart: (id: string, role: Role) => void }) {
  const t = useT();
  const [role, setRole] = useState<Role>("teacher");
  const [place, setPlace] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    const r = await postJSON<{ id: string }>("/api/testing/sessions", { role, place, consent }).catch(() => null);
    setBusy(false);
    if (r) onStart(r.id, role);
  };
  return (
    <Glass className="p-5">
      <SectionTitle eyebrow={t("Facilitator", "संचालक")} title={t("Start a session", "सत्र शुरू करें")} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="label mb-2">{t("Participant's role", "प्रतिभागी की भूमिका")}</div>
          <div className="grid gap-2">
            {ROLES.map(([r, en, hi]) => (
              <button key={r} className={cx("glass-inset p-3 text-left text-sm", role === r && "ring-1 ring-amber-200/70")} onClick={() => setRole(r)}>
                {t(en, hi)}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs text-[var(--color-ink-3)]">
            {t("Block / district (optional)", "ब्लॉक / ज़िला (वैकल्पिक)")}
            <input value={place} onChange={(e) => setPlace(e.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm outline-none" />
          </label>
        </div>
        <div className="glass-inset p-4 text-sm leading-relaxed">
          <div className="label mb-2">{t("Read this aloud", "यह पढ़कर सुनाएँ")}</div>
          <p className="font-deva">
            हम जुगनू नाम का एक नया साधन परख रहे हैं — आपको नहीं। कोई जवाब गलत नहीं है। हम आपके काम करने के तरीके और आपकी राय दर्ज करेंगे, आपका नाम या फ़ोन नंबर नहीं। आप कभी भी रुक सकते हैं।
          </p>
          <p className="mt-2 text-[var(--color-ink-3)]">We are testing a new tool called Jugnu — not you. There are no wrong answers. We record how you use it and what you think, not your name or phone number. You can stop at any time.</p>
          <label className="mt-4 flex items-start gap-2">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <span>{t("The participant agreed to take part.", "प्रतिभागी ने भाग लेने की सहमति दी।")}</span>
          </label>
          <button className="btn btn-primary mt-4" disabled={!consent || busy} onClick={start}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} {t("Start session", "सत्र शुरू करें")}
          </button>
        </div>
      </div>
    </Glass>
  );
}

function ActiveSession({ role, id, onEnd }: { role: Role; id: string; onEnd: () => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const [done, setDone] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [sus, setSus] = useState<(number | null)[]>(Array(10).fill(null));
  const [score, setScore] = useState<number | null>(null);
  const mark = async (task: Task, rating: number) => {
    setDone((d) => ({ ...d, [task.id]: rating }));
    await sendFeedback({ page: task.to, kind: "task", task: task.id, rating, text: comments[task.id] || null, lang }).catch(() => {});
  };
  const submitSus = async () => {
    const r = await postJSON<{ score: number }>(`/api/testing/sessions/${id}/sus`, { answers: sus }).catch(() => null);
    if (r) setScore(r.score);
  };
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Glass className="p-5">
        <SectionTitle
          eyebrow={`${t("Session running", "सत्र जारी")} · ${t(ROLES.find((r) => r[0] === role)![1], ROLES.find((r) => r[0] === role)![2])}`}
          title={t("Tasks", "काम")}
          sub={t("Open each task, let the participant try without help, then record how it went.", "हर काम खोलें, प्रतिभागी को बिना मदद के करने दें, फिर दर्ज करें कि कैसा रहा।")}
          right={
            <button className="btn btn-glass" onClick={onEnd}>
              <Square size={14} /> {t("End session", "सत्र खत्म")}
            </button>
          }
        />
        <ol className="space-y-3">
          {TASKS[role].map((task, i) => (
            <li key={task.id} className="glass-inset p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    {i + 1}. {t(task.en, task.hi)}
                  </div>
                </div>
                <Link className="btn btn-glass shrink-0 !py-1" to={task.to} target={task.to === "/talk" ? "_blank" : undefined}>
                  <ExternalLink size={13} /> {t("Open", "खोलें")}
                </Link>
              </div>
              <div className="mt-3">
                <VoiceText rows={2} value={comments[task.id] ?? ""} onChange={(v) => setComments((c) => ({ ...c, [task.id]: v }))} placeholder={t("What did they say or struggle with?", "उन्होंने क्या कहा, कहाँ अटके?")} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    [5, t("Done easily", "आसानी से किया")],
                    [3, t("Done with help", "मदद से किया")],
                    [1, t("Couldn't do it", "नहीं कर पाए")],
                  ] as const
                ).map(([r, label]) => (
                  <button key={r} className={cx("chip", done[task.id] === r && "bg-white/20 text-white")} onClick={() => mark(task, r)}>
                    {done[task.id] === r && <CheckCircle2 size={12} />} {label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </Glass>
      <Glass className="p-5">
        <SectionTitle eyebrow={t("After the tasks", "काम के बाद")} title={t("Usability survey (SUS)", "उपयोगिता सर्वे (SUS)")} sub={t("1 = strongly disagree · 5 = strongly agree", "1 = बिल्कुल असहमत · 5 = पूरी तरह सहमत")} />
        {score !== null ? (
          <div className="glass-inset p-6 text-center">
            <div className="label">SUS</div>
            <div className="text-5xl font-bold">{score}</div>
            <div className="mt-1 text-sm text-[var(--color-ink-3)]">{score >= 80 ? t("Excellent", "बहुत अच्छा") : score >= 68 ? t("Above average", "औसत से बेहतर") : t("Needs work", "सुधार चाहिए")}</div>
          </div>
        ) : (
          <>
            <ol className="space-y-2">
              {SUS.map((q, i) => (
                <li key={i} className="glass-inset flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span className={cx("max-w-md", lang === "hi" && "font-deva")}>
                    {i + 1}. {t(q.en, q.hi)}
                  </span>
                  <span className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button key={v} className={cx("h-8 w-8 rounded-full text-sm", sus[i] === v ? "accent-solid font-bold" : "bg-white/10")} onClick={() => setSus((s) => s.map((x, k) => (k === i ? v : x)))}>
                        {v}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
            <button className="btn btn-primary mt-4" disabled={sus.some((x) => x === null)} onClick={submitSus}>
              <ClipboardList size={15} /> {t("Submit survey", "सर्वे जमा करें")}
            </button>
          </>
        )}
      </Glass>
    </div>
  );
}

interface Summary {
  sessions: Record<Role, number>;
  sus: { n: number; mean: number | null; byRole: { role: string; score: number }[] };
  tasks: { task: string; done: number; total: number }[];
  pages: { page: string; n: number; mean: number }[];
  comments: { role: string | null; page: string; text: string; kind: string; created_at: string; task: string | null }[];
}
interface Change {
  date: string;
  heard: string;
  from: string;
  changed: string;
}

function Results() {
  const t = useT();
  const [s, err] = usePoll<Summary>("/api/testing/summary", 10000);
  const [changes] = usePoll<Change[]>("/api/testing/changes");
  const taskName = (id: string) => Object.values(TASKS).flat().find((x) => x.id === id);
  const exportCsv = () => {
    if (!s) return;
    const rows = [["created_at", "role", "page", "kind", "task", "text"], ...s.comments.map((c) => [c.created_at, c.role ?? "", c.page, c.kind, c.task ?? "", (c.text ?? "").replace(/"/g, '""')])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map((x) => `"${x}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "jugnu-feedback.csv";
    a.click();
  };
  return (
    <Glass className="p-5">
      <SectionTitle
        eyebrow={t("Evidence", "प्रमाण")}
        title={t("What testers told us", "परीक्षकों ने क्या बताया")}
        right={
          <button className="btn btn-glass" onClick={exportCsv} disabled={!s}>
            <Download size={14} /> CSV
          </button>
        }
      />
      {err && <p className="text-sm text-[var(--color-ink-3)]">{err}</p>}
      {s && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatTile label={t("Teachers", "शिक्षक")} value={s.sessions.teacher} />
            <StatTile label="CRPs" value={s.sessions.crp} />
            <StatTile label="BEOs" value={s.sessions.beo} />
            <StatTile label={t("Mean SUS", "औसत SUS")} value={s.sus.mean ?? "—"} sub={`${s.sus.n} ${t("surveys", "सर्वे")}`} />
            <StatTile label={t("Comments", "राय")} value={s.comments.length} />
          </div>
          {s.tasks.length > 0 && (
            <div className="mt-5">
              <div className="label mb-2">{t("Task success (done without help)", "काम की सफलता (बिना मदद)")}</div>
              <ul className="space-y-1.5">
                {s.tasks.map((k) => {
                  const task = taskName(k.task);
                  const pct = Math.round((100 * k.done) / Math.max(1, k.total));
                  return (
                    <li key={k.task} className="grid grid-cols-[1fr_120px_60px] items-center gap-3 text-sm">
                      <span className="truncate">{task ? t(task.en, task.hi) : k.task}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full rounded-full bg-teal-300" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="text-right tabular-nums text-[var(--color-ink-2)]">
                        {k.done}/{k.total}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="label mb-2">{t("Latest comments", "ताज़ा राय")}</div>
              <ul className="scroll-thin space-y-2 lg:max-h-72 lg:overflow-y-auto lg:pr-1">
                {s.comments.slice(0, 40).map((c, i) => (
                  <li key={i} className="glass-inset p-3 text-sm">
                    <div className="font-deva">{c.text}</div>
                    <div className="mt-1 text-[11px] text-[var(--color-ink-3)]">
                      {c.role ?? t("visitor", "आगंतुक")} · {c.page} · {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </li>
                ))}
                {s.comments.length === 0 && <li className="text-sm text-[var(--color-ink-3)]">{t("No comments yet.", "अभी कोई राय नहीं।")}</li>}
              </ul>
            </div>
            <div>
              <div className="label mb-2 flex items-center gap-1">
                <Users size={13} /> {t("You said → we changed", "आपने कहा → हमने बदला")}
              </div>
              <ul className="scroll-thin space-y-2 lg:max-h-72 lg:overflow-y-auto lg:pr-1">
                {(changes ?? []).map((c, i) => (
                  <li key={i} className="glass-inset p-3 text-sm">
                    <div className="text-[var(--color-ink-2)]">“{c.heard}” <span className="text-[11px] text-[var(--color-ink-3)]">— {c.from}</span></div>
                    <div className="mt-1 text-teal-200">→ {c.changed}</div>
                    <div className="mt-1 text-[11px] text-[var(--color-ink-3)]">{c.date}</div>
                  </li>
                ))}
                {(changes ?? []).length === 0 && <li className="text-sm text-[var(--color-ink-3)]">{t("Changes made from testing will be listed here.", "परीक्षण से किए बदलाव यहाँ दिखेंगे।")}</li>}
              </ul>
            </div>
          </div>
        </>
      )}
    </Glass>
  );
}
