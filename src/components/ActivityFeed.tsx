// What people recorded in the block (actions moved, spot checks, follow-up calls, notes) —
// the same shared log everyone sees, as a timeline: a headline and what it means for each,
// with the teacher's own words one tap away.
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Footprints, MessageSquareText, PhoneCall, Quote, Stethoscope, Volume2, type LucideIcon } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { Action, School } from "../engine/types";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline, type BlockEvent } from "../lib/store";
import { useAgo } from "./kit";

type T = (en: string, hi: string) => string;
const STATUS: Record<string, [string, string]> = {
  todo: ["to do", "करना है"],
  scheduled: ["scheduled", "तय"],
  done: ["done", "पूरा"],
  stuck: ["stuck", "अटका"],
};
const OUTCOME: Record<string, [string, string]> = {
  adopted: ["adopted it", "अपना लिया"],
  trying: ["is trying it", "आज़मा रहे हैं"],
  barrier: ["hit a barrier", "रुकावट आई"],
  no_answer: ["did not answer", "जवाब नहीं मिला"],
};
const OWNER: Record<string, [string, string]> = {
  BEO: ["Block officer", "बीईओ"],
  CRP: ["Cluster coordinator", "संकुल समन्वयक"],
  Teacher: ["Teacher", "शिक्षक"],
};
const NEXT: Record<string, [string, string]> = {
  adopted: ["Working — ask them to show a neighbouring teacher next.", "असर हो रहा है — अगली बार पड़ोसी शिक्षक को दिखाने को कहें।"],
  trying: ["Started — a short check-in next week keeps it going.", "शुरू हुआ — अगले हफ़्ते छोटी बातचीत से चलता रहेगा।"],
  barrier: ["Something is in the way — it becomes a task for whoever can remove it.", "रुकावट है — यह उसके लिए काम बनता है जो इसे हटा सके।"],
  no_answer: ["No answer — Jugnu tries again tomorrow.", "जवाब नहीं — जुगनू कल फिर कोशिश करेगा।"],
};
const pair = (v: unknown): [string, string] | null => (Array.isArray(v) && typeof v[0] === "string" ? [v[0], String(v[1] ?? v[0])] : null);

export interface EventView {
  /** One full sentence (toasts, tooltips). */
  text: string;
  /** Short headline: what happened. */
  title: string;
  /** What it means / what to do next. */
  insight?: string;
  /** Who acts next, and on what. */
  owner?: string;
  /** The teacher's own words (and an English rendering), for follow-up calls. */
  quote?: string;
  quoteEn?: string;
  chip?: string;
  schoolId: string;
  icon: LucideIcon;
  tone: string;
}

/** One event in plain words: a headline, the insight behind it, and the school it is about. */
export function describeEvent(e: BlockEvent, t: T, allActions: Action[], schools: School[] = []): EventView {
  const p = e.payload as Record<string, unknown>;
  const actor = e.actor ?? t("Someone", "किसी ने");
  if (e.kind === "action") {
    const a = allActions.find((x) => x.id === e.ref);
    const visit = e.ref.endsWith("-visit");
    const note = e.ref.endsWith("-note");
    const st = STATUS[String(p.status)] ?? [String(p.status), String(p.status)];
    const task = a?.task ?? e.ref;
    const insight =
      p.status === "stuck"
        ? t("Stuck — someone has to unblock it.", "अटका है — किसी को रास्ता खोलना होगा।")
        : p.status === "done" && visit
          ? t("Visit done — the follow-up call is due in about two weeks.", "भ्रमण पूरा — लगभग दो हफ़्ते में फ़ॉलो-अप कॉल।")
          : undefined;
    return {
      text: t(`${actor} marked “${task}” ${st[0]}`, `${actor} ने “${task}” को ${st[1]} किया`) + (p.note ? ` — “${p.note}”` : ""),
      title: `${task}: ${t(st[0], st[1])}`,
      insight: [insight, p.note ? `“${p.note}”` : undefined].filter(Boolean).join(" ") || undefined,
      chip: actor,
      schoolId: a?.schoolId ?? e.ref.split("-")[0],
      icon: visit ? Footprints : note ? Volume2 : MessageSquareText,
      tone: p.status === "stuck" ? "var(--tone-bad)" : visit ? "var(--tone-visit)" : note ? "var(--tone-lime)" : "var(--tone-info)",
    };
  }
  if (e.kind === "spotcheck") {
    const n = Number(p.sampled) || 1;
    const read = Math.round((Number(p.proficient) / n) * 100);
    const maths = Math.round((Number(p.numeracyProficient) / n) * 100);
    const s = schools.find((x) => x.id === e.ref);
    const reported = s ? Math.round(s.reading[s.reading.length - 1]) : null;
    const gap = reported == null ? 0 : reported - read;
    return {
      text: t(
        `${actor} recorded a spot check: ${p.proficient}/${p.sampled} read, ${p.numeracyProficient}/${p.sampled} did subtraction`,
        `${actor} ने जाँच दर्ज की: ${p.proficient}/${p.sampled} ने पढ़ा, ${p.numeracyProficient}/${p.sampled} ने घटाव किया`,
      ),
      title: t(`Spot check: ${read}% read a story, ${maths}% subtract`, `जाँच: ${read}% ने कहानी पढ़ी, ${maths}% ने घटाव किया`),
      insight:
        reported == null
          ? undefined
          : gap > 20
            ? t(`${gap} points below the ${reported}% reported — hold off calling it a bright spot.`, `बताए गए ${reported}% से ${gap} अंक कम — अभी अच्छा स्कूल न मानें।`)
            : t(`Close to the ${reported}% reported — the school's numbers hold up.`, `बताए गए ${reported}% के क़रीब — स्कूल के आँकड़े सही लगते हैं।`),
      chip: actor,
      schoolId: e.ref,
      icon: Stethoscope,
      tone: gap > 20 ? "var(--tone-bad)" : "var(--st-check-due)",
    };
  }
  if (e.kind === "followup") {
    const o = String(p.outcome);
    const summary = pair(p.summary);
    const insight = pair(p.insight) ?? NEXT[o];
    const owner = typeof p.barrierOwner === "string" ? OWNER[p.barrierOwner] : undefined;
    const said = OUTCOME[o] ?? [o, o];
    return {
      text: t(`${actor} recorded a follow-up call — the teacher ${said[0]}`, `${actor} ने फ़ॉलो-अप कॉल दर्ज की — शिक्षक ने ${said[1]}`),
      title: summary ? t(summary[0], summary[1]) : t(`Follow-up call: the teacher ${said[0]}`, `फ़ॉलो-अप कॉल: शिक्षक ने ${said[1]}`),
      insight: insight ? t(insight[0], insight[1]) : undefined,
      owner: owner ? t(owner[0], owner[1]) + (typeof p.barrier === "string" ? ` · ${p.barrier}` : "") : undefined,
      quote: typeof p.said === "string" ? p.said : undefined,
      quoteEn: typeof p.saidEn === "string" ? p.saidEn : undefined,
      chip: t(said[0], said[1]),
      schoolId: e.ref,
      icon: PhoneCall,
      tone: o === "barrier" ? "var(--tone-bad)" : o === "no_answer" ? "var(--tone-muted)" : "var(--tone-good)",
    };
  }
  return {
    text: t(`${actor} noted: “${p.text}”`, `${actor} ने लिखा: “${p.text}”`),
    title: `“${String(p.text ?? "")}”`,
    chip: actor,
    schoolId: e.ref,
    icon: MessageSquareText,
    tone: "var(--tone-teal)",
  };
}

export function ActivityFeed({ events, schoolId, limit = 8 }: { events: BlockEvent[]; schoolId?: string; limit?: number }) {
  const t = useT();
  const { lang } = usePrefs();
  const ago = useAgo();
  const { state, allActions } = usePipeline();
  const [open, setOpen] = useState<string | number | null>(null);
  const name = (id: string) => state.block.schools.find((s) => s.id === id);
  const items = [...events]
    .filter((e) => !schoolId || e.ref === schoolId || e.ref.startsWith(`${schoolId}-`))
    .reverse()
    .slice(0, limit);
  if (!items.length)
    return (
      <p className="text-sm text-[var(--color-ink-2)]">
        {t(
          "Nothing recorded yet. When someone moves an action, records a spot check or a follow-up call, it shows here for everyone.",
          "अभी कुछ दर्ज नहीं। जब कोई काम आगे बढ़ाता है, जाँच या फ़ॉलो-अप दर्ज करता है, वह यहाँ सबको दिखता है।",
        )}
      </p>
    );
  return (
    <ul className="relative space-y-2">
      <span className="absolute bottom-3 left-[15px] top-3 w-px bg-[var(--line)]" aria-hidden />
      <AnimatePresence initial={false}>
        {items.map((e) => {
          const d = describeEvent(e, t, allActions, state.block.schools);
          const s = name(d.schoolId);
          const Icon = d.icon;
          const expanded = open === e.id;
          const more = Boolean(d.quote || d.owner);
          return (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: e.pending ? 0.6 : 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="relative flex gap-3 text-sm"
            >
              <span
                className="icon-tile relative z-10 h-[31px] w-[31px] shrink-0 rounded-full"
                style={
                  {
                    "--tile": d.tone,
                    background: `color-mix(in srgb, ${d.tone} 18%, var(--chrome-solid))`,
                  } as CSSProperties
                }
              >
                <Icon size={14} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <button
                  type="button"
                  className={`block w-full text-left ${more ? "cursor-pointer" : "cursor-default"}`}
                  aria-expanded={more ? expanded : undefined}
                  onClick={() => more && setOpen(expanded ? null : e.id)}
                  title={d.text}
                >
                  <span className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 font-medium leading-snug">{d.title}</span>
                    {more && <ChevronDown size={14} className={`mt-0.5 shrink-0 text-[var(--color-ink-3)] transition-transform ${expanded ? "rotate-180" : ""}`} />}
                  </span>
                  {d.insight && <span className="mt-0.5 block leading-snug text-[var(--color-ink-2)]">{d.insight}</span>}
                </button>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-2 space-y-1.5 rounded-xl bg-[rgb(var(--fg)/0.05)] p-2.5 text-[13px]">
                        {d.owner && (
                          <div>
                            <span className="text-[var(--color-ink-3)]">{t("Next move", "अगला क़दम")}: </span>
                            <span className="font-medium">{d.owner}</span>
                          </div>
                        )}
                        {d.quote && (
                          <div className="text-[var(--color-ink-2)]">
                            <Quote size={12} className="mr-1 inline -translate-y-0.5 opacity-60" />
                            <span lang="hi">{d.quote}</span>
                            {d.quoteEn && lang !== "hi" && <span className="mt-0.5 block text-xs italic text-[var(--color-ink-3)]">{d.quoteEn}</span>}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--color-ink-3)]">
                  {s && !schoolId && (
                    <>
                      <Link to={`/schools/${s.id}`} className="underline decoration-[rgb(var(--fg)/0.25)] hover:text-[var(--color-ink)]">
                        {lang === "hi" && s.nameHi ? s.nameHi : s.name}
                      </Link>
                      <span>·</span>
                    </>
                  )}
                  {d.chip && (
                    <>
                      <span>{d.chip}</span>
                      <span>·</span>
                    </>
                  )}
                  <span>{e.pending ? t("saving…", "सहेज रहे…") : ago(e.created_at)}</span>
                  {e.demo && <span className="chip !px-1.5 !py-0 !text-xs">{t("playback", "प्लेबैक")}</span>}
                </span>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
