// What people recorded in the block (actions moved, spot checks, follow-up calls, notes) —
// the same shared log everyone sees.
import { Link } from "react-router-dom";
import { useAgo } from "./kit";
import { cx } from "./ui";
import { useT } from "../lib/prefs";
import { usePipeline, type BlockEvent } from "../lib/store";

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
  const STATUS: Record<string, [string, string]> = { todo: ["to do", "करना है"], scheduled: ["scheduled", "तय"], done: ["done", "पूरा"], stuck: ["stuck", "अटका"] };
  const OUTCOME: Record<string, [string, string]> = {
    adopted: ["adopted it", "अपना लिया"],
    trying: ["is trying it", "आज़मा रहे हैं"],
    barrier: ["hit a barrier", "रुकावट आई"],
    no_answer: ["did not answer", "जवाब नहीं मिला"],
  };
  return (
    <ul className="space-y-2.5">
      {items.map((e) => {
        const p = e.payload as Record<string, string | number>;
        const actor = e.actor ?? t("Someone", "किसी ने");
        let text = "";
        let sid = e.ref;
        if (e.kind === "action") {
          const a = allActions.find((x) => x.id === e.ref);
          sid = a?.schoolId ?? e.ref.split("-")[0];
          text = t(`${actor} marked “${a?.task ?? e.ref}” ${STATUS[String(p.status)]?.[0] ?? p.status}`, `${actor} ने “${a?.task ?? e.ref}” को ${STATUS[String(p.status)]?.[1] ?? p.status} किया`);
          if (p.note) text += ` — “${p.note}”`;
        } else if (e.kind === "spotcheck")
          text = t(
            `${actor} recorded a spot check: ${p.proficient}/${p.sampled} read, ${p.numeracyProficient}/${p.sampled} did subtraction`,
            `${actor} ने जाँच दर्ज की: ${p.proficient}/${p.sampled} ने पढ़ा, ${p.numeracyProficient}/${p.sampled} ने घटाव किया`,
          );
        else if (e.kind === "followup")
          text = t(
            `${actor} recorded a follow-up call — the teacher ${OUTCOME[String(p.outcome)]?.[0] ?? p.outcome}`,
            `${actor} ने फ़ॉलो-अप कॉल दर्ज की — शिक्षक ने ${OUTCOME[String(p.outcome)]?.[1] ?? p.outcome}`,
          );
        else text = t(`${actor} noted: “${p.text}”`, `${actor} ने लिखा: “${p.text}”`);
        const s = name(sid);
        return (
          <li key={e.id} className={cx("flex gap-3 text-sm", e.pending && "opacity-60")}>
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--st-bright-fill)]" />
            <span className="min-w-0">
              <span className="block">{text}</span>
              <span className="block text-xs text-[var(--color-ink-3)]">
                {s && !schoolId && (
                  <Link to={`/schools/${s.id}`} className="underline decoration-[rgb(var(--fg)/0.25)] hover:text-[var(--color-ink)]">
                    {s.name}
                  </Link>
                )}
                {s && !schoolId && " · "}
                {e.pending ? t("saving…", "सहेज रहे…") : ago(e.created_at)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
