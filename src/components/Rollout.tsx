// What happens after a method is approved: how it travels from the block office to children in class,
// the week-by-week plan, the data behind it, and how far it has got in every cluster and school.
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ChevronDown, ClipboardCheck, Footprints, Landmark, Link2, Mic, School as SchoolIcon, Sparkles, TriangleAlert, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PRACTICES, type PracticeId } from "../engine/practices";
import { usePoll } from "../lib/api";
import { METHOD_WORDS } from "../lib/methods";
import { usePrefs, useT } from "../lib/prefs";
import { buildRollouts, type MethodRollout, type RolloutSchool, type Stage } from "../lib/rollout";
import { tint } from "../lib/status";
import { usePipeline } from "../lib/store";
import { Meter, Segmented } from "./kit";
import { cx } from "./ui";

interface ReviewRow {
  id: string;
  kind: string;
  ref: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer: string | null;
  decided_at: string | null;
}

const STAGE: Record<Stage, { en: string; hi: string; color: string }> = {
  waiting: { en: "Not started", hi: "शुरू नहीं", color: "var(--tone-muted)" },
  note: { en: "Voice note sent", hi: "वॉइस नोट भेजा", color: "var(--tone-info)" },
  visit: { en: "Has seen it done", hi: "करते हुए देखा", color: "var(--tone-teal)" },
  trying: { en: "Trying it", hi: "आज़मा रहे", color: "var(--tone-warn)" },
  regular: { en: "Doing it regularly", hi: "नियमित कर रहे", color: "var(--tone-good)" },
  stuck: { en: "Stuck", hi: "अटका", color: "var(--tone-bad)" },
};

export function RolloutPanel({ initial }: { initial?: string | null }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const { state, followUps, events } = usePipeline();
  const [reviews] = usePoll<ReviewRow[]>("/api/reviews?status=all", 15000);
  const rollouts = useMemo(() => buildRollouts(state, followUps, events), [state, followUps, events]);
  const [open, setOpen] = useState<string | null>(initial ?? rollouts[0]?.practice ?? null);
  useEffect(() => {
    if (initial) setOpen(initial);
  }, [initial]);
  const card = (p: PracticeId) => reviews?.find((r) => r.kind === "practice_card" && r.ref === p && r.status === "approved") ?? reviews?.find((r) => r.kind === "practice_card" && r.ref === p);
  const totals = {
    schools: rollouts.reduce((a, r) => a + r.schools.length, 0),
    children: rollouts.reduce((a, r) => a + r.children, 0),
    teachers: rollouts.reduce((a, r) => a + r.teachers, 0),
    using: rollouts.reduce((a, r) => a + r.counts.trying + r.counts.regular, 0),
  };
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            [t("Schools it will reach", "स्कूलों तक पहुँचेगा"), totals.schools],
            [t("Teachers involved", "जुड़े शिक्षक"), totals.teachers],
            [t("Children it will reach", "बच्चों तक पहुँचेगा"), totals.children.toLocaleString("en-IN")],
            [t("Schools already using it", "स्कूल इसे अपना रहे"), totals.using],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className="card p-4">
            <dt className={cx("text-[13px] text-[var(--color-ink-2)]", hi)}>{label}</dt>
            <dd className="mt-1 font-display text-[1.7rem] font-bold leading-none tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {rollouts.map((r) => (
        <MethodCard key={r.practice} r={r} review={card(r.practice)} open={open === r.practice} onToggle={() => setOpen(open === r.practice ? null : r.practice)} />
      ))}
    </div>
  );
}

function MethodCard({ r, review, open, onToggle }: { r: MethodRollout; review?: ReviewRow; open: boolean; onToggle: () => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const p = PRACTICES[r.practice];
  const words = METHOD_WORDS[r.practice];
  const approved = review?.status === "approved";
  const pct = Math.round(r.progress * 100);
  return (
    <section className="card overflow-hidden" id={`method-${r.practice}`}>
      <button className="grid w-full gap-4 p-4 text-left transition hover:bg-[var(--hover)] md:grid-cols-[1fr_260px_auto] md:items-center md:p-5" onClick={onToggle} aria-expanded={open}>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className={cx("text-lg font-semibold", hi)}>{lang === "hi" ? p.labelHi : p.label}</span>
            {approved ? (
              <span className="chip !text-xs" style={{ color: "var(--tone-good)", borderColor: tint("var(--tone-good)", 45) }}>
                <CheckCircle2 size={12} /> {t("Approved", "मंज़ूर")}
              </span>
            ) : (
              <span className="chip !text-xs" style={{ color: "var(--tone-warn)", borderColor: tint("var(--tone-warn)", 45) }}>
                {t("Needs approval", "मंज़ूरी बाकी")}
              </span>
            )}
          </span>
          <span className={cx("mt-1 block text-sm text-[var(--color-ink-2)]", hi)}>{t(...words.plain)}</span>
        </span>
        <span>
          <span className={cx("mb-1.5 flex justify-between text-xs text-[var(--color-ink-2)]", hi)}>
            <span>{t(`${r.now.length} schools now, ${r.next.length} next term`, `${r.now.length} स्कूल अभी, ${r.next.length} अगले सत्र`)}</span>
            <span className="font-semibold tabular-nums text-[var(--color-ink)]">{pct}%</span>
          </span>
          <Meter value={r.progress} height={8} color="var(--tone-good)" />
        </span>
        <ChevronDown size={18} className={cx("hidden shrink-0 transition md:block", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 border-t border-[var(--line)] p-4 md:p-5">
          {!approved && (
            <Link to="/review" className={cx("card-inset flex items-center justify-between gap-3 p-3 text-sm", hi)}>
              <span>{t("This method starts reaching schools once its card is approved.", "कार्ड मंज़ूर होते ही यह तरीका स्कूलों तक पहुँचना शुरू होगा।")}</span>
              <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[var(--st-bright)]">
                {t("Approvals", "मंज़ूरी")} <ArrowRight size={14} />
              </span>
            </Link>
          )}
          <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
            <Cascade r={r} />
            <div className="space-y-5">
              <Evidence r={r} />
              <Funnel r={r} />
            </div>
          </div>
          <Plan r={r} approved={approved} approvedAt={review?.decided_at} />
          <ByCluster r={r} />
          <SchoolTracker r={r} />
          <Impact r={r} />
        </motion.div>
      )}
    </section>
  );
}

/** Block office → coordinators → school heads → class teachers → children. */
function Cascade({ r }: { r: MethodRollout }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const words = METHOD_WORDS[r.practice];
  const classes = words.classes.length === 5 ? t("classes 1 to 5", "कक्षा 1 से 5") : t(`classes ${words.classes.join(", ")}`, `कक्षा ${words.classes.join(", ")}`);
  const levels = [
    {
      icon: Landmark,
      who: t("Block office", "ब्लॉक कार्यालय"),
      count: t("1 approval", "1 मंज़ूरी"),
      gets: t("The method card, written from teachers' own words and checked by a person.", "तरीके का कार्ड, शिक्षकों के अपने शब्दों से बना और इंसान से जाँचा हुआ।"),
      does: t(`Approves it and briefs ${r.crps} cluster coordinators.`, `मंज़ूर करके ${r.crps} क्लस्टर समन्वयकों को बताते हैं।`),
    },
    {
      icon: Footprints,
      who: t("Cluster coordinators", "क्लस्टर समन्वयक"),
      count: t(`${r.crps} people`, `${r.crps} लोग`),
      gets: t("A list of schools, each matched with a nearby teacher who already does it.", "स्कूलों की सूची, हर एक के साथ पास का शिक्षक जो यह पहले से करता है।"),
      does: t("Sends the voice note and takes each school to watch it in a real class.", "वॉइस नोट भेजते हैं और हर स्कूल को असली कक्षा में दिखाने ले जाते हैं।"),
    },
    {
      icon: SchoolIcon,
      who: t("School heads and contacts", "प्रधानाध्यापक और संपर्क"),
      count: t(`${r.schools.length} schools`, `${r.schools.length} स्कूल`),
      gets: t("A 60-second voice note in a nearby teacher's own words, and the one-page card.", "पास के शिक्षक के शब्दों में 60 सेकंड का वॉइस नोट और एक पेज का कार्ड।"),
      does: t("Name who is responsible for each class, then file a short report each week.", "तय करते हैं कौन-सी कक्षा किसके ज़िम्मे, फिर हर हफ़्ते छोटी रिपोर्ट भरते हैं।"),
    },
    {
      icon: Users,
      who: t("Class teachers", "कक्षा शिक्षक"),
      count: t(`${r.teachers} teachers`, `${r.teachers} शिक्षक`),
      gets: t("The steps below, and a colleague they can ask.", "नीचे के कदम, और एक साथी जिनसे पूछ सकें।"),
      does: words.steps.map((s) => t(...s)).join(" "),
    },
    {
      icon: Sparkles,
      who: t("Children", "बच्चे"),
      count: t(`${r.children.toLocaleString("en-IN")} children`, `${r.children.toLocaleString("en-IN")} बच्चे`),
      gets: t(`In ${classes}.`, `${classes} में।`),
      does: t(...words.children),
    },
  ];
  return (
    <div>
      <h4 className={cx("mb-3 font-semibold", hi)}>{t("How it reaches children", "यह बच्चों तक कैसे पहुँचता है")}</h4>
      <ol className="relative space-y-3">
        <span className="absolute bottom-5 left-[17px] top-5 w-px bg-[var(--line)]" aria-hidden />
        {levels.map((l) => (
          <li key={l.who} className="relative flex gap-3">
            <span className="icon-tile z-[1] h-9 w-9 shrink-0 rounded-full !bg-[var(--chrome-solid)] ring-1 ring-[var(--line)]">
              <l.icon size={16} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className={cx("flex flex-wrap items-baseline justify-between gap-x-3", hi)}>
                <span className="font-semibold">{l.who}</span>
                <span className="text-xs tabular-nums text-[var(--color-ink-3)]">{l.count}</span>
              </div>
              <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>
                {l.gets} <span className="text-[var(--color-ink)]">{l.does}</span>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Why this method, in numbers from the block. */
function Evidence({ r }: { r: MethodRollout }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const e = r.evidence;
  if (!e) return null;
  const a = e.doingWellOf ? e.doingWell / e.doingWellOf : 0;
  const b = e.similarOf ? e.similar / e.similarOf : 0;
  return (
    <div className="card-inset p-4">
      <h4 className={cx("mb-3 font-semibold", hi)}>{t("Why this method", "यही तरीका क्यों")}</h4>
      <div className="space-y-2.5">
        <div>
          <div className={cx("mb-1 flex justify-between text-sm", hi)}>
            <span>{t("Teachers at schools doing well who use it", "अच्छा कर रहे स्कूलों के शिक्षक जो इसे करते हैं")}</span>
            <b className="tabular-nums">{e.doingWell} / {e.doingWellOf}</b>
          </div>
          <Meter value={a} height={8} color="var(--st-bright)" />
        </div>
        <div>
          <div className={cx("mb-1 flex justify-between text-sm", hi)}>
            <span>{t("Teachers at similar schools who use it", "वैसे ही दूसरे स्कूलों के शिक्षक जो इसे करते हैं")}</span>
            <b className="tabular-nums">{e.similar} / {e.similarOf}</b>
          </div>
          <Meter value={b} height={8} color="var(--tone-muted)" />
        </div>
      </div>
      {e.withScore != null && e.similarScore != null && (
        <p className={cx("mt-3 text-sm text-[var(--color-ink-2)]", hi)}>
          {t(
            `In schools using it, ${Math.round(e.withScore)}% of children are at their class level across subjects, against ${Math.round(e.similarScore)}% in similar schools.`,
            `इसे करने वाले स्कूलों में ${Math.round(e.withScore)}% बच्चे अपनी कक्षा के स्तर पर हैं, वैसे ही दूसरे स्कूलों में ${Math.round(e.similarScore)}%।`,
          )}
        </p>
      )}
    </div>
  );
}

function Funnel({ r }: { r: MethodRollout }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const n = r.now.length;
  const rows = [
    [t("Voice note sent", "वॉइस नोट भेजा"), r.counts.note, "var(--tone-info)"],
    [t("Saw it in a real class", "असली कक्षा में देखा"), r.counts.visit, "var(--tone-teal)"],
    [t("School is reporting weekly", "स्कूल हर हफ़्ते रिपोर्ट दे रहा"), r.counts.reported, "var(--tone-lime)"],
    [t("Trying it", "आज़मा रहे"), r.counts.trying + r.counts.regular, "var(--tone-warn)"],
    [t("Doing it regularly", "नियमित कर रहे"), r.counts.regular, "var(--tone-good)"],
  ] as const;
  return (
    <div>
      <h4 className={cx("mb-3 font-semibold", hi)}>{t(`How far it has got (${n} schools this term)`, `कहाँ तक पहुँचा (इस सत्र ${n} स्कूल)`)}</h4>
      <ul className="space-y-2">
        {rows.map(([label, k, color]) => (
          <li key={label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
            <span className={cx("text-[var(--color-ink-2)]", hi)}>{label}</span>
            <b className="tabular-nums">{k} / {n}</b>
            <span className="col-span-2">
              <Meter value={n ? k / n : 0} height={6} color={color} />
            </span>
          </li>
        ))}
      </ul>
      {r.counts.stuck > 0 && (
        <p className={cx("mt-2 flex items-center gap-1.5 text-sm", hi)} style={{ color: "var(--tone-bad)" }}>
          <TriangleAlert size={14} /> {t(`${r.counts.stuck} stuck and need someone`, `${r.counts.stuck} अटके, किसी की ज़रूरत`)}
        </p>
      )}
      {r.reach.childrenReached > 0 && (
        <p className={cx("mt-2 text-sm text-[var(--color-ink-2)]", hi)}>
          {t(`Schools report ${r.reach.teachersUsing} teachers using it with ${r.reach.childrenReached} children.`, `स्कूलों के अनुसार ${r.reach.teachersUsing} शिक्षक इसे ${r.reach.childrenReached} बच्चों के साथ कर रहे हैं।`)}
        </p>
      )}
    </div>
  );
}

function Plan({ r, approved, approvedAt }: { r: MethodRollout; approved: boolean; approvedAt?: string | null }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const n = r.now.length;
  const rows: { when: string; what: string; who: string; k: number; of: number; icon: typeof Mic; to?: string }[] = [
    { when: t("Before week 1", "पहले हफ़्ते से पहले"), what: t("Approve the method card", "तरीके का कार्ड मंज़ूर करें"), who: t("BEO or coordinator", "BEO या समन्वयक"), k: approved ? 1 : 0, of: 1, icon: ClipboardCheck, to: "/review" },
    { when: t("Week 1", "हफ़्ता 1"), what: t("Send the 60-second voice note to each school", "हर स्कूल को 60 सेकंड का वॉइस नोट भेजें"), who: "Jugnu", k: r.counts.note, of: n, icon: Mic },
    { when: t("Week 1 to 2", "हफ़्ता 1 से 2"), what: t("Take teachers to watch it in a nearby class", "शिक्षकों को पास की कक्षा में दिखाने ले जाएँ"), who: t("Cluster coordinators", "क्लस्टर समन्वयक"), k: r.counts.visit, of: n, icon: Footprints },
    { when: t("Week 2", "हफ़्ता 2"), what: t("Name who answers for each class, and start weekly reports", "तय करें कौन-सी कक्षा किसके ज़िम्मे, और साप्ताहिक रिपोर्ट शुरू करें"), who: t("School heads", "प्रधानाध्यापक"), k: r.counts.reported, of: n, icon: SchoolIcon },
    { when: t("Day 14", "14वाँ दिन"), what: t("Call each teacher: did you try it, and what happened?", "हर शिक्षक को फ़ोन: क्या आज़माया, क्या हुआ?"), who: "Jugnu", k: r.counts.called, of: n, icon: Link2 },
    { when: t("End of term", "सत्र के अंत में"), what: t("Check learning against the schools that start next term", "अगले सत्र शुरू करने वाले स्कूलों से सीखने की तुलना करें"), who: "BEO", k: r.impact ? 1 : 0, of: 1, icon: Sparkles, to: "/results" },
  ];
  return (
    <div>
      <h4 className={cx("mb-3 font-semibold", hi)}>{t("Implementation plan", "लागू करने की योजना")}</h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-[var(--color-ink-3)]">
            <tr>
              <th className="pb-2 pr-3 font-medium">{t("When", "कब")}</th>
              <th className="pb-2 pr-3 font-medium">{t("What", "क्या")}</th>
              <th className="pb-2 pr-3 font-medium">{t("Who", "कौन")}</th>
              <th className="w-[180px] pb-2 font-medium">{t("Progress", "प्रगति")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.what} className="border-t border-[var(--line)]">
                <td className={cx("whitespace-nowrap py-2.5 pr-3 text-[var(--color-ink-2)]", hi)}>{x.when}</td>
                <td className={cx("py-2.5 pr-3 font-medium", hi)}>{x.what}</td>
                <td className={cx("py-2.5 pr-3 text-[var(--color-ink-2)]", hi)}>{x.who}</td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <Meter className="flex-1" value={x.of ? x.k / x.of : 0} height={6} color={x.k >= x.of ? "var(--tone-good)" : "var(--tone-info)"} />
                    <span className="w-14 text-right text-xs tabular-nums text-[var(--color-ink-2)]">{x.of === 1 ? (x.k ? t("Done", "पूरा") : "—") : `${x.k}/${x.of}`}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {approved && approvedAt && <p className={cx("mt-2 text-xs text-[var(--color-ink-3)]", hi)}>{t(`Approved on ${new Date(approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`, `${new Date(approvedAt).toLocaleDateString("hi-IN", { day: "numeric", month: "short" })} को मंज़ूर।`)}</p>}
    </div>
  );
}

function ByCluster({ r }: { r: MethodRollout }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  if (!r.clusters.length) return null;
  return (
    <div>
      <h4 className={cx("mb-3 font-semibold", hi)}>{t("Progress by cluster", "क्लस्टर के अनुसार प्रगति")}</h4>
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {r.clusters.map((c) => (
          <li key={c.name} className="card-inset p-3">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-semibold">{c.name}</span>
              <span className={cx("shrink-0 text-xs text-[var(--color-ink-3)]", hi)}>{t(`${c.total} schools`, `${c.total} स्कूल`)}</span>
            </div>
            <Meter className="mt-2" value={c.total ? (c.note + c.visit + c.using) / (c.total * 3) : 0} height={6} color="var(--tone-good)" />
            <div className={cx("mt-1.5 text-xs text-[var(--color-ink-2)]", hi)}>
              {t(`${c.note} notes · ${c.visit} visits · ${c.using} using it`, `${c.note} नोट · ${c.visit} दौरे · ${c.using} अपना रहे`)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SchoolTracker({ r }: { r: MethodRollout }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const [group, setGroup] = useState<"now" | "next">("now");
  const [all, setAll] = useState(false);
  const rows = group === "now" ? r.now : r.next;
  const dot = (on: boolean, color: string, label: string) => <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: on ? color : "transparent", boxShadow: on ? undefined : "inset 0 0 0 1.5px rgb(var(--fg) / 0.28)" }} title={label} aria-label={`${label}: ${on ? t("done", "पूरा") : t("not yet", "अभी नहीं")}`} />;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className={cx("font-semibold", hi)}>{t("Every school", "हर स्कूल")}</h4>
        <Segmented size="sm" value={group} onChange={setGroup} options={[{ value: "now", label: t("This term", "इस सत्र"), count: r.now.length }, { value: "next", label: t("Next term", "अगले सत्र"), count: r.next.length }]} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="text-left text-xs text-[var(--color-ink-3)]">
            <tr>
              <th className="pb-2 pr-3 font-medium">{t("School", "स्कूल")}</th>
              <th className="pb-2 pr-3 font-medium">{t("Learns from", "किससे सीखता है")}</th>
              <th className="pb-2 pr-2 text-center font-medium">{t("Note", "नोट")}</th>
              <th className="pb-2 pr-2 text-center font-medium">{t("Visit", "दौरा")}</th>
              <th className="pb-2 pr-3 text-center font-medium">{t("Report", "रिपोर्ट")}</th>
              <th className="pb-2 font-medium">{t("Where it stands", "स्थिति")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, all ? undefined : 10).map((s: RolloutSchool) => (
              <tr key={s.school.id} className="border-t border-[var(--line)]">
                <td className="py-2 pr-3">
                  <Link to={`/schools/${s.school.id}`} className="tap-link font-medium hover:underline">
                    {lang === "hi" && s.school.nameHi ? s.school.nameHi : s.school.name}
                  </Link>
                  <div className={cx("text-xs text-[var(--color-ink-3)]", hi)}>{t(`${s.school.enrolment} children`, `${s.school.enrolment} बच्चे`)}</div>
                </td>
                <td className="py-2 pr-3 text-[var(--color-ink-2)]">
                  {s.demonstrator.teacher}
                  <div className="text-xs text-[var(--color-ink-3)]">{s.rec.distanceKm.toFixed(1)} km</div>
                </td>
                <td className="py-2 pr-2 text-center">{dot(s.note, "var(--tone-info)", t("Voice note", "वॉइस नोट"))}</td>
                <td className="py-2 pr-2 text-center">{dot(s.visit, "var(--tone-teal)", t("Classroom visit", "कक्षा-दौरा"))}</td>
                <td className="py-2 pr-3 text-center">{dot(!!s.report || !!s.followUp, "var(--tone-lime)", t("Report or call", "रिपोर्ट या कॉल"))}</td>
                <td className="py-2">
                  <span className="chip !text-xs" style={{ color: STAGE[s.stage].color, borderColor: tint(STAGE[s.stage].color, 45) }}>
                    {t(STAGE[s.stage].en, STAGE[s.stage].hi)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && !all && (
        <button className={cx("tap-link mt-2 text-sm font-semibold text-[var(--st-bright)]", hi)} onClick={() => setAll(true)}>
          {t(`Show all ${rows.length}`, `सभी ${rows.length} दिखाएँ`)}
        </button>
      )}
    </div>
  );
}

/** Before and after, once a term has run. */
function Impact({ r }: { r: MethodRollout }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const moved = r.now.filter((s) => s.after != null && s.before != null);
  const before = moved.length ? moved.reduce((a, s) => a + s.before!, 0) / moved.length : null;
  const after = moved.length ? moved.reduce((a, s) => a + s.after!, 0) / moved.length : null;
  return (
    <div className="card-inset p-4">
      <h4 className={cx("mb-1 font-semibold", hi)}>{t("What changed for children", "बच्चों के लिए क्या बदला")}</h4>
      {r.impact && before != null && after != null ? (
        <>
          <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>
            {t(
              `Children at their class level in these schools went from ${Math.round(before)}% to ${Math.round(after)}%. Compared with schools that have not started yet, that is about ${r.impact.effect > 0 ? "+" : ""}${r.impact.effect} points. ${r.impact.adopters} of ${r.impact.groupOne} schools took it up.`,
              `इन स्कूलों में कक्षा-स्तर के बच्चे ${Math.round(before)}% से ${Math.round(after)}% हुए। जिन स्कूलों ने अभी शुरू नहीं किया उनकी तुलना में यह लगभग ${r.impact.effect > 0 ? "+" : ""}${r.impact.effect} अंक है। ${r.impact.groupOne} में से ${r.impact.adopters} स्कूलों ने इसे अपनाया।`,
            )}
          </p>
          <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
            <div>
              <div className={cx("text-xs text-[var(--color-ink-3)]", hi)}>{t("Before", "पहले")}</div>
              <div className="font-display text-2xl font-bold tabular-nums">{Math.round(before)}%</div>
            </div>
            <div>
              <div className={cx("text-xs text-[var(--color-ink-3)]", hi)}>{t("After one term", "एक सत्र बाद")}</div>
              <div className="font-display text-2xl font-bold tabular-nums" style={{ color: "var(--tone-good)" }}>{Math.round(after)}%</div>
            </div>
          </div>
        </>
      ) : (
        <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>
          {t("This fills in at the next learning check, when schools using the method are compared with those starting next term. On the Check progress page you can run a sample term to see it.", "यह अगली जाँच पर भरेगा, जब तरीका अपनाने वाले स्कूलों की तुलना अगले सत्र शुरू करने वालों से होगी। 'प्रगति' पेज पर नमूना सत्र चलाकर देख सकते हैं।")}
        </p>
      )}
    </div>
  );
}
