// "Why does this school say Needs a visit?" One line under the school's name: a plain reason built from
// its own numbers at once, then Jugnu's two sentences (Claude, or Gemini) once they arrive.
import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { PipelineState } from "../engine/pipeline";
import type { School } from "../engine/types";
import { postJSON } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";
import { STATUS_INFO, tint, type SchoolStatus } from "../lib/status";
import { cx } from "./ui";

const asked = new Map<string, string>();
const last = (xs: number[]) => xs[xs.length - 1];
const pct = (x: number) => `${Math.round(x)}%`;

/** The school's own numbers, in short sentences the model can reason from. */
function factsFor(s: School, st: PipelineState, status: SchoolStatus): string[] {
  const exp = st.find.expected[s.id];
  const z = st.find.z[s.id] ?? [];
  const v = st.verify.find((x) => x.schoolId === s.id);
  const rec = st.recs.find((r) => r.schoolId === s.id);
  const out = [
    `Status: ${STATUS_INFO[status].en}`,
    `Class 3 reading at level, reported over three years: ${s.reading.map(pct).join(", ")}${exp ? `; similar schools would be expected at ${exp.reading.map(pct).join(", ")}` : ""}`,
    `Class 3 maths at level, reported: ${s.numeracy.map(pct).join(", ")}${exp ? `; expected ${exp.numeracy.map(pct).join(", ")}` : ""}`,
    `Above what similar schools reach in ${z.filter((x) => x > 1).length} of ${z.length} years`,
    `${s.enrolment} children, ${s.ptr} children per teacher, ${s.multigrade ? "one teacher handles several classes" : "one class per teacher"}, attendance ${pct(s.attendance * 100)}, ${pct(s.langMismatch * 100)} speak a different language at home`,
  ];
  if (v) {
    for (const c of v.checks) out.push(`Check "${c.name}": ${c.passed ? "passed" : "not passed"} (${c.detail})`);
    if (v.spotCheck.sampled > 0) out.push(`Confirmation visit: ${v.spotCheck.proficient} of ${v.spotCheck.sampled} children read at level, against ${pct(v.spotCheck.reported * 100)} reported`);
    else out.push("No one has visited yet to test children in person");
  }
  if (rec) {
    const from = st.block.schools.find((x) => x.id === rec.demonstratorId);
    out.push(`Results are below what similar schools reach${from ? `; ${from.name}, nearby, has a method that could help` : ""}`);
  }
  return out;
}

/** The plain reason, from the same numbers, for when no AI is reachable. */
function plainReason(s: School, st: PipelineState, status: SchoolStatus, hi: boolean): string {
  const exp = st.find.expected[s.id];
  const r = last(s.reading);
  const e = exp ? last(exp.reading) : null;
  const v = st.verify.find((x) => x.schoolId === s.id);
  const failed = v?.checks.find((c) => !c.passed && !/^Confirmation visit$/.test(c.name));
  switch (status) {
    case "check_due":
      return hi
        ? `यहाँ कक्षा 3 में ${pct(r)} बच्चे पढ़ने के स्तर पर बताए गए हैं${e !== null ? `, जबकि ऐसे स्कूलों में लगभग ${pct(e)} होते हैं` : ""}। इतना अच्छा नतीजा भरोसे से पहले देखना ज़रूरी है: एक दौरे में 15 बच्चों को पढ़वाकर पक्का करें।`
        : `Class 3 reading is reported at ${pct(r)}${e !== null ? `, where similar schools reach about ${pct(e)}` : ""}. A result this strong needs to be seen before we trust it: one visit, 15 children reading, confirms it.`;
    case "check_data":
      return hi
        ? `दौरे में बच्चों का पढ़ना दर्ज नतीजों से काफ़ी कम निकला। अगली बार सम्मान से साथ बैठकर देखें कि जाँच कैसे हुई थी।`
        : `On the visit, children read well below the reported results. Next time, sit with the teacher respectfully and look at how the test was run.`;
    case "revisit":
      return hi ? `नतीजे सालों के बीच बहुत बदले हैं${failed ? ` (${failed.detail})` : ""}। अगले दौरे में शिक्षक से पूछें कि क्या बदला।` : `Results moved a lot between years${failed ? ` (${failed.detail})` : ""}. On the next visit, ask the teacher what changed.`;
    case "bright":
      return hi ? `एक दौरे ने पक्का किया कि यहाँ के बच्चे सच में अच्छा पढ़ते हैं। अब शिक्षक से पूछें कि वे क्या अलग करते हैं।` : `A visit confirmed that children here really do read well. Now ask the teacher what they do differently.`;
    case "support":
      return hi ? `यहाँ नतीजे${e !== null ? ` (${pct(r)}, जबकि उम्मीद ${pct(e)})` : ""} वैसे स्कूलों से कम हैं। पास के किसी शिक्षक का आज़माया हुआ तरीका मदद कर सकता है।` : `Results here${e !== null ? ` (${pct(r)} against an expected ${pct(e)})` : ""} are below similar schools. A method a nearby teacher already uses could help.`;
    default:
      return hi ? `नतीजे वैसे ही स्कूलों जितने हैं। अभी कुछ ख़ास करने की ज़रूरत नहीं।` : `Results are in line with similar schools. Nothing special is needed right now.`;
  }
}

export function StatusWhy({ school, state, status }: { school: School; state: PipelineState; status: SchoolStatus }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi";
  const facts = useMemo(() => factsFor(school, state, status), [school, state, status]);
  const plain = useMemo(() => plainReason(school, state, status, hi), [school, state, status, hi]);
  const key = `${lang}|${status}|${facts.join("|")}`;
  const [said, setSaid] = useState<{ key: string; text: string } | null>(() => (asked.has(key) ? { key, text: asked.get(key)! } : null));
  useEffect(() => {
    if (asked.has(key)) return setSaid({ key, text: asked.get(key)! });
    let alive = true;
    postJSON<{ text: string; source: string }>("/api/agent/why", { status: STATUS_INFO[status].en, facts, lang, fallback: plain })
      .then((r) => {
        if (!r.text) return;
        if (r.source !== "offline") asked.set(key, r.text);
        if (alive) setSaid({ key, text: r.text });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const text = said?.key === key ? said.text : plain;
  const color = STATUS_INFO[status].color;
  return (
    <div className="card-inset mb-4 flex items-start gap-3 px-4 py-3" style={{ borderColor: tint(color, 35) } as CSSProperties} data-tour="status-why">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: tint(color, 16), color }}>
        <Sparkles size={14} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold" style={{ color }}>
          {t(`Why “${STATUS_INFO[status].en}”`, `“${STATUS_INFO[status].hi}” क्यों`)}
        </div>
        <p className={cx("mt-0.5 text-[14.5px] leading-relaxed text-[var(--color-ink-2)] transition-opacity", hi && "font-deva")} aria-live="polite">
          {text}
        </p>
      </div>
    </div>
  );
}
