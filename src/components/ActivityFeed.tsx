// What people recorded in the block (actions moved, spot checks, follow-up calls, notes) —
// the same shared log everyone sees, as a timeline.
import { AnimatePresence, motion } from "framer-motion";
import { Footprints, MessageSquareText, PhoneCall, Stethoscope, Volume2, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { Action } from "../engine/types";
import { useT } from "../lib/prefs";
import { usePipeline, type BlockEvent } from "../lib/store";
import { useAgo } from "./kit";

type T = (en: string, hi: string) => string;
const STATUS: Record<string, [string, string]> = { todo: ["to do", "करना है"], scheduled: ["scheduled", "तय"], done: ["done", "पूरा"], stuck: ["stuck", "अटका"] };
const OUTCOME: Record<string, [string, string]> = {
  adopted: ["adopted it", "अपना लिया"],
  trying: ["is trying it", "आज़मा रहे हैं"],
  barrier: ["hit a barrier", "रुकावट आई"],
  no_answer: ["did not answer", "जवाब नहीं मिला"],
};

/** One event in plain words, with the school it is about and an icon + tone for it. */
export function describeEvent(e: BlockEvent, t: T, allActions: Action[]): { text: string; schoolId: string; icon: LucideIcon; tone: string } {
  const p = e.payload as Record<string, string | number>;
  const actor = e.actor ?? t("Someone", "किसी ने");
  if (e.kind === "action") {
    const a = allActions.find((x) => x.id === e.ref);
    const visit = e.ref.endsWith("-visit");
    const note = e.ref.endsWith("-note");
    let text = t(`${actor} marked “${a?.task ?? e.ref}” ${STATUS[String(p.status)]?.[0] ?? p.status}`, `${actor} ने “${a?.task ?? e.ref}” को ${STATUS[String(p.status)]?.[1] ?? p.status} किया`);
    if (p.note) text += ` — “${p.note}”`;
    return {
      text,
      schoolId: a?.schoolId ?? e.ref.split("-")[0],
      icon: visit ? Footprints : note ? Volume2 : MessageSquareText,
      tone: p.status === "stuck" ? "var(--tone-bad)" : visit ? "var(--tone-visit)" : note ? "var(--tone-lime)" : "var(--tone-info)",
    };
  }
  if (e.kind === "spotcheck")
    return {
      text: t(
        `${actor} recorded a spot check: ${p.proficient}/${p.sampled} read, ${p.numeracyProficient}/${p.sampled} did subtraction`,
        `${actor} ने जाँच दर्ज की: ${p.proficient}/${p.sampled} ने पढ़ा, ${p.numeracyProficient}/${p.sampled} ने घटाव किया`,
      ),
      schoolId: e.ref,
      icon: Stethoscope,
      tone: "var(--st-check-due)",
    };
  if (e.kind === "followup")
    return {
      text: t(`${actor} recorded a follow-up call — the teacher ${OUTCOME[String(p.outcome)]?.[0] ?? p.outcome}`, `${actor} ने फ़ॉलो-अप कॉल दर्ज की — शिक्षक ने ${OUTCOME[String(p.outcome)]?.[1] ?? p.outcome}`),
      schoolId: e.ref,
      icon: PhoneCall,
      tone: p.outcome === "barrier" ? "var(--tone-bad)" : p.outcome === "no_answer" ? "var(--tone-muted)" : "var(--tone-good)",
    };
  return { text: t(`${actor} noted: “${p.text}”`, `${actor} ने लिखा: “${p.text}”`), schoolId: e.ref, icon: MessageSquareText, tone: "var(--tone-teal)" };
}

export function ActivityFeed({ events, schoolId, limit = 8 }: { events: BlockEvent[]; schoolId?: string; limit?: number }) {
  const t = useT();
  const ago = useAgo();
  const { state, allActions } = usePipeline();
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
    <ul className="relative space-y-3">
      <span className="absolute bottom-3 left-[15px] top-3 w-px bg-[var(--line)]" aria-hidden />
      <AnimatePresence initial={false}>
        {items.map((e) => {
          const d = describeEvent(e, t, allActions);
          const s = name(d.schoolId);
          const Icon = d.icon;
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
              <span className="icon-tile relative z-10 h-[31px] w-[31px] rounded-full" style={{ "--tile": d.tone, background: `color-mix(in srgb, ${d.tone} 18%, var(--chrome-solid))` } as CSSProperties}>
                <Icon size={14} />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block leading-snug">{d.text}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--color-ink-3)]">
                  {s && !schoolId && (
                    <Link to={`/schools/${s.id}`} className="underline decoration-[rgb(var(--fg)/0.25)] hover:text-[var(--color-ink)]">
                      {s.name}
                    </Link>
                  )}
                  {s && !schoolId && <span>·</span>}
                  <span>{e.pending ? t("saving…", "सहेज रहे…") : ago(e.created_at)}</span>
                  {e.demo && <span className="chip !px-1.5 !py-0 !text-[10px]">{t("playback", "प्लेबैक")}</span>}
                </span>
              </span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
