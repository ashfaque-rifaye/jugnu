// Safety, in plain words. It runs by itself on everything anyone writes or says: personal numbers and
// bad language are removed, sensitive topics are flagged. You can also try it yourself, by voice or typing.
import { Check, EyeOff, Hash, Loader2, Mail, MessageSquareOff, Phone, ShieldCheck, ShieldQuestion, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { VoiceText } from "../components/Feedback";
import { Card, PageHeader } from "../components/kit";
import { cx } from "../components/ui";
import { postJSON, usePoll } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";

interface Summary {
  totals: Record<string, number>;
  recent: { kind: string; source: string; count: number; created_at: string }[];
  answersChecked: number;
  aiChecked: number;
  aiStopped: number;
  declined: number;
}
interface CheckResult {
  text: string;
  safe: boolean;
  findings: { kind: string; count: number; label: string; detail?: string }[];
}

const KINDS: { kind: string; icon: typeof Phone; en: string; hi: string; what: [string, string] }[] = [
  { kind: "phone", icon: Phone, en: "Phone numbers", hi: "फ़ोन नंबर", what: ["Removed before anything is saved", "सहेजने से पहले हटाए जाते हैं"] },
  { kind: "id", icon: Hash, en: "ID numbers", hi: "पहचान नंबर", what: ["Such as Aadhaar. Removed", "जैसे आधार। हटाए जाते हैं"] },
  { kind: "email", icon: Mail, en: "Email addresses", hi: "ईमेल पते", what: ["Removed", "हटाए जाते हैं"] },
  { kind: "profanity", icon: MessageSquareOff, en: "Bad language", hi: "अपशब्द", what: ["Removed, in Hindi and English", "हिंदी और अंग्रेज़ी में, हटाए जाते हैं"] },
  { kind: "topic", icon: ShieldQuestion, en: "Sensitive topics", hi: "संवेदनशील विषय", what: ["Caste, religion, politics, pay. Flagged, and Jugnu won't ask about them", "जाति, धर्म, राजनीति, वेतन। चिह्नित, और जुगनू इन पर नहीं पूछता"] },
];
const SOURCE: Record<string, [string, string]> = {
  interview: ["a teacher's answer", "शिक्षक का जवाब"],
  comment: ["a comment", "एक राय"],
  action: ["a note on a task", "काम की टिप्पणी"],
  followup: ["a follow-up call", "फ़ॉलो-अप कॉल"],
  weekly: ["a weekly report", "साप्ताहिक रिपोर्ट"],
  note: ["a note", "एक टिप्पणी"],
};

export default function SafetyPage() {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const [s, , reload] = usePoll<Summary>("/api/safety/summary", 15000);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<CheckResult | null>(null);
  const run = async () => {
    setBusy(true);
    const r = await postJSON<CheckResult>("/api/safety/check", { text }).catch(() => null);
    setBusy(false);
    setRes(r);
    reload();
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Safety", "सुरक्षा")}
        sub={t(
          "Jugnu checks everything by itself, every time: what teachers say, what anyone types, and what the AI writes. Nobody has to turn it on or check it.",
          "जुगनू हर बार सब कुछ अपने-आप जाँचता है: शिक्षक क्या कहते हैं, कोई क्या लिखता है, और AI क्या लिखता है। किसी को इसे चालू करने या जाँचने की ज़रूरत नहीं।",
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Card title={t("Try it yourself", "खुद आज़माएँ")} icon={ShieldCheck}>
          <p className={cx("mb-3 text-sm text-[var(--color-ink-2)]", hi)}>{t("Type or speak anything. You'll see exactly what would be kept. Nothing you enter here is saved.", "कुछ भी लिखें या बोलें। आप देखेंगे कि क्या रखा जाएगा। यहाँ जो लिखेंगे वह सहेजा नहीं जाता।")}</p>
          <VoiceText rows={3} value={text} onChange={(v) => (setText(v), setRes(null))} placeholder={t("For example: my number is 98765 43210", "जैसे: मेरा नंबर 98765 43210 है")} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={run} disabled={busy || !text.trim()}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} {t("Check it", "जाँचें")}
            </button>
            <button className={cx("btn btn-glass", hi)} onClick={() => (setText(t("Call me on 98765 43210 or write to rakesh@example.com. It is about my caste.", "मुझे 98765 43210 पर फ़ोन करें या rakesh@example.com पर लिखें। बात मेरी जाति की है।")), setRes(null))}>
              {t("Use an example", "उदाहरण लें")}
            </button>
          </div>
          {res && (
            <div className="card-inset mt-4 p-4">
              <div className={cx("flex items-center gap-2 font-semibold", hi)} style={{ color: res.safe ? "var(--tone-good)" : "var(--tone-warn)" }}>
                {res.safe ? <Check size={16} /> : <EyeOff size={16} />}
                {res.safe ? t("Nothing to remove", "हटाने को कुछ नहीं") : t("Here is what would be kept", "यह रखा जाएगा")}
              </div>
              <p className="mt-2 font-deva text-[15px] leading-relaxed">{res.text}</p>
              {!res.safe && (
                <ul className={cx("mt-2 flex flex-wrap gap-1.5", hi)}>
                  {res.findings.map((f) => {
                    const k = KINDS.find((x) => x.kind === f.kind);
                    return (
                      <li key={f.kind} className="chip !text-xs">
                        {t(k?.en ?? f.label, k?.hi ?? f.label)}
                        {f.kind === "topic" ? `: ${f.detail}` : `: ${f.count}`}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </Card>

        <Card title={t("What it has done so far", "अब तक क्या किया")}>
          <ul className="space-y-2">
            {KINDS.map(({ kind, icon: Icon, en, hi: h, what }) => (
              <li key={kind} className="card-inset flex items-center gap-3 px-3 py-2.5">
                <span className="icon-tile h-9 w-9 shrink-0 rounded-full">
                  <Icon size={16} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx("block text-sm font-medium", hi)}>{t(en, h)}</span>
                  <span className={cx("block text-xs text-[var(--color-ink-2)]", hi)}>{t(...what)}</span>
                </span>
                <b className="font-display text-xl tabular-nums">{s?.totals[kind] ?? 0}</b>
              </li>
            ))}
          </ul>
          <dl className={cx("mt-3 grid grid-cols-2 gap-2 text-sm", hi)}>
            <div className="card-inset p-3">
              <dd className="font-display text-xl font-bold tabular-nums">{s?.answersChecked ?? 0}</dd>
              <dt className="text-xs text-[var(--color-ink-2)]">{t("Teacher answers checked", "शिक्षकों के जवाब जाँचे")}</dt>
            </div>
            <div className="card-inset p-3">
              <dd className="font-display text-xl font-bold tabular-nums">{s?.aiChecked ?? 0}</dd>
              <dt className="text-xs text-[var(--color-ink-2)]">{t(`AI answers checked, ${s?.aiStopped ?? 0} stopped`, `AI के जवाब जाँचे, ${s?.aiStopped ?? 0} रोके`)}</dt>
            </div>
          </dl>
          {!!s?.recent.length && (
            <details className="mt-3">
              <summary className={cx("tap-link cursor-pointer text-sm font-medium text-[var(--color-ink-2)]", hi)}>{t("Latest", "ताज़ा")}</summary>
              <ul className={cx("mt-2 space-y-1 text-xs text-[var(--color-ink-2)]", hi)}>
                {s.recent.map((r, i) => {
                  const k = KINDS.find((x) => x.kind === r.kind);
                  const src = SOURCE[r.source] ?? [r.source, r.source];
                  return (
                    <li key={i}>
                      {new Date(r.created_at).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" })} · {t(k?.en ?? r.kind, k?.hi ?? r.kind)} {t("in", "—")} {t(...src)}
                    </li>
                  );
                })}
              </ul>
              <p className={cx("mt-2 text-xs text-[var(--color-ink-3)]", hi)}>{t("Only the count is kept here, never the words.", "यहाँ सिर्फ़ गिनती रखी जाती है, शब्द कभी नहीं।")}</p>
            </details>
          )}
        </Card>
      </div>

      <Card title={t("Promises that always hold", "वादे जो हमेशा निभते हैं")}>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(
            [
              [UserCheck, t("A person decides", "फ़ैसला इंसान का"), t("Nothing written by AI reaches a teacher until a coordinator or the BEO approves it.", "AI का लिखा कुछ भी समन्वयक या BEO की मंज़ूरी के बिना शिक्षक तक नहीं जाता।")],
              [UserX, t("Teachers can say no", "शिक्षक मना कर सकते हैं"), t(`Every conversation asks first. If a teacher says no, nothing is kept. ${s?.declined ? `${s.declined} have said no so far.` : ""}`, `हर बातचीत पहले अनुमति लेती है। मना करने पर कुछ नहीं रखा जाता।${s?.declined ? ` अब तक ${s.declined} ने मना किया।` : ""}`)],
              [EyeOff, t("No data about children", "बच्चों का कोई डेटा नहीं"), t("Only school-level results and anonymous counts from a visit. No child's name is ever recorded.", "सिर्फ़ स्कूल-स्तर के नतीजे और दौरे की गिनती। किसी बच्चे का नाम कभी दर्ज नहीं होता।")],
              [ShieldCheck, t("Nobody is punished", "किसी को सज़ा नहीं"), t("Schools are never ranked in public. Results that don't match lead to a respectful conversation.", "स्कूलों की सार्वजनिक रैंकिंग नहीं होती। नतीजे मेल न खाएँ तो सम्मान से बातचीत होती है।")],
            ] as const
          ).map(([Icon, title, text]) => (
            <li key={title} className="card-inset p-4">
              <Icon size={18} className="text-[var(--st-bright)]" aria-hidden />
              <div className={cx("mt-2 font-semibold", hi)}>{title}</div>
              <p className={cx("mt-1 text-sm text-[var(--color-ink-2)]", hi)}>{text}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
