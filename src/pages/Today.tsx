import { Activity, AlertTriangle, ArrowRight, CalendarCheck2, ClipboardCheck, Footprints, Map as MapIcon, MessageCircleQuestion, Mic, PartyPopper, Search, Stethoscope, UserRound, Workflow } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ActivityFeed } from "../components/ActivityFeed";
import { AIVideoLabel, Card, Empty } from "../components/kit";
import { LoopFlow } from "../components/LoopFlow";
import { LivingMap, MapLegend } from "../components/maps";
import { cx } from "../components/ui";
import { usePoll } from "../lib/api";
import { MEDIA } from "../lib/clips";
import { usePrefs, useT } from "../lib/prefs";
import { inMyPatch, useRole } from "../lib/role";
import { meanZ, schoolStatuses, tint, type SchoolStatus } from "../lib/status";
import { usePipeline } from "../lib/store";
import { useTasks, type Task, type TaskKind } from "../lib/tasks";

const TASK_ICON: Record<TaskKind, typeof Search> = { spotcheck: Stethoscope, interview: Mic, visit: Footprints, stuck: AlertTriangle, data: Search, review: ClipboardCheck };
const TASK_TONE: Record<TaskKind, string> = {
  spotcheck: "var(--st-check-due)",
  interview: "var(--st-bright)",
  visit: "var(--tone-visit)",
  stuck: "var(--tone-bad)",
  data: "var(--tone-bad)",
  review: "var(--tone-review)",
};
const GROUPS: { kind: TaskKind | "all"; en: string; hi: string }[] = [
  { kind: "all", en: "All", hi: "सभी" },
  { kind: "stuck", en: "Stuck", hi: "अटके" },
  { kind: "review", en: "Approvals", hi: "मंज़ूरी" },
  { kind: "spotcheck", en: "Spot checks", hi: "जाँच" },
  { kind: "interview", en: "Interviews", hi: "बातचीत" },
  { kind: "data", en: "Data to check", hi: "डेटा जाँच" },
  { kind: "visit", en: "Peer visits", hi: "साथी-दौरे" },
];

interface PilotRow {
  id: string;
  teacher_name: string | null;
  school_name: string | null;
  status: "invited" | "in_progress" | "completed" | "declined";
  created_at: string;
  practices: (string | null)[];
}

export default function TodayPage({ onAsk, onRole }: { onAsk: () => void; onRole: () => void }) {
  const t = useT();
  const nav = useNavigate();
  const { lite, lang } = usePrefs();
  const [role] = useRole();
  const { state, events, select } = usePipeline();
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

  const greeting =
    role?.kind === "crp" && crp
      ? t(`Namaste, ${crp.crp.split(" ")[0]} ji`, `नमस्ते, ${crp.crp.split(" ")[0]} जी`)
      : role?.kind === "beo"
        ? t("Namaste", "नमस्ते")
        : t("You are looking around as a visitor", "आप मेहमान के रूप में देख रहे हैं");
  const where = role?.kind === "crp" && crp ? t(`${crp.clusterName} cluster`, `${crp.clusterName} क्लस्टर`) : state.block.name;
  const stuck = tasks.filter((x) => x.kind === "stuck").length;
  const summary = guest
    ? t(
        "This is what a Block Education Officer sees — every school in the demo block. Choose a role to see only the work that is yours.",
        "यह वही है जो ब्लॉक शिक्षा अधिकारी देखते हैं — डेमो ब्लॉक का हर स्कूल। सिर्फ़ अपना काम देखने के लिए भूमिका चुनें।",
      )
    : tasks.length === 0
      ? t(`Nothing is waiting in ${where}. Well done.`, `${where} में कुछ बाकी नहीं। बहुत बढ़िया।`)
      : t(
          `${tasks.length} thing${tasks.length === 1 ? "" : "s"} in ${where} need you${stuck ? ` — ${stuck} stuck, start there` : ". Start with the first one"}.`,
          `${where} में ${tasks.length} काम आपका इंतज़ार कर रहे हैं${stuck ? ` — ${stuck} अटके हैं, वहीं से शुरू करें` : "। पहले वाले से शुरू करें"}।`,
        );

  return (
    <div className="space-y-5">
      {/* the day, in one line */}
      <section className="card on-dark relative overflow-hidden">
        {!lite && <video className="welcome-video" src={MEDIA.welcome} poster={MEDIA.welcomePoster} autoPlay muted loop playsInline aria-hidden />}
        {lite && <img className="welcome-video" src={MEDIA.welcomePoster} alt="" aria-hidden />}
        <div className="welcome-shade" />
        <AIVideoLabel className="absolute bottom-2 right-2" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 p-5 md:p-6">
          <div className="min-w-0 max-w-2xl">
            <div className="label mb-1.5">{new Date().toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
            <h1 className={cx("text-2xl font-bold tracking-tight md:text-[1.9rem]", hi)}>{greeting}</h1>
            <p className={cx("mt-1.5 text-[15px] text-[var(--color-ink-2)]", hi)}>{summary}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={cx("btn", guest ? "btn-primary" : "btn-glass")} onClick={onRole}>
              <UserRound size={16} /> {guest ? t("Choose my role", "मेरी भूमिका चुनें") : t("Switch role", "भूमिका बदलें")}
            </button>
            <button className="btn btn-glass" onClick={onAsk}>
              <MessageCircleQuestion size={16} /> {t("Ask Jugnu", "जुगनू से पूछें")}
            </button>
          </div>
        </div>
      </section>

      <Card title={t("From data to action, this term", "डेटा से काम तक, इस सत्र")} icon={Workflow}>
        <LoopFlow compact />
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <div className="space-y-5">
          <NeedsYou tasks={tasks} />
          <Card title={t("Recent activity", "हाल की गतिविधि")} icon={Activity}>
            <ActivityFeed events={events} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title={role?.kind === "crp" && crp ? t(`${crp.clusterName} cluster tonight`, `आज रात ${crp.clusterName} क्लस्टर`) : t("The block tonight", "आज रात ब्लॉक")}
            icon={MapIcon}
            right={
              <Link to="/schools" className="text-sm text-amber-200">
                {t("All schools", "सभी स्कूल")} →
              </Link>
            }
          >
            <div className="overflow-hidden rounded-xl">
              <LivingMap
                schools={state.block.schools}
                status={status}
                z={z}
                links={links}
                highlight={role?.kind === "crp" ? new Set(mine.map((s) => s.id)) : filter ? new Set(state.block.schools.filter((s) => status.get(s.id) === filter).map((s) => s.id)) : undefined}
                onSelect={(id) => (select(id), nav(`/schools/${id}`))}
                height={360}
                autoRotate
              />
            </div>
            <div className="mt-3">
              <MapLegend status={role?.kind === "crp" ? new Map([...status].filter(([id]) => mine.some((s) => s.id === id))) : status} active={filter} onPick={setFilter} />
            </div>
            <p className={cx("mt-2 text-xs text-[var(--color-ink-3)]", hi)}>
              {lite
                ? t("Each dot is a school. Tap one to open it.", "हर बिंदु एक स्कूल है। खोलने के लिए छुएँ।")
                : t(
                    "Each house is a school — brighter windows mean children are doing better than expected. Fireflies mark bright spots; arcs of light show who is learning from whom. Drag to turn, tap a house to open it.",
                    "हर घर एक स्कूल है — खिड़कियाँ जितनी चमकीली, बच्चे अपेक्षा से उतना बेहतर। जुगनू अच्छे स्कूल दिखाते हैं; रोशनी की रेखाएँ बताती हैं कौन किससे सीख रहा है। घुमाने के लिए खींचें, स्कूल खोलने के लिए घर छुएँ।",
                  )}
            </p>
          </Card>

          <Card
            title={t("Interviews from the field", "मैदान से बातचीत")}
            icon={Mic}
            right={
              <Link to="/interviews" className="text-sm text-amber-200">
                {t("Open", "खोलें")} →
              </Link>
            }
          >
            {!pilot?.length ? (
              <p className="text-sm text-[var(--color-ink-2)]">
                {t("No real interviews yet. Open a bright-spot school and press “Invite for interview”.", "अभी कोई असली बातचीत नहीं। किसी अच्छे स्कूल को खोलें और “बातचीत के लिए बुलाएँ” दबाएँ।")}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {pilot.slice(0, 4).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      <b>{p.teacher_name || t("Teacher", "शिक्षक")}</b> <span className="text-[var(--color-ink-3)]">· {p.school_name || "—"}</span>
                    </span>
                    <span className="chip shrink-0 text-[11px]">
                      {p.status === "completed"
                        ? t(`done · ${new Set(p.practices).size} practices`, `पूरी · ${new Set(p.practices).size} तरीके`)
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
      </div>
    </div>
  );
}

/** "Needs you": the first task as a clear next step, the rest grouped by kind of work. */
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
  const [first, ...rest] = shown;
  const school = (task: Task) => (task.schoolId ? state.block.schools.find((x) => x.id === task.schoolId) : undefined);
  const to = (task: Task) => (task.kind === "review" ? "/review" : task.schoolId ? `/schools/${task.schoolId}` : "/today");

  return (
    <Card title={t("Needs you", "आपके काम")} icon={CalendarCheck2} right={<span className="chip">{tasks.length}</span>}>
      {tasks.length === 0 ? (
        <Empty icon={PartyPopper} title={t("Nothing waiting for you", "आपके लिए कुछ बाकी नहीं")}>
          {t("All spot checks, visits and approvals are done. Check the Results page for follow-up calls.", "सब जाँचें, दौरे और मंज़ूरियाँ पूरी हैं। फ़ॉलो-अप कॉल के लिए 'नतीजे' पेज देखें।")}
        </Empty>
      ) : (
        <>
          <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
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
                  className={cx("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition", hi, on ? "seg-on" : "text-[var(--color-ink-2)] hover:text-[var(--color-ink)]")}
                  style={{ borderColor: on ? tint(tone, 60) : "var(--chip-line)" }}
                >
                  {g.kind !== "all" && <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />}
                  {t(g.en, g.hi)} <span className="tabular-nums text-[var(--color-ink-3)]">{n}</span>
                </button>
              );
            })}
          </div>

          {first && (
            <Link
              to={to(first)}
              onClick={() => first.schoolId && select(first.schoolId)}
              className="card-hover mb-2 flex items-center gap-4 rounded-2xl border p-4"
              style={{ borderColor: tint(TASK_TONE[first.kind], 45), background: tint(TASK_TONE[first.kind], 8) }}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: tint(TASK_TONE[first.kind], 18), color: TASK_TONE[first.kind] }}>
                {(() => {
                  const Icon = TASK_ICON[first.kind];
                  return <Icon size={20} />;
                })()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="label block">{t("Start here", "यहीं से शुरू करें")}</span>
                <span className={cx("mt-0.5 block text-[16px] font-semibold leading-snug", hi)}>{t(first.title[0], first.title[1])}</span>
                <TaskMeta task={first} school={school(first)} />
              </span>
              <span className="btn btn-primary hidden shrink-0 !py-2 sm:inline-flex">
                {t("Open", "खोलें")} <ArrowRight size={15} />
              </span>
            </Link>
          )}

          <ul className="space-y-1.5">
            {rest.slice(0, 6).map((task) => {
              const Icon = TASK_ICON[task.kind];
              return (
                <li key={task.id}>
                  <Link to={to(task)} onClick={() => task.schoolId && select(task.schoolId)} className="card-inset card-hover flex items-center gap-3 px-3 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: tint(TASK_TONE[task.kind], 14), color: TASK_TONE[task.kind] }}>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx("block truncate text-[15px] font-medium", hi)}>{t(task.title[0], task.title[1])}</span>
                      <TaskMeta task={task} school={school(task)} />
                    </span>
                    <ArrowRight size={15} className="shrink-0 text-[var(--color-ink-3)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
          {rest.length > 6 && (
            <Link to="/plan" className={cx("mt-3 inline-flex items-center gap-1 text-sm text-amber-200", hi)}>
              {t(`${rest.length - 6} more — see them on the support plan`, `${rest.length - 6} और — मदद की योजना में देखें`)} <ArrowRight size={14} />
            </Link>
          )}
        </>
      )}
    </Card>
  );
}

function TaskMeta({ task, school }: { task: Task; school?: { teacher: string; clusterName: string } }) {
  const t = useT();
  if (!school) return null;
  return (
    <span className="block truncate text-xs text-[var(--color-ink-3)]">
      {school.teacher} · {school.clusterName} {t("cluster", "क्लस्टर")}
      {task.action ? ` · ${task.action.owner}` : ""}
    </span>
  );
}
