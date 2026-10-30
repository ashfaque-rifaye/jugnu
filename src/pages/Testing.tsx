// The test lab: every feature tried for real and marked as working or not, the "you said, we changed"
// log, and sessions with real teachers, coordinators and officers (consent, tasks, a short survey).
import { CheckCircle2, ClipboardList, Download, ExternalLink, Loader2, Play, Square, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { sendFeedback, useSession, VoiceText, type Role } from "../components/Feedback";
import { Glass, SectionTitle, StatTile, cx } from "../components/ui";
import { getJSON, postJSON, usePoll } from "../lib/api";
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
    { id: "t-voicenote", en: "Listen to a peer voice note — is it clear enough to try?", hi: "एक साथी का वॉइस नोट सुनें — क्या यह आज़माने लायक साफ़ है?", to: "/review" },
    { id: "t-card", en: "Read a practice card — could you do this tomorrow?", hi: "एक तरीके का कार्ड पढ़ें — क्या आप इसे कल कर सकते हैं?", to: "/practices" },
  ],
  crp: [
    { id: "c-find", en: "Find the verified bright spots in a cluster", hi: "किसी क्लस्टर के सत्यापित अच्छे स्कूल खोजें", to: "/schools" },
    { id: "c-invite", en: "Invite a teacher and send the link on WhatsApp", hi: "किसी शिक्षक को आमंत्रित करें और WhatsApp पर लिंक भेजें", to: "/schools?status=bright" },
    { id: "c-review", en: "Review and approve (or fix) an AI draft", hi: "AI के मसौदे की समीक्षा करें और मंज़ूर (या ठीक) करें", to: "/review" },
    { id: "c-next", en: "Find what to do next for a school that needs support", hi: "मदद चाहने वाले स्कूल के लिए अगला कदम खोजें", to: "/plan" },
    { id: "c-spotcheck", en: "Record a spot check for a school that is waiting for one", hi: "जिस स्कूल की जाँच बाकी है, उसकी मौके की जाँच दर्ज करें", to: "/schools?status=check_due" },
    { id: "c-followup", en: "Record a follow-up call: the teacher has a problem", hi: "फ़ॉलो-अप कॉल दर्ज करें: शिक्षक को कोई दिक्कत है", to: "/results" },
  ],
  beo: [
    { id: "b-ask", en: "Ask Jugnu: which schools need help with maths, and who can show them?", hi: "जुगनू से पूछें: किन स्कूलों को गणित में मदद चाहिए, और कौन दिखा सकता है?", to: "/today?ask=1" },
    { id: "b-stuck", en: "Find the stuck actions and who owns them", hi: "अटके काम और उनके ज़िम्मेदार खोजें", to: "/plan" },
    { id: "b-inflated", en: "Understand why a school's data may be inflated", hi: "समझें कि किसी स्कूल का डेटा बढ़ा-चढ़ा क्यों हो सकता है", to: "/schools?status=check_data" },
    { id: "b-track", en: "Did the practices work? Read the Results page", hi: "क्या तरीके काम आए? 'नतीजे' पेज पढ़ें", to: "/results" },
  ],
  other: [
    { id: "o-tour", en: "Watch the tour and explain Jugnu in one sentence", hi: "टूर देखें और जुगनू को एक वाक्य में समझाएँ", to: "/today" },
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

interface Scenario {
  id: string;
  group: [string, string];
  title: [string, string];
  how: [string, string];
  to?: string;
  external?: boolean;
  run?: "call" | "health";
}

// Real features, used for real: nothing here is simulated, so a pass means it works.
const SCENARIOS: Scenario[] = [
  { id: "lab-call", group: ["Calls and voice", "कॉल और आवाज़"], title: ["Call a phone", "फ़ोन पर कॉल करें"], how: ["Rings a real phone. Jugnu speaks Hindi, listens, and has the conversation.", "असली फ़ोन पर घंटी बजती है। जुगनू हिंदी में बोलता है, सुनता है और बातचीत करता है।"], run: "call" },
  { id: "lab-link", group: ["Calls and voice", "कॉल और आवाज़"], title: ["Talk through a link", "लिंक से बात करें"], how: ["Open the teacher's page and answer by voice or typing.", "शिक्षक का पेज खोलें और बोलकर या लिखकर जवाब दें।"], to: "/talk", external: true },
  { id: "lab-listen", group: ["Calls and voice", "कॉल और आवाज़"], title: ["Listen to a voice note", "वॉइस नोट सुनें"], how: ["Press Listen. The words should light up as they are read, and Stop should stop it.", "सुनें दबाएँ। पढ़ते समय शब्द चमकने चाहिए, और बंद करने पर रुकना चाहिए।"], to: "/review" },
  { id: "lab-ask", group: ["Calls and voice", "कॉल और आवाज़"], title: ["Ask Jugnu a question", "जुगनू से सवाल पूछें"], how: ["Ask which schools need help with maths, and who can show them.", "पूछें किन स्कूलों को गणित में मदद चाहिए और कौन दिखा सकता है।"], to: "/today?ask=1" },
  { id: "lab-ai", group: ["Calls and voice", "कॉल और आवाज़"], title: ["Check the AI services", "AI सेवाएँ जाँचें"], how: ["Makes one small real request to each service.", "हर सेवा को एक छोटा असली अनुरोध भेजता है।"], run: "health" },
  { id: "lab-approve", group: ["Approve and share", "मंज़ूर करें और पहुँचाएँ"], title: ["Approve a draft", "ड्राफ़्ट मंज़ूर करें"], how: ["Approve one voice note. The count at the top should change.", "एक वॉइस नोट मंज़ूर करें। ऊपर की गिनती बदलनी चाहिए।"], to: "/review" },
  { id: "lab-rollout", group: ["Approve and share", "मंज़ूर करें और पहुँचाएँ"], title: ["Follow a rollout", "रोलआउट देखें"], how: ["Open an approved method. Can you see who does what, and how far it has got?", "कोई मंज़ूर तरीका खोलें। क्या दिखता है कौन क्या करेगा, और कितना हुआ?"], to: "/plan" },
  { id: "lab-board", group: ["Approve and share", "मंज़ूर करें और पहुँचाएँ"], title: ["Drag a task, then sign it off", "काम खींचें, फिर पुष्टि करें"], how: ["Drag a card to Done as a school head: it should wait for sign-off. Sign it off as the BEO.", "प्रधानाध्यापक बनकर कार्ड को 'पूरा' में खींचें: उसे पुष्टि का इंतज़ार करना चाहिए। फिर BEO बनकर पुष्टि करें।"], to: "/plan?view=board" },
  { id: "lab-audit", group: ["Approve and share", "मंज़ूर करें और पहुँचाएँ"], title: ["Find a change in the history", "इतिहास में बदलाव खोजें"], how: ["The move you just made should appear, with who did it and when.", "आपका बदलाव दिखना चाहिए, किसने और कब किया।"], to: "/plan?view=history" },
  { id: "lab-visit", group: ["In the field", "मैदान में"], title: ["Record a school visit", "स्कूल का दौरा दर्ज करें"], how: ["Enter how many of 15 children read and did the sum. The school's status should change.", "15 में से कितने बच्चों ने पढ़ा और सवाल किया, भरें। स्कूल की स्थिति बदलनी चाहिए।"], to: "/schools?status=check_due" },
  { id: "lab-weekly", group: ["In the field", "मैदान में"], title: ["Send a weekly report", "साप्ताहिक रिपोर्ट भेजें"], how: ["Open a school's People tab, and send the report. It should count in the rollout.", "स्कूल का 'लोग' टैब खोलें और रिपोर्ट भेजें। यह रोलआउट में गिननी चाहिए।"], to: "/schools" },
  { id: "lab-safety", group: ["In the field", "मैदान में"], title: ["Try the safety filter", "सुरक्षा फ़िल्टर आज़माएँ"], how: ["Say or type a phone number. It should be removed.", "फ़ोन नंबर बोलें या लिखें। वह हट जाना चाहिए।"], to: "/ai" },
];

export default function TestingPage() {
  const t = useT();
  const { lang } = usePrefs();
  const session = useSession();
  const hi = lang === "hi" && "font-deva";
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.9rem] font-semibold leading-tight tracking-[-0.035em]">{t("Test lab", "टेस्ट लैब")}</h1>
        <p className={cx("mt-1 max-w-3xl text-[15px] text-[var(--color-ink-2)]", hi)}>
          {t("Try each feature for real and record what happened. Calls ring real phones and saves are shared with everyone, so nothing here is pretend.", "हर सुविधा असल में आज़माएँ और जो हुआ वह दर्ज करें। कॉल असली फ़ोन पर जाती है और सहेजा हुआ सबको दिखता है, इसलिए यहाँ कुछ भी नकली नहीं।")}
        </p>
      </div>
      <Scenarios />
      <Changes />
      <ResetDemo />
      <details className="card p-5">
        <summary className={cx("tap-link cursor-pointer font-semibold", hi)}>{t("Run a session with a person", "किसी व्यक्ति के साथ सत्र करें")}</summary>
        <p className={cx("mt-1 text-sm text-[var(--color-ink-2)]", hi)}>{t("A 20-minute session with a teacher, coordinator or officer: consent, a few tasks, and a short survey.", "शिक्षक, समन्वयक या अधिकारी के साथ 20 मिनट का सत्र: अनुमति, कुछ काम, और छोटा सर्वे।")}</p>
        <div className="mt-4 space-y-5">
          {session.id && session.role ? <ActiveSession role={session.role} id={session.id} onEnd={session.end} /> : <StartSession onStart={session.begin} />}
          <Results />
        </div>
      </details>
    </div>
  );
}

function Scenarios() {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const [summary, , reload] = usePoll<Summary>("/api/testing/summary", 20000);
  const groups = [...new Map(SCENARIOS.map((x) => [x.group[0], x.group])).values()];
  const score = (id: string) => summary?.tasks.find((k) => k.task === id);
  const tried = SCENARIOS.filter((x) => score(x.id)).length;
  const problems = SCENARIOS.filter((x) => {
    const k = score(x.id);
    return k && k.done < k.total;
  }).length;
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <span className={cx("text-sm", hi)}>
          <b className="font-display text-xl tabular-nums">{tried}</b> <span className="text-[var(--color-ink-2)]">{t(`of ${SCENARIOS.length} tried`, `${SCENARIOS.length} में से आज़माए`)}</span>
        </span>
        <span className={cx("text-sm", hi)}>
          <b className="font-display text-xl tabular-nums" style={problems ? { color: "var(--tone-bad)" } : undefined}>{problems}</b> <span className="text-[var(--color-ink-2)]">{t("with a problem", "में समस्या")}</span>
        </span>
      </div>
      {groups.map((g) => (
        <section key={g[0]}>
          <h2 className={cx("label mb-2 px-1", hi)}>{t(...g)}</h2>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {SCENARIOS.filter((x) => x.group[0] === g[0]).map((x) => (
              <ScenarioCard key={x.id} x={x} result={score(x.id)} onSaved={reload} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ScenarioCard({ x, result, onSaved }: { x: Scenario; result?: { done: number; total: number }; onSaved: () => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [phone, setPhone] = useState("+91");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const mark = async (rating: number, text?: string) => {
    await sendFeedback({ page: x.to ?? "/testing", kind: "task", task: x.id, rating, text: text || null, lang }).catch(() => {});
    setSaved(rating);
    setAsking(false);
    setNote("");
    onSaved();
  };
  const call = async () => {
    setBusy(true);
    setOut(null);
    try {
      await postJSON("/api/ivr/call", { to: phone, teacherName: "Test lab", schoolName: "Test lab", group: "live", language: "hi" });
      setOut({ ok: true, text: t("Ringing now. Answer the phone and say yes to begin.", "घंटी जा रही है। फ़ोन उठाकर हाँ बोलें।") });
    } catch (e) {
      setOut({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const health = async () => {
    setBusy(true);
    setOut(null);
    try {
      const h = await getJSON<{ ok: boolean; claude: { ok: boolean }; speaking: { ok: boolean }; listening: { ok: boolean } }>("/api/ai/health");
      const word = (ok: boolean) => (ok ? t("working", "चालू") : t("not working", "बंद"));
      setOut({ ok: h.ok, text: t(`Thinking: ${word(h.claude.ok)} · Speaking: ${word(h.speaking.ok)} · Listening: ${word(h.listening.ok)}`, `सोचना: ${word(h.claude.ok)} · बोलना: ${word(h.speaking.ok)} · सुनना: ${word(h.listening.ok)}`) });
    } catch (e) {
      setOut({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const last = saved ?? (result ? (result.done === result.total ? 5 : 1) : null);
  return (
    <li className="card flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className={cx("font-semibold", hi)}>{t(...x.title)}</h3>
        {last != null && (
          <span className={cx("chip shrink-0 !text-xs", hi)} style={{ color: last >= 4 ? "var(--tone-good)" : "var(--tone-bad)" }}>
            {last >= 4 ? <CheckCircle2 size={12} /> : <TriangleAlert size={12} />} {last >= 4 ? t("Worked", "चला") : t("Problem", "समस्या")}
          </span>
        )}
      </div>
      <p className={cx("mt-1 flex-1 text-sm text-[var(--color-ink-2)]", hi)}>{t(...x.how)}</p>
      <div className="mt-3">
        {x.run === "call" && (
          <div className="flex gap-2">
            <input className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--inset-bg)] px-3 py-2 font-mono text-sm outline-none" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" aria-label={t("Mobile number", "मोबाइल नंबर")} />
            <button className="btn btn-primary" onClick={call} disabled={busy || phone.length < 10}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} {t("Call", "कॉल")}
            </button>
          </div>
        )}
        {x.run === "health" && (
          <button className="btn btn-primary" onClick={health} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} {t("Run the check", "जाँच चलाएँ")}
          </button>
        )}
        {x.to && (
          <Link className="btn btn-glass" to={x.to} target={x.external ? "_blank" : undefined}>
            <ExternalLink size={14} /> {t("Open", "खोलें")}
          </Link>
        )}
        {out && <p className={cx("mt-2 text-sm", hi)} style={{ color: out.ok ? "var(--tone-good)" : "var(--tone-bad)" }}>{out.text}</p>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] pt-3">
        <span className={cx("mr-1 text-xs text-[var(--color-ink-3)]", hi)}>{t("Did it work?", "क्या चला?")}</span>
        <button className="chip" onClick={() => void mark(5)}>
          <CheckCircle2 size={12} /> {t("Yes", "हाँ")}
        </button>
        <button className="chip" onClick={() => setAsking((v) => !v)}>
          <TriangleAlert size={12} /> {t("No", "नहीं")}
        </button>
      </div>
      {asking && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void mark(1, note.trim());
          }}
        >
          <input className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--inset-bg)] px-3 py-2 text-sm outline-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("What went wrong?", "क्या गलत हुआ?")} autoFocus />
          <button className="btn btn-primary">{t("Save", "सहेजें")}</button>
        </form>
      )}
    </li>
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
  from: string;
  fromHi?: string;
  heard: string;
  heardHi?: string;
  changed: string;
  changedHi?: string;
}

/** The refinement log, from data/changes.json. Open to everyone, including visitors without the passcode. */
function Changes() {
  const t = useT();
  const { lang } = usePrefs();
  const [changes] = usePoll<Change[]>("/api/testing/changes");
  const deva = lang === "hi" && "font-deva";
  return (
    <Glass className="p-5">
      <SectionTitle
        eyebrow={t("Refinement", "सुधार")}
        title={t("You said, we changed", "आपने कहा, हमने बदला")}
        sub={t("From the team's internal review and AI-run walkthroughs so far, not testing with teachers or officers.", "अब तक टीम की आंतरिक समीक्षा और AI से कराए गए परीक्षण से, शिक्षकों या अधिकारियों के साथ परीक्षण से नहीं।")}
      />
      <div className="mb-2 hidden grid-cols-2 gap-5 px-4 md:grid">
        <div className="label">{t("You said", "आपने कहा")}</div>
        <div className="label">{t("We changed", "हमने बदला")}</div>
      </div>
      <ul className="space-y-2">
        {(changes ?? []).map((c, i) => (
          <li key={i} className="glass-inset grid gap-3 p-4 text-sm leading-relaxed md:grid-cols-2 md:gap-5">
            <div>
              <div className="label mb-1 md:hidden">{t("You said", "आपने कहा")}</div>
              <div className={cx("text-[var(--color-ink-2)]", deva)}>{t(c.heard, c.heardHi ?? c.heard)}</div>
              <div className={cx("mt-1 text-xs text-[var(--color-ink-3)]", deva)}>
                {t(c.from, c.fromHi ?? c.from)} · {new Date(c.date).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <div>
              <div className="label mb-1 md:hidden">{t("We changed", "हमने बदला")}</div>
              <div className={cx("font-medium", deva)}>{t(c.changed, c.changedHi ?? c.changed)}</div>
            </div>
          </li>
        ))}
        {(changes ?? []).length === 0 && <li className="text-sm text-[var(--color-ink-3)]">{t("Changes made from testing will be listed here.", "परीक्षण से किए बदलाव यहाँ दिखेंगे।")}</li>}
      </ul>
    </Glass>
  );
}

function Results() {
  const t = useT();
  const [s, err] = usePoll<Summary>("/api/testing/summary", 10000);
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
        sub={t("Sessions recorded so far are internal role-play by the team.", "अब तक दर्ज सत्र टीम का आंतरिक अभ्यास हैं।")}
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
          <div className="mt-5">
            <div className="label mb-2">{t("Latest comments", "ताज़ा राय")}</div>
            <ul className="scroll-thin space-y-2 lg:max-h-72 lg:overflow-y-auto lg:pr-1">
              {s.comments.slice(0, 40).map((c, i) => (
                <li key={i} className="glass-inset p-3 text-sm">
                  <div className="font-deva">{c.text}</div>
                  <div className="mt-1 text-xs text-[var(--color-ink-3)]">
                    {c.role ?? t("visitor", "आगंतुक")} · {c.page} · {new Date(c.created_at).toLocaleDateString()}
                  </div>
                </li>
              ))}
              {s.comments.length === 0 && <li className="text-sm text-[var(--color-ink-3)]">{t("No comments yet.", "अभी कोई राय नहीं।")}</li>}
            </ul>
          </div>
        </>
      )}
    </Glass>
  );
}
