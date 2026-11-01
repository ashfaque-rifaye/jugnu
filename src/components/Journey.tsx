// "Your first 10 minutes": five steps for this role that tick themselves off as the person
// actually does them (the guide, a spot check, an invite, an approval, a follow-up…).
import { motion } from "framer-motion";
import { ArrowRight, Check, Compass, PartyPopper, Play, type LucideIcon } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useJourney } from "../lib/journey";
import { usePrefs, useT } from "../lib/prefs";
import { roleName, useRole } from "../lib/role";
import { schoolStatuses } from "../lib/status";
import { usePipeline } from "../lib/store";
import { pickStory } from "../lib/story";
import { Card, Rings, SPRING } from "./kit";
import { CountUp } from "../lib/motion";
import { cx } from "./ui";

interface Step {
  key: string;
  label: [string, string];
  sub: [string, string];
  done: boolean;
  to?: string;
  run?: "tour" | "demo";
}

function useJourneySteps(): Step[] {
  const [role] = useRole();
  const { state, events, followUps } = usePipeline();
  const seen = useJourney();
  return useMemo(() => {
    const me = roleName(role, state.block);
    const mine = (kind: string, test: (p: Record<string, unknown>, ref: string) => boolean = () => true) =>
      events.some((e) => !e.demo && e.kind === kind && e.actor === me && test(e.payload, e.ref));
    const status = schoolStatuses(state);
    const inPatch = (id: string) => role?.kind !== "crp" || state.block.schools.find((s) => s.id === id)?.cluster === role.cluster;
    const first = (st: string) => [...status].filter(([, v]) => v === st).map(([id]) => id).sort((a, b) => Number(inPatch(b)) - Number(inPatch(a)))[0];
    const story = pickStory(state, followUps);
    const tour: Step = { key: "tour", label: ["Take the 1-minute guide", "1 मिनट का गाइड देखें"], sub: ["Jugnu shows you around the real screens", "जुगनू असली स्क्रीन पर घुमाता है"], done: seen.has("tour"), run: "tour" };

    if (role?.kind === "crp") {
      const heard = new Set(state.interviews.map((i) => i.schoolId));
      const toInvite = [...status].filter(([id, v]) => v === "bright" && !heard.has(id)).map(([id]) => id).sort((a, b) => Number(inPatch(b)) - Number(inPatch(a)))[0] ?? first("bright");
      const wave1 = state.recs.filter((r) => r.wave === 1 && inPatch(r.schoolId));
      return [
        tour,
        { key: "spotcheck", label: ["Record a confirmation visit", "पुष्टि दौरा दर्ज करें"], sub: ["15 children, 15 minutes — the school updates at once", "15 बच्चे, 15 मिनट — स्कूल तुरंत अपडेट"], done: mine("spotcheck"), to: first("check_due") ? `/schools/${first("check_due")}` : "/schools" },
        { key: "invite", label: ["Invite a teacher at a school doing well", "अच्छे स्कूल के शिक्षक को बुलाएँ"], sub: ["Send the 12-minute voice interview link", "12 मिनट की बातचीत का लिंक भेजें"], done: seen.has("invite"), to: toInvite ? `/schools/${toInvite}` : "/schools?status=bright" },
        { key: "visit", label: ["Mark a classroom visit done", "कक्षा-दौरा पूरा करें"], sub: ["Move one action on the sharing plan", "योजना में एक काम आगे बढ़ाएँ"], done: mine("action", (p, ref) => p.status === "done" && ref.endsWith("-visit")), to: "/plan" },
        { key: "followup", label: ["Log a day-14 call", "14वें दिन की कॉल दर्ज करें"], sub: ["“Did you try it? What happened?”", "“क्या आज़माया? क्या हुआ?”"], done: mine("followup"), to: wave1[0] ? `/schools/${wave1[0].schoolId}` : "/results" },
      ];
    }
    if (role?.kind === "head")
      return [
        tour,
        { key: "people", label: ["See who answers for what", "देखें किसके ज़िम्मे क्या है"], sub: ["Your head, contact and teachers", "प्रधानाध्यापक, संपर्क व शिक्षक"], done: seen.has(`seen:/schools/${role.schoolId}`), to: `/schools/${role.schoolId}?tab=people` },
        { key: "weekly", label: ["Send this week's report", "इस हफ़्ते की रिपोर्ट भेजें"], sub: ["Two minutes, once a week", "हफ़्ते में एक बार, दो मिनट"], done: mine("weekly"), to: `/schools/${role.schoolId}?tab=people` },
        { key: "task", label: ["Mark a task as done", "कोई काम पूरा करें"], sub: ["A coordinator then signs it off", "फिर समन्वयक पुष्टि करते हैं"], done: mine("action", (p) => p.status === "submitted"), to: "/plan" },
        { key: "methods", label: ["Read a method to try", "आज़माने का तरीका पढ़ें"], sub: ["Written for teachers", "शिक्षकों के लिए लिखा"], done: seen.has("seen:/practices"), to: "/practices" },
      ];
    if (role?.kind === "beo")
      return [
        tour,
        { key: "review", label: ["Approve an AI draft", "AI ड्राफ़्ट मंज़ूर करें"], sub: ["Nothing reaches a teacher without you", "आपकी मंज़ूरी के बिना कुछ नहीं जाता"], done: seen.has("review"), to: "/review" },
        { key: "plan", label: ["See who owns what", "किसके ज़िम्मे क्या है, देखें"], sub: ["Every action has an owner and a date", "हर काम का मालिक और तारीख"], done: seen.has("seen:/plan"), to: "/plan" },
        { key: "ask", label: ["Ask Jugnu a question", "जुगनू से एक सवाल पूछें"], sub: ["“Which schools need a visit this week?”", "“इस हफ़्ते किन स्कूलों में जाना है?”"], done: seen.has("ask"), to: "/today?ask=1" },
        { key: "results", label: ["See if it worked", "देखें, असर हुआ या नहीं"], sub: ["Day-14 calls and group 1 vs group 2", "14वें दिन की कॉल, समूह 1 बनाम 2"], done: seen.has("seen:/results"), to: "/results" },
      ];
    return [
      tour,
      { key: "bright", label: ["Open a school doing well", "अच्छा कर रहा स्कूल खोलें"], sub: [story ? `${story.bright.teacher}, ${story.bright.name}` : "A school beating its context", story ? `${story.bright.teacher}, ${story.bright.name}` : "हालात से आगे स्कूल"], done: seen.has("seen:bright"), to: story ? `/schools/${story.bright.id}` : "/schools?status=bright" },
      { key: "practices", label: ["See what works here", "देखें यहाँ जो तरीके काम करते हैं"], sub: ["Methods only schools doing well use", "सिर्फ़ अच्छे स्कूलों के तरीके"], done: seen.has("seen:/practices"), to: "/practices" },
      { key: "demo", label: ["See a sample term", "नमूना सत्र देखें"], sub: ["How a whole term runs, in 40 seconds, on sample data", "पूरा सत्र कैसे चलता है, 40 सेकंड में, नमूना डेटा पर"], done: seen.has("demo"), run: "demo" },
      { key: "results", label: ["See if it worked", "देखें, असर हुआ या नहीं"], sub: ["Group 1 against group 2", "समूह 1 बनाम समूह 2"], done: seen.has("seen:/results"), to: "/results" },
    ];
  }, [role, state, events, followUps, seen]);
}

export function JourneyCard({ onTour, onDemo }: { onTour: () => void; onDemo: () => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const steps = useJourneySteps();
  const n = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const hi = lang === "hi" && "font-deva";
  if (n === steps.length) return null; // finished: Today gets shorter
  return (
    <Card tour="journey" accent>
      <div className="flex items-center gap-4">
        <Rings rings={[{ value: n / steps.length, color: "var(--ring-1)" }]} size={64} stroke={8}>
          <span className="font-display text-[15px] font-bold tabular-nums">
            <CountUp value={n} />/{steps.length}
          </span>
        </Rings>
        <div className="min-w-0">
          <h2 className={cx("text-[17px] font-semibold tracking-[-0.01em]", hi)}>{t("Your first 10 minutes", "आपके पहले 10 मिनट")}</h2>
          <p className={cx("text-[13px] text-[var(--color-ink-3)]", hi)}>{t("Each step ticks itself off when you do it.", "हर कदम करते ही अपने-आप पूरा हो जाता है।")}</p>
        </div>
      </div>
      <ol className="mt-4 space-y-1.5">
        {steps.map((s, i) => {
          const isNext = s === next;
          const body = (
            <>
              <motion.span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[12px] font-bold"
                initial={false}
                animate={s.done ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={SPRING}
                style={
                  s.done
                    ? { background: "var(--grad-flat)", borderColor: "transparent", color: "#0b1308" }
                    : isNext
                      ? { borderColor: "var(--st-bright)", color: "var(--st-bright)" }
                      : { borderColor: "var(--chip-line)", color: "var(--color-ink-3)" }
                }
              >
                {s.done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </motion.span>
              <span className={cx("min-w-0 flex-1", hi)}>
                <span className={cx("block text-[14px] font-medium leading-snug", s.done && "text-[var(--color-ink-3)] line-through decoration-[rgb(var(--fg)/0.3)]")}>{t(...s.label)}</span>
                {isNext && <span className="block text-xs text-[var(--color-ink-3)]">{t(...s.sub)}</span>}
              </span>
              {isNext && (
                <span className="btn btn-primary shrink-0 !px-3 !py-1.5 text-xs">
                  {s.run === "demo" ? <Play size={12} /> : s.run === "tour" ? <Compass size={12} /> : null}
                  {s.run === "demo" ? t("Play", "चलाएँ") : s.run === "tour" ? t("Start", "शुरू") : t("Go", "चलें")} <ArrowRight size={12} />
                </span>
              )}
            </>
          );
          const cls = cx("flex items-center gap-3 rounded-2xl px-2.5 py-2 transition", isNext ? "card-inset" : "hover:bg-[var(--hover)]");
          return (
            <li key={s.key}>
              {s.run ? (
                <button className={cx(cls, "w-full text-left")} onClick={s.run === "tour" ? onTour : onDemo}>
                  {body}
                </button>
              ) : (
                <Link to={s.to ?? "/today"} className={cls}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      {!next && <Celebrate />}
    </Card>
  );
}

function Celebrate({ icon: Icon = PartyPopper }: { icon?: LucideIcon }) {
  const t = useT();
  return (
    <div className="mt-3 flex items-center gap-2 rounded-2xl px-3 py-2 text-sm" style={{ background: "color-mix(in srgb, var(--tone-lime) 12%, transparent)", color: "var(--tone-lime)" } as CSSProperties}>
      <Icon size={16} /> {t("All done. Replay the guide any time from the Guide button.", "सब पूरा। गाइड कभी भी ‘गाइड’ बटन से दोबारा देखें।")}
    </div>
  );
}
