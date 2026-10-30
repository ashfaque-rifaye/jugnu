// The people of a school and how a school takes part without anyone chasing every teacher. Each
// school has a head and a point of contact. Talking to a few representatives covers all its classes,
// and the contact forwards the links and sends one short report a week. No phone numbers are shown.
import { Check, ClipboardList, Copy, Link2, Loader2, Minus, Plus, Send, UserRound, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { representatives, SUBJECT_INFO } from "../engine/subjects";
import type { School, Staff } from "../engine/types";
import { postJSON, usePoll } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";
import { weeklyReports } from "../lib/rollout";
import { PRACTICES } from "../engine/practices";
import { usePipeline } from "../lib/store";
import { VoiceText } from "./Feedback";
import { Card, Meter } from "./kit";
import { cx } from "./ui";

interface Row {
  id: string;
  token: string;
  school_id: string | null;
  teacher_name: string | null;
  status: "invited" | "in_progress" | "completed" | "declined";
}

const STATUS: Record<Row["status"], [string, string, string]> = {
  invited: ["Link sent", "लिंक भेजा", "var(--tone-info)"],
  in_progress: ["Talking now", "बात जारी", "var(--tone-warn)"],
  completed: ["Done", "पूरी", "var(--tone-good)"],
  declined: ["Said no", "मना किया", "var(--tone-muted)"],
};

export function SchoolPeople({ school: s, group }: { school: School; group: "bright" | "comparison" | "live" }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const [rows, , reload] = usePoll<Row[]>("/api/interviews", 8000);
  const [busy, setBusy] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const staff = s.staff;
  const reps = useMemo(() => representatives(staff.filter((p) => p.grades.length)), [staff]);
  const repIds = new Set(reps.map((p) => p.id));
  const mine = (rows ?? []).filter((r) => r.school_id === s.id);
  const rowFor = (p: Staff) => mine.find((r) => r.teacher_name === p.name);
  const talked = reps.filter((p) => rowFor(p)?.status === "completed").length;
  const head = staff.find((p) => p.role === "head");
  const contact = staff.find((p) => p.role === "contact");
  const linkFor = (p: Staff) => {
    const r = rowFor(p);
    return links[p.id] ?? (r ? `${location.origin}/talk/${r.token}` : null);
  };
  const invite = async (p: Staff) => {
    setBusy(p.id);
    try {
      const r = await postJSON<{ link: string }>("/api/interviews", { teacherName: p.name, schoolName: s.name, schoolId: s.id, group, language: "hi" });
      setLinks((x) => ({ ...x, [p.id]: `${location.origin}${r.link}` }));
      reload();
    } finally {
      setBusy(null);
    }
  };
  const prepareAll = async () => {
    setBusy("all");
    for (const p of reps.filter((x) => !rowFor(x))) await invite(p);
    setBusy(null);
  };
  const message = () => {
    const lines = reps.map((p) => `${p.name}: ${linkFor(p) ?? ""}`);
    return lang === "hi"
      ? `नमस्ते ${contact?.name ?? ""} जी, ब्लॉक शिक्षा कार्यालय की ओर से। कृपया ये लिंक इन शिक्षकों तक पहुँचा दें। 12 मिनट की बातचीत है, ताकि दूसरे स्कूल सीख सकें।\n\n${lines.join("\n")}`
      : `Namaste ${contact?.name ?? ""} ji, from the Block Education Office. Please pass these links to these teachers. It is a 12-minute conversation so other schools can learn.\n\n${lines.join("\n")}`;
  };
  const allReady = reps.length > 0 && reps.every((p) => linkFor(p));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card title={t("Who answers for this school", "इस स्कूल का ज़िम्मा किसका")} icon={UserRound}>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="card-inset p-3">
              <dt className={cx("text-xs text-[var(--color-ink-3)]", hi)}>{t("Head teacher", "प्रधानाध्यापक")}</dt>
              <dd className="mt-0.5 font-semibold">{head?.name ?? "—"}</dd>
              <dd className={cx("mt-1 text-xs text-[var(--color-ink-2)]", hi)}>{t("Runs the school and approves its weekly report", "स्कूल चलाते हैं और साप्ताहिक रिपोर्ट देखते हैं")}</dd>
            </div>
            <div className="card-inset p-3">
              <dt className={cx("text-xs text-[var(--color-ink-3)]", hi)}>{t("Point of contact", "संपर्क व्यक्ति")}</dt>
              <dd className="mt-0.5 font-semibold">{contact?.name ?? head?.name ?? "—"}</dd>
              <dd className={cx("mt-1 text-xs text-[var(--color-ink-2)]", hi)}>{t("Passes on links, gathers answers, reports once a week", "लिंक पहुँचाते हैं, जवाब जुटाते हैं, हफ़्ते में एक बार रिपोर्ट देते हैं")}</dd>
            </div>
          </dl>
          <p className={cx("mt-3 text-xs text-[var(--color-ink-3)]", hi)}>{t("Names are simulated for this demo. Phone numbers are never shown or stored here.", "इस डेमो में नाम सिम्युलेटेड हैं। फ़ोन नंबर यहाँ कभी दिखाए या रखे नहीं जाते।")}</p>
        </Card>

        <Card title={t("Who to talk to", "किससे बात करें")} icon={Users}>
          <p className={cx("text-[15px]", hi)}>
            {t(
              `You don't need every teacher. ${reps.length === 1 ? `${reps[0]?.name} covers` : `These ${reps.length} teachers together cover`} all ${s.grades.length} classes.`,
              `हर शिक्षक से बात ज़रूरी नहीं। ${reps.length === 1 ? `${reps[0]?.name} सभी` : `ये ${reps.length} शिक्षक मिलकर सभी`} ${s.grades.length} कक्षाएँ देखते हैं।`,
            )}
          </p>
          <div className={cx("mt-3 flex items-center justify-between text-sm text-[var(--color-ink-2)]", hi)}>
            <span>{t("Conversations done", "बातचीत पूरी")}</span>
            <b className="tabular-nums text-[var(--color-ink)]">{talked} / {reps.length}</b>
          </div>
          <Meter className="mt-1" value={reps.length ? talked / reps.length : 0} height={7} color="var(--tone-good)" />
          <div className="mt-4 flex flex-wrap gap-2">
            {!allReady ? (
              <button className="btn btn-primary" onClick={prepareAll} disabled={!!busy}>
                {busy === "all" ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} {t("Prepare links for the contact", "संपर्क के लिए लिंक बनाएँ")}
              </button>
            ) : (
              <>
                <a className="btn btn-primary" href={`https://wa.me/?text=${encodeURIComponent(message())}`} target="_blank" rel="noreferrer">
                  <Send size={15} /> {t("Send to the contact on WhatsApp", "संपर्क को WhatsApp पर भेजें")}
                </a>
                <button
                  className="btn btn-glass"
                  onClick={async () => {
                    await navigator.clipboard.writeText(message());
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1800);
                  }}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? t("Copied", "कॉपी हुआ") : t("Copy message", "संदेश कॉपी करें")}
                </button>
              </>
            )}
          </div>
          <p className={cx("mt-2 text-xs text-[var(--color-ink-3)]", hi)}>{t("The contact forwards each link, or answers on a teacher's behalf if that is easier.", "संपर्क व्यक्ति हर लिंक आगे भेजते हैं, या आसान हो तो शिक्षक की ओर से जवाब देते हैं।")}</p>
        </Card>
      </div>

      <Card title={t("Teachers and what each answers for", "शिक्षक और उनकी ज़िम्मेदारी")} pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-[var(--color-ink-3)]">
              <tr>
                <th className="px-4 pb-2 pt-1 font-medium md:px-5">{t("Teacher", "शिक्षक")}</th>
                <th className="pb-2 pr-3 pt-1 font-medium">{t("Classes", "कक्षाएँ")}</th>
                <th className="pb-2 pr-3 pt-1 font-medium">{t("Answers for", "ज़िम्मेदारी")}</th>
                <th className="pb-2 pr-4 pt-1 font-medium">{t("Conversation", "बातचीत")}</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((p) => {
                const r = rowFor(p);
                return (
                  <tr key={p.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-2.5 md:px-5">
                      <div className="font-medium">{p.name}</div>
                      <div className={cx("text-xs text-[var(--color-ink-3)]", hi)}>
                        {p.role === "head" ? t("Head teacher", "प्रधानाध्यापक") : p.role === "contact" ? t("Point of contact", "संपर्क व्यक्ति") : t("Teacher", "शिक्षक")}
                        {repIds.has(p.id) && <> · {t("speaks for these classes", "इन कक्षाओं की ओर से")}</>}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{p.grades.length ? p.grades.join(", ") : "—"}</td>
                    <td className={cx("py-2.5 pr-3 text-[var(--color-ink-2)]", hi)}>{p.leads.length ? p.leads.map((x) => t(...SUBJECT_INFO[x].short)).join(", ") : "—"}</td>
                    <td className="py-2.5 pr-4">
                      {r ? (
                        <span className={cx("chip !text-xs", hi)} style={{ color: STATUS[r.status][2] }}>
                          {t(STATUS[r.status][0], STATUS[r.status][1])}
                        </span>
                      ) : p.grades.length ? (
                        <button className="btn btn-glass !px-3 !py-1 text-xs" onClick={() => invite(p)} disabled={!!busy}>
                          {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} {t("Create link", "लिंक बनाएँ")}
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--color-ink-3)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <WeeklyReport school={s} />
    </div>
  );
}

function Stepper({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max: number }) {
  const { lang } = usePrefs();
  return (
    <label className={cx("card-inset flex items-center justify-between gap-3 p-3 text-sm", lang === "hi" && "font-deva")}>
      <span>{label}</span>
      <span className="flex items-center gap-1.5">
        <button type="button" className="btn btn-glass btn-icon !p-1.5" onClick={() => onChange(Math.max(0, value - 1))} aria-label="-">
          <Minus size={14} />
        </button>
        <input type="number" inputMode="numeric" min={0} max={max} value={value} onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value) || 0)))} className="w-14 rounded-lg bg-transparent text-center font-semibold tabular-nums outline-none" />
        <button type="button" className="btn btn-glass btn-icon !p-1.5" onClick={() => onChange(Math.min(max, value + 1))} aria-label="+">
          <Plus size={14} />
        </button>
      </span>
    </label>
  );
}

/** One short report a week: enough to track a school without asking every teacher. */
export function WeeklyReport({ school: s }: { school: School }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const { state, record, events } = usePipeline();
  const rec = state.recs.find((r) => r.schoolId === s.id);
  const reports = useMemo(() => weeklyReports(events).all.filter((r) => r.schoolId === s.id).reverse(), [events, s.id]);
  const lastReport = reports[0];
  const [teachers, setTeachers] = useState(0);
  const [children, setChildren] = useState(0);
  const [classes, setClasses] = useState<number[]>([]);
  const [going, setGoing] = useState<"well" | "mixed" | "hard" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (lastReport) (setTeachers(lastReport.teachersUsing), setChildren(lastReport.childrenReached), setClasses(lastReport.classes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.id]);
  const save = async () => {
    if (!going) return;
    setBusy(true);
    await record("weekly", s.id, { ...(rec ? { method: rec.practice } : {}), teachersUsing: teachers, childrenReached: children, classes, going, ...(note.trim() ? { note: note.trim() } : {}) }).catch(() => null);
    setBusy(false);
    setSaved(true);
    setNote("");
    setGoing(null);
    window.setTimeout(() => setSaved(false), 2500);
  };
  const GOING = [
    ["well", t("Going well", "अच्छा चल रहा"), "var(--tone-good)"],
    ["mixed", t("Mixed", "मिला-जुला"), "var(--tone-warn)"],
    ["hard", t("Finding it hard", "मुश्किल हो रहा"), "var(--tone-bad)"],
  ] as const;
  return (
    <Card title={t("This week's report", "इस हफ़्ते की रिपोर्ट")} icon={ClipboardList} right={lastReport ? <span className={cx("text-xs text-[var(--color-ink-3)]", hi)}>{t("Last sent", "पिछली")} {new Date(lastReport.at).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" })}</span> : undefined}>
      <p className={cx("mb-3 text-sm text-[var(--color-ink-2)]", hi)}>
        {rec
          ? t(`Two minutes, once a week, about “${PRACTICES[rec.practice].label}”. The contact sends it; the head can see it.`, `हफ़्ते में एक बार दो मिनट, “${PRACTICES[rec.practice].labelHi}” के बारे में। संपर्क व्यक्ति भेजते हैं; प्रधानाध्यापक देख सकते हैं।`)
          : t("Two minutes, once a week, on what is happening in class. The contact sends it; the head can see it.", "हफ़्ते में एक बार दो मिनट, कक्षा में क्या चल रहा है। संपर्क व्यक्ति भेजते हैं; प्रधानाध्यापक देख सकते हैं।")}
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <Stepper label={t("Teachers using it this week", "इस हफ़्ते करने वाले शिक्षक")} value={teachers} onChange={setTeachers} max={60} />
        <Stepper label={t("Children taking part", "भाग लेने वाले बच्चे")} value={children} onChange={setChildren} max={3000} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={cx("mr-1 text-sm text-[var(--color-ink-2)]", hi)}>{t("Classes", "कक्षाएँ")}</span>
        {s.grades.map((g) => {
          const on = classes.includes(g.grade);
          return (
            <button key={g.grade} type="button" aria-pressed={on} className={cx("grid h-9 w-9 place-items-center rounded-full border text-sm font-semibold tabular-nums transition", on ? "border-transparent bg-[var(--st-bright)] text-[#0b1308]" : "border-[var(--chip-line)]")} onClick={() => setClasses((c) => (on ? c.filter((x) => x !== g.grade) : [...c, g.grade].sort()))}>
              {g.grade}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={cx("mr-1 text-sm text-[var(--color-ink-2)]", hi)}>{t("How is it going?", "कैसा चल रहा है?")}</span>
        {GOING.map(([k, label, color]) => (
          <button key={k} type="button" aria-pressed={going === k} className={cx("chip !py-1.5", hi)} style={going === k ? { borderColor: color, color, background: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined} onClick={() => setGoing(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <VoiceText rows={2} value={note} onChange={setNote} placeholder={t("Anything to add? Type or speak.", "कुछ और? लिखें या बोलें।")} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button className="btn btn-primary" onClick={save} disabled={!going || busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {t("Send the report", "रिपोर्ट भेजें")}
        </button>
        {saved && <span className={cx("text-sm", hi)} style={{ color: "var(--tone-good)" }}><Check size={14} className="mr-1 inline" />{t("Sent. It now counts in the rollout.", "भेजी गई। अब यह रोलआउट में गिनी जाएगी।")}</span>}
      </div>
      {reports.length > 0 && (
        <details className="mt-4 border-t border-[var(--line)] pt-3">
          <summary className={cx("tap-link cursor-pointer text-sm font-medium text-[var(--color-ink-2)]", hi)}>{t(`Earlier reports (${reports.length})`, `पिछली रिपोर्टें (${reports.length})`)}</summary>
          <ul className="mt-2 space-y-1.5">
            {reports.slice(0, 8).map((r) => (
              <li key={r.at} className={cx("card-inset px-3 py-2 text-sm", hi)}>
                {new Date(r.at).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" })} · {t(`${r.teachersUsing} teachers, ${r.childrenReached} children`, `${r.teachersUsing} शिक्षक, ${r.childrenReached} बच्चे`)}
                {r.note && <div className="font-deva text-xs italic text-[var(--color-ink-2)]">“{r.note}”</div>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
