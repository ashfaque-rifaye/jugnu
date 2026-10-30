import { motion } from "framer-motion";
import { Activity, AlertTriangle, ArrowRight, CalendarCheck2, CheckCheck, ClipboardCheck, Footprints, Map as MapIcon, MessageCircleQuestion, Mic, Newspaper, PartyPopper, Play, Search, Stethoscope, Target, UserRound, Workflow } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ActivityFeed } from "../components/ActivityFeed";
import { useDemo } from "../components/Demo";
import { JourneyCard } from "../components/Journey";
import { Card, Empty, Rings, SPRING } from "../components/kit";
import { LoopFlow } from "../components/LoopFlow";
import { LivingMap, MapLegend } from "../components/maps";
import { cx } from "../components/ui";
import { DAMOH, profileFor } from "../engine/district";
import { CountUp, EASE, Tilt, WordReveal } from "../lib/motion";
import { usePoll } from "../lib/api";
import { MEDIA } from "../lib/clips";
import { usePrefs, useT } from "../lib/prefs";
import { inMyPatch, useRole } from "../lib/role";
import { meanZ, schoolStatuses, tint, type SchoolStatus } from "../lib/status";
import { usePipeline } from "../lib/store";
import { loopCounts } from "../lib/story";
import { useTasks, type Task, type TaskKind } from "../lib/tasks";

const TASK_ICON: Record<TaskKind, typeof Search> = { spotcheck: Stethoscope, interview: Mic, visit: Footprints, stuck: AlertTriangle, data: Search, review: ClipboardCheck, signoff: CheckCheck, weekly: ClipboardCheck };
const TASK_TONE: Record<TaskKind, string> = {
  spotcheck: "var(--st-check-due)",
  interview: "var(--st-bright)",
  visit: "var(--tone-visit)",
  stuck: "var(--tone-bad)",
  data: "var(--tone-bad)",
  review: "var(--tone-review)",
  signoff: "var(--tone-good)",
  weekly: "var(--tone-info)",
};
const GROUPS: { kind: TaskKind | "all"; en: string; hi: string }[] = [
  { kind: "all", en: "All", hi: "सभी" },
  { kind: "stuck", en: "Stuck", hi: "अटके" },
  { kind: "signoff", en: "To sign off", hi: "पुष्टि बाकी" },
  { kind: "weekly", en: "Weekly report", hi: "साप्ताहिक रिपोर्ट" },
  { kind: "review", en: "Approvals", hi: "मंज़ूरी" },
  { kind: "spotcheck", en: "School visits", hi: "दौरे" },
  { kind: "interview", en: "Talk to teachers", hi: "बातचीत" },
  { kind: "data", en: "Results to check", hi: "नतीजे जाँचें" },
  { kind: "visit", en: "Classroom visits", hi: "कक्षा-दौरे" },
];

interface PilotRow {
  id: string;
  teacher_name: string | null;
  school_name: string | null;
  status: "invited" | "in_progress" | "completed" | "declined";
  created_at: string;
  practices: (string | null)[];
}

const taskLink = (task: Task) => (task.kind === "review" ? "/review" : task.kind === "signoff" ? "/plan?view=board" : task.kind === "weekly" ? `/schools/${task.schoolId}?tab=people` : task.schoolId ? `/schools/${task.schoolId}?tab=act` : "/today");

export default function TodayPage({ onAsk, onRole, onTour }: { onAsk: () => void; onRole: () => void; onTour: () => void }) {
  const t = useT();
  const nav = useNavigate();
  const { lite, lang } = usePrefs();
  const [role] = useRole();
  const demo = useDemo();
  const { state, events, select, regenerate } = usePipeline();
  const [reviews] = usePoll<unknown[]>("/api/reviews?status=pending", 15000);
  const [pilot] = usePoll<PilotRow[]>("/api/interviews", 15000);
  const tasks = useTasks(state, role, reviews?.length ?? 0);
  const status = useMemo(() => schoolStatuses(state), [state]);
  const z = useMemo(() => meanZ(state), [state]);
  const [filter, setFilter] = useState<SchoolStatus | null>(null);
  const crp = role?.kind === "crp" ? state.block.schools.find((s) => s.cluster === role.cluster) : undefined;
  const mine = state.block.schools.filter((s) => inMyPatch(role, s.cluster));
  const links = state.recs.filter((r) => r.wave === 1 && mine.some((s) => s.id === r.schoolId)).map((r) => ({ from: r.demonstratorId, to: r.schoolId }));
  const hi = lang === "hi" && "font-deva";
  const guest = role?.kind === "guest" || !role;
  const hero = role?.kind === "beo" ? { video: MEDIA.doorOfficer, poster: MEDIA.doorOfficerPoster } : role?.kind === "crp" ? { video: MEDIA.doorCoordinator, poster: MEDIA.doorCoordinatorPoster } : role?.kind === "head" ? { video: MEDIA.doorHead, poster: MEDIA.doorHeadPoster } : { video: MEDIA.doorClassroom, poster: MEDIA.doorClassroomPoster };
  const headSchool = role?.kind === "head" ? state.block.schools.find((s) => s.id === role.schoolId) : undefined;
  const first = tasks[0];

  const greeting =
    role?.kind === "crp" && crp
      ? t(`Namaste, ${crp.crp.split(" ")[0]} ji`, `नमस्ते, ${crp.crp.split(" ")[0]} जी`)
      : role?.kind === "beo"
        ? t("Namaste", "नमस्ते")
        : headSchool
          ? t(`Namaste, ${headSchool.staff.find((p) => p.role === "head")?.name.split(" ")[0] ?? ""} ji`, `नमस्ते, ${headSchool.staff.find((p) => p.role === "head")?.name.split(" ")[0] ?? ""} जी`)
          : t("Welcome", "स्वागत है");
  const where = role?.kind === "crp" && crp ? t(`${crp.clusterName} cluster`, `${crp.clusterName} क्लस्टर`) : headSchool ? headSchool.name : state.block.name;
  const stuck = tasks.filter((x) => x.kind === "stuck").length;
  const summary = guest
    ? t(
        "You are seeing what a Block Education Officer sees: every school in the block. Start with the first task, or watch a whole term.",
        "आप वही देख रहे हैं जो ब्लॉक शिक्षा अधिकारी देखते हैं: ब्लॉक का हर स्कूल। पहले काम से शुरू करें, या पूरा सत्र देखें।",
      )
    : tasks.length === 0
      ? t(`Nothing is waiting in ${where}. Well done.`, `${where} में कुछ बाकी नहीं। बहुत बढ़िया।`)
      : t(
          `${tasks.length} thing${tasks.length === 1 ? "" : "s"} in ${where} need${tasks.length === 1 ? "s" : ""} you${stuck ? ` — ${stuck} stuck` : ""}.`,
          `${where} में ${tasks.length} काम आपका इंतज़ार कर रहे हैं${stuck ? ` — ${stuck} अटके` : ""}।`,
        );

  return (
    <div className="space-y-5">
      {/* the day: a calm hero with the one next step floating on it */}
      <section className="card on-dark relative overflow-hidden !rounded-[2rem]">
        {!lite && <video key={hero.video} className="welcome-video" src={hero.video} poster={hero.poster} autoPlay muted loop playsInline aria-hidden />}
        {lite && <img className="welcome-video" src={hero.poster} alt="" aria-hidden />}
        <div className="welcome-shade" />
        <div className="pointer-events-none absolute inset-3 rounded-[1.6rem] border border-white/10" aria-hidden />
        <div className="relative grid gap-5 p-5 md:p-8 lg:grid-cols-[1fr_380px] lg:items-end">
          <div className="min-w-0 pb-4">
            <div className="label mb-3 !text-white/60">{new Date().toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
            <h1 className={cx("display-xl text-[2.6rem] text-white md:text-[3.6rem]", hi)}>
              <WordReveal key={greeting} text={greeting} stagger={0.08} />
            </h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.3, ease: EASE }} className={cx("mt-3 max-w-xl text-[15px] leading-relaxed text-white/75", hi)}>
              {summary}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.42, ease: EASE }} className="mt-5 flex flex-wrap gap-2">
              {demo.available && (
                <button className="btn btn-primary" onClick={demo.start} data-tour="play">
                  <Play size={16} /> {t("Play the term", "सत्र चलाकर देखें")}
                </button>
              )}
              <button className="btn btn-glass" onClick={() => window.dispatchEvent(new CustomEvent("jugnu:ask", { detail: "brief" }))}>
                <Newspaper size={16} /> {t("Brief me", "ब्रीफ़ करो")}
              </button>
              <button className="btn btn-glass" onClick={onAsk}>
                <MessageCircleQuestion size={16} /> {t("Ask Jugnu", "जुगनू से पूछें")}
              </button>
              <button className="btn btn-glass" onClick={onRole}>
                <UserRound size={16} /> {guest ? t("Choose my role", "मेरी भूमिका चुनें") : t("Switch role", "भूमिका बदलें")}
              </button>
            </motion.div>
          </div>
          {/* the frosted "start here" card */}
          <Tilt className="[transform-style:preserve-3d]">
          <motion.div initial={{ opacity: 0, y: 28, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1, delay: 0.35, ease: EASE }} className="rounded-[1.6rem] border border-white/15 bg-white/[0.09] p-4 shadow-2xl backdrop-blur-2xl" data-tour="hero-next">
            {first ? (
              <StartHere task={first} school={first.schoolId ? state.block.schools.find((s) => s.id === first.schoolId) : undefined} onOpen={() => first.schoolId && select(first.schoolId)} more={tasks.length - 1} />
            ) : (
              <div className={cx("text-white", hi)}>
                <div className="label !text-white/60">{t("Start here", "यहीं से शुरू करें")}</div>
                <div className="mt-1 text-lg font-semibold">{t("Nothing waiting for you", "आपके लिए कुछ बाकी नहीं")}</div>
                <p className="mt-1 text-sm text-white/70">{t("Play the term to watch confirmation visits, visits and calls arrive.", "जाँच, दौरे और कॉल आते देखने के लिए सत्र चलाएँ।")}</p>
              </div>
            )}
          </motion.div>
          </Tilt>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-[1.1fr_1fr_1fr]">
        <TermRings onPlay={demo.available ? demo.start : undefined} />
        <JourneyCard onTour={onTour} onDemo={demo.start} />
        <Card
          title={t("Live activity", "लाइव गतिविधि")}
          icon={Activity}
          tone="var(--tone-teal)"
          className="lg:col-span-2 2xl:col-span-1"
          right={
            <span className="chip !text-xs" style={{ color: "var(--tone-good)" }}>
              <span className="live-dot !h-1.5 !w-1.5" /> {t("all devices", "सभी डिवाइस")}
            </span>
          }
        >
          <div className="scroll-thin lg:max-h-[330px] lg:overflow-y-auto lg:pr-1">
            <ActivityFeed events={events} limit={10} />
          </div>
        </Card>
      </div>

      <Card title={t("From data to action, this term", "डेटा से काम तक, इस सत्र")} icon={Workflow} tone="var(--tone-lime)" accent>
        <LoopFlow compact />
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <NeedsYou tasks={tasks} />
        <Card
          tour="map"
          title={role?.kind === "crp" && crp ? t(`${crp.clusterName} cluster on the map`, `नक्शे पर ${crp.clusterName} क्लस्टर`) : t("Your block on the map", "नक्शे पर आपका ब्लॉक")}
          icon={MapIcon}
          tone="var(--st-bright)"
          right={
            <Link to="/schools" className="tap-link text-sm font-semibold text-[var(--st-bright)]">
              {t("All schools", "सभी स्कूल")} →
            </Link>
          }
        >
          <div className="overflow-hidden rounded-[1.3rem]">
            <LivingMap
              schools={state.block.schools}
              status={status}
              z={z}
              links={links}
              highlight={role?.kind === "crp" ? new Set(mine.map((s) => s.id)) : filter ? new Set(state.block.schools.filter((s) => status.get(s.id) === filter).map((s) => s.id)) : undefined}
              onSelect={(id) => (select(id), nav(`/schools/${id}`))}
              height={460}
              autoRotate
              block={profileFor(state.block.seed)?.block}
              onBlock={(name) => {
                const p = DAMOH.find((x) => x.block === name);
                if (p) regenerate(p.code);
              }}
            />
          </div>
          <div className="mt-3">
            <MapLegend status={role?.kind === "crp" ? new Map([...status].filter(([id]) => mine.some((s) => s.id === id))) : status} active={filter} onPick={setFilter} />
          </div>
          <p className={cx("mt-2 text-xs leading-relaxed text-[var(--color-ink-3)]", hi)}>
            {lite
              ? t("Each dot is a school. Tap one to open it.", "हर बिंदु एक स्कूल है। खोलने के लिए छुएँ।")
              : t(
                  "Each dot is a real school, where it stands. Tap one for its card — attendance, grades 1–5 and the distance to the nearest school doing well. The ruler measures between any two schools; the link button shows who learns from whom.",
                  "हर बिंदु एक असली स्कूल है, अपनी असली जगह पर। कार्ड के लिए छुएँ — उपस्थिति, कक्षा 1–5 और सबसे पास के अच्छे स्कूल की दूरी। पैमाना किन्हीं दो स्कूलों की दूरी नापता है; लिंक बटन बताता है कौन किससे सीखता है।",
                )}
          </p>
        </Card>
      </div>

      <Card
        title={t("Teacher conversations", "शिक्षकों से बातचीत")}
        icon={Mic}
        tone="var(--tone-teal)"
        right={
          <Link to="/interviews" className="tap-link text-sm font-semibold text-[var(--st-bright)]">
            {t("Open", "खोलें")} →
          </Link>
        }
      >
        {!pilot?.length ? (
          <p className="text-sm text-[var(--color-ink-2)]">
            {t("No conversations yet. Open a school doing well and invite its teacher.", "अभी कोई बातचीत नहीं। अच्छा कर रहा कोई स्कूल खोलें और शिक्षक को आमंत्रित करें।")}
          </p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {pilot.slice(0, 6).map((p) => (
              <li key={p.id} className="card-inset flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  <b>{p.teacher_name || t("Teacher", "शिक्षक")}</b> <span className="text-[var(--color-ink-3)]">· {p.school_name || "—"}</span>
                </span>
                <span className="chip shrink-0 text-xs" style={p.status === "completed" ? { color: "var(--tone-good)" } : p.status === "in_progress" ? { color: "var(--tone-teal)" } : undefined}>
                  {p.status === "in_progress" && <span className="live-dot !h-1.5 !w-1.5" />}
                  {p.status === "completed"
                    ? t(`done · ${new Set(p.practices).size} methods`, `पूरी · ${new Set(p.practices).size} तरीके`)
                    : p.status === "in_progress"
                      ? t("talking now", "बात जारी")
                      : p.status === "declined"
                        ? t("declined", "मना किया")
                        : t("invited", "आमंत्रित")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StartHere({ task, school, onOpen, more }: { task: Task; school?: { name: string; teacher: string; clusterName: string }; onOpen: () => void; more: number }) {
  const t = useT();
  const { lang } = usePrefs();
  const Icon = TASK_ICON[task.kind];
  const tone = TASK_TONE[task.kind];
  return (
    <div className={cx("text-white", lang === "hi" && "font-deva")}>
      <div className="flex items-center justify-between">
        <span className="label !text-white/60">{t("Start here", "यहीं से शुरू करें")}</span>
        {more > 0 && <span className="text-xs font-medium text-white/50">{t(`+${more} more below`, `+${more} और नीचे`)}</span>}
      </div>
      <div className="mt-2.5 flex items-start gap-3">
        <span className="icon-tile h-11 w-11 rounded-[0.95rem]" style={{ "--tile": tone } as CSSProperties}>
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <div className="text-[16px] font-semibold leading-snug">{t(task.title[0], task.title[1])}</div>
          {school && (
            <div className="mt-0.5 truncate text-xs text-white/60">
              {school.teacher} · {school.clusterName} {t("cluster", "क्लस्टर")}
              {task.action ? ` · ${task.action.owner}` : ""}
            </div>
          )}
        </div>
      </div>
      <Link to={taskLink(task)} onClick={onOpen} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-semibold text-[#0b1308] transition active:scale-[0.97]">
        {t("Open", "खोलें")} <ArrowRight size={15} />
      </Link>
    </div>
  );
}

/** Activity-style rings for the term: checked on the spot → reached with a practice → called back. */
function TermRings({ onPlay }: { onPlay?: () => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const { state, followUps } = usePipeline();
  const c = loopCounts(state, followUps);
  const wave1 = state.recs.filter((r) => r.wave === 1).length;
  const wave2 = state.recs.length - wave1;
  const checked = c.candidates - c.checksDue;
  const rows = [
    { color: "var(--ring-1)", label: t("Confirmed by a visit", "दौरे से पुष्टि"), k: checked, n: c.candidates, to: "/schools" },
    { color: "var(--ring-2)", label: t("Reached with a method", "तरीका पहुँचा"), k: c.reached, n: wave1, to: "/plan" },
    { color: "var(--ring-3)", label: t("Called back on day 14", "14वें दिन कॉल"), k: c.calls, n: wave1, to: "/results" },
  ];
  const pct = Math.round((rows.reduce((a, r) => a + (r.n ? r.k / r.n : 0), 0) / rows.length) * 100);
  return (
    <Card title={t("This term", "इस सत्र")} icon={Target} tone="var(--ring-1)" tour="rings" accent>
      <div className="flex flex-wrap items-center gap-5">
        <Rings rings={rows.map((r) => ({ value: r.n ? r.k / r.n : 0, color: r.color }))} size={172} stroke={14} gap={3}>
          <div className="font-display text-[1.45rem] font-bold leading-none tabular-nums">
            <CountUp value={pct} />%
          </div>
        </Rings>
        <ul className="min-w-[180px] flex-1 space-y-2.5">
          <li className={cx("text-xs text-[var(--color-ink-3)]", lang === "hi" && "font-deva")}>{t(`${pct}% of the term's work is done`, `सत्र का ${pct}% काम पूरा`)}</li>
          {rows.map((r) => (
            <li key={r.label}>
              <Link to={r.to} className="tap-row group flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color, boxShadow: `0 0 10px ${tint(r.color, 60)}` }} />
                <span className={cx("flex-1 text-[13.5px] text-[var(--color-ink-2)] group-hover:text-[var(--color-ink)]", lang === "hi" && "font-deva")}>{r.label}</span>
                <span className="font-display text-[15px] font-bold tabular-nums">
                  <CountUp value={r.k} />
                  <span className="text-[var(--color-ink-3)]">/{r.n}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <p className={cx("mt-4 text-xs leading-relaxed text-[var(--color-ink-3)]", lang === "hi" && "font-deva")}>
        {t(
          `${wave1} schools start this term and ${wave2} next term. Comparing the two is how we will know if it worked.`,
          `${wave1} स्कूल इस सत्र और ${wave2} अगले सत्र शुरू करते हैं। दोनों की तुलना से पता चलेगा कि असर हुआ या नहीं।`,
        )}
      </p>
      {onPlay && c.calls === 0 && (
        <button className="btn btn-glass mt-3 w-full justify-center" onClick={onPlay}>
          <Play size={15} /> {t("Watch the rings fill — play the term", "घेरे भरते देखें — सत्र चलाएँ")}
        </button>
      )}
    </Card>
  );
}

/** "Needs you": everything waiting, grouped by kind of work. */
function NeedsYou({ tasks }: { tasks: Task[] }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const { state, select } = usePipeline();
  const [group, setGroup] = useState<TaskKind | "all">("all");
  const counts = useMemo(() => {
    const m = new Map<TaskKind, number>();
    for (const x of tasks) m.set(x.kind, (m.get(x.kind) ?? 0) + 1);
    return m;
  }, [tasks]);
  const shown = group === "all" ? tasks : tasks.filter((x) => x.kind === group);
  const school = (task: Task) => (task.schoolId ? state.block.schools.find((x) => x.id === task.schoolId) : undefined);

  return (
    <Card title={t("Needs you", "आपके काम")} icon={CalendarCheck2} tone="var(--st-check-due)" right={<span className="chip tabular-nums">{tasks.length}</span>}>
      {tasks.length === 0 ? (
        <Empty icon={PartyPopper} title={t("Nothing waiting for you", "आपके लिए कुछ बाकी नहीं")}>
          {t("All confirmation visits, visits and approvals are done. Check the Results page for follow-up calls.", "सब जाँचें, दौरे और मंज़ूरियाँ पूरी हैं। फ़ॉलो-अप कॉल के लिए 'नतीजे' पेज देखें।")}
        </Empty>
      ) : (
        <>
          <div className="no-scrollbar -mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist">
            {GROUPS.filter((g) => g.kind === "all" || counts.get(g.kind)).map((g) => {
              const n = g.kind === "all" ? tasks.length : (counts.get(g.kind) ?? 0);
              const on = group === g.kind;
              const tone = g.kind === "all" ? "var(--color-ink)" : TASK_TONE[g.kind];
              return (
                <button
                  key={g.kind}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setGroup(g.kind)}
                  className={cx("seg-item relative isolate flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors", hi, on ? "text-[var(--color-ink)]" : "text-[var(--color-ink-2)] hover:text-[var(--color-ink)]")}
                >
                  {on && <motion.span layoutId="needs-tab" className="seg-on absolute inset-0 -z-10 rounded-full" transition={SPRING} />}
                  {g.kind !== "all" && <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />}
                  {t(g.en, g.hi)} <span className="tabular-nums text-[var(--color-ink-3)]">{n}</span>
                </button>
              );
            })}
          </div>

          <ul className="space-y-1.5">
            {shown.slice(0, 7).map((task, i) => {
              const Icon = TASK_ICON[task.kind];
              const s = school(task);
              return (
                <motion.li key={task.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: i * 0.03 }}>
                  <Link to={taskLink(task)} onClick={() => task.schoolId && select(task.schoolId)} className="card-inset card-hover flex items-center gap-3 px-3 py-2.5">
                    <span className="icon-tile h-9 w-9 rounded-full" style={{ "--tile": TASK_TONE[task.kind] } as CSSProperties}>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx("block truncate text-[14.5px] font-medium", hi)}>{t(task.title[0], task.title[1])}</span>
                      {s && (
                        <span className="block truncate text-xs text-[var(--color-ink-3)]">
                          {s.teacher} · {s.clusterName} {t("cluster", "क्लस्टर")}
                          {task.action ? ` · ${task.action.owner}` : ""}
                        </span>
                      )}
                    </span>
                    <ArrowRight size={15} className="shrink-0 text-[var(--color-ink-3)]" />
                  </Link>
                </motion.li>
              );
            })}
          </ul>
          {shown.length > 7 && (
            <Link to="/plan" className={cx("tap-link mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--st-bright)]", hi)}>
              {t(`${shown.length - 7} more — see them on the sharing plan`, `${shown.length - 7} और — स्कूलों तक पहुँचाएँ में देखें`)} <ArrowRight size={14} />
            </Link>
          )}
        </>
      )}
    </Card>
  );
}
