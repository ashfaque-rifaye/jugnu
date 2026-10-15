import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  ClipboardCheck,
  Clapperboard,
  Footprints,
  Map as MapIcon,
  Mic,
  MessageCircleQuestion,
  PartyPopper,
  Search,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AIVideoLabel, Card, Empty, useAgo } from "../components/kit";
import { LivingMap, MapLegend } from "../components/maps";
import { cx } from "../components/ui";
import { usePoll } from "../lib/api";
import { MEDIA } from "../lib/clips";
import { usePrefs, useT } from "../lib/prefs";
import { inMyPatch, useRole } from "../lib/role";
import { usePipeline, type BlockEvent } from "../lib/store";
import { meanZ, schoolStatuses, type SchoolStatus } from "../lib/status";
import { useTasks, type TaskKind } from "../lib/tasks";

const TASK_ICON: Record<TaskKind, typeof Search> = { spotcheck: Stethoscope, interview: Mic, visit: Footprints, stuck: AlertTriangle, data: Search, review: ClipboardCheck };
const TASK_TONE: Record<TaskKind, string> = { spotcheck: "#7dd3fc", interview: "#facc15", visit: "#c4b5fd", stuck: "#f87171", data: "#f87171", review: "#5eead4" };

interface PilotRow {
  id: string;
  teacher_name: string | null;
  school_name: string | null;
  status: "invited" | "in_progress" | "completed" | "declined";
  created_at: string;
  practices: (string | null)[];
}

export default function TodayPage({ onTour, onAsk }: { onTour: () => void; onAsk: () => void }) {
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
  const count = (k: SchoolStatus) => mine.filter((s) => status.get(s.id) === k).length;
  const stuck = state.recs
    .filter((r) => mine.some((s) => s.id === r.schoolId))
    .flatMap((r) => r.actions)
    .filter((a) => a.status === "stuck").length;
  const links = state.recs.filter((r) => r.wave === 1 && mine.some((s) => s.id === r.schoolId)).map((r) => ({ from: r.demonstratorId, to: r.schoolId }));
  const hi = lang === "hi" && "font-deva";

  const greeting =
    role?.kind === "crp" && crp
      ? t(`Namaste, ${crp.crp.split(" ")[0]} ji. Here is ${crp.clusterName} cluster today.`, `नमस्ते ${crp.crp.split(" ")[0]} जी। आज ${crp.clusterName} क्लस्टर का हाल।`)
      : role?.kind === "beo"
        ? t(`Namaste. Here is ${state.block.name} today.`, `नमस्ते। आज ${state.block.name} का हाल।`)
        : t("Welcome to Jugnu", "जुगनू में स्वागत है");

  return (
    <div className="space-y-5">
      {/* welcome */}
      <section className="card relative overflow-hidden">
        {!lite && <video className="welcome-video" src={MEDIA.welcome} poster={MEDIA.welcomePoster} autoPlay muted loop playsInline aria-hidden />}
        {lite && <img className="welcome-video" src={MEDIA.welcomePoster} alt="" aria-hidden />}
        <div className="welcome-shade" />
        <AIVideoLabel className="absolute bottom-2 right-2" />
        <div className="relative grid gap-5 p-5 md:p-7 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <div className="label mb-2">{new Date().toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
            <h1 className={cx("text-2xl font-bold tracking-tight md:text-3xl", hi)}>{greeting}</h1>
            <p className={cx("mt-2 max-w-xl text-[15px] text-white/85", hi)}>
              {role?.kind === "guest" || !role
                ? t(
                    "Jugnu finds the teachers who already get children reading and counting despite hard conditions, learns exactly what they do by talking to them, and spreads it to nearby schools — then checks it worked. This is a working demo block of 200 schools.",
                    "जुगनू उन शिक्षकों को ढूँढता है जो कठिन हालात में भी बच्चों को पढ़ना-गिनना सिखा रहे हैं, उनसे बात करके समझता है कि वे ठीक-ठीक क्या करते हैं, और उसे पास के स्कूलों तक पहुँचाता है — फिर जाँचता है कि असर हुआ। यह 200 स्कूलों का एक चालू डेमो ब्लॉक है।",
                  )
                : t(`${tasks.length} thing${tasks.length === 1 ? "" : "s"} need you. Start with the first one below.`, `${tasks.length} काम आपका इंतज़ार कर रहे हैं। नीचे पहले वाले से शुरू करें।`)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(role?.kind === "guest" || !role) && (
                <button className="btn btn-primary" onClick={onTour}>
                  <Clapperboard size={16} /> {t("Watch the 2-minute tour", "2 मिनट का टूर देखें")}
                </button>
              )}
              <a className="btn btn-glass" href="/talk" target="_blank" rel="noreferrer">
                <Mic size={16} /> {t("Try the teacher interview", "शिक्षक वाली बातचीत आज़माएँ")}
              </a>
              <button className="btn btn-glass" onClick={onAsk}>
                <MessageCircleQuestion size={16} /> {t("Ask Jugnu a question", "जुगनू से सवाल पूछें")}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            {(
              [
                ["bright", t("bright spots", "अच्छे स्कूल"), "/schools?status=bright"],
                ["support", t("getting support", "मदद पा रहे"), "/plan"],
                ["check_due", t("spot checks due", "जाँच बाकी"), "/schools?status=check_due"],
                ["stuck", t("actions stuck", "अटके काम"), "/plan?status=stuck"],
              ] as const
            ).map(([k, label, to]) => (
              <Link key={k} to={to} className="rounded-xl border border-white/12 bg-black/35 px-3 py-2 backdrop-blur transition hover:border-amber-200/40">
                <div className="font-display text-2xl font-bold tabular-nums" style={{ color: k === "stuck" ? "#f87171" : k === "bright" ? "#facc15" : k === "support" ? "#c4b5fd" : "#7dd3fc" }}>
                  {k === "stuck" ? stuck : count(k)}
                </div>
                <div className={cx("text-xs text-white/75", hi)}>{label}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <div className="space-y-5">
          <Card title={t("Needs you", "आपके काम")} icon={CalendarCheck2} right={<span className="chip">{tasks.length}</span>}>
            {tasks.length === 0 ? (
              <Empty icon={PartyPopper} title={t("Nothing waiting for you", "आपके लिए कुछ बाकी नहीं")}>
                {t("All spot checks, visits and approvals are done. Check the Results page for follow-up calls.", "सब जाँचें, दौरे और मंज़ूरियाँ पूरी हैं। फ़ॉलो-अप कॉल के लिए 'नतीजे' पेज देखें।")}
              </Empty>
            ) : (
              <ul className="space-y-2">
                {tasks.slice(0, 8).map((task) => {
                  const Icon = TASK_ICON[task.kind];
                  const s = task.schoolId ? state.block.schools.find((x) => x.id === task.schoolId) : undefined;
                  const to = task.kind === "review" ? "/review" : s ? `/schools/${s.id}` : "/";
                  return (
                    <li key={task.id}>
                      <Link to={to} onClick={() => s && select(s.id)} className="card-inset card-hover flex items-center gap-3 px-3 py-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `${TASK_TONE[task.kind]}1f`, color: TASK_TONE[task.kind] }}>
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cx("block truncate text-[15px] font-semibold", hi)}>{t(task.title[0], task.title[1])}</span>
                          {s && (
                            <span className="block truncate text-xs text-[var(--color-ink-3)]">
                              {s.teacher} · {s.clusterName} {t("cluster", "क्लस्टर")}
                              {task.action ? ` · ${task.action.owner}` : ""}
                            </span>
                          )}
                        </span>
                        <ArrowRight size={16} className="shrink-0 text-[var(--color-ink-3)]" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {tasks.length > 8 && (
              <Link to="/plan" className="mt-3 inline-flex items-center gap-1 text-sm text-amber-200">
                {t(`See all ${tasks.length}`, `सभी ${tasks.length} देखें`)} <ArrowRight size={14} />
              </Link>
            )}
          </Card>

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

          {(role?.kind === "guest" || !role) && <HowItWorks />}
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const t = useT();
  const steps: [typeof Search, string, string, string][] = [
    [
      Search,
      "/schools",
      t("Find", "खोजें"),
      t(
        "Schools that beat what their context predicts, year after year — checked on the spot so inflated data is caught.",
        "जो स्कूल साल-दर-साल अपने हालात से बेहतर करते हैं — मौके पर जाँच के साथ, ताकि बढ़ा-चढ़ा डेटा पकड़ा जाए।",
      ),
    ],
    [Mic, "/interviews", t("Ask", "पूछें"), t("A 12-minute voice interview with the teacher, in Hindi, on any phone.", "शिक्षक से 12 मिनट की हिंदी आवाज़-बातचीत, किसी भी फ़ोन पर।")],
    [
      Sparkles,
      "/practices",
      t("Learn", "सीखें"),
      t("Keep only the routines that separate bright spots from similar schools.", "सिर्फ़ वे तरीके रखें जो अच्छे स्कूलों को उन जैसे स्कूलों से अलग करते हैं।"),
    ],
    [
      Footprints,
      "/plan",
      t("Spread & track", "फैलाएँ व देखें"),
      t(
        "Each school that needs support gets one practice, a teacher nearby who does it, and owners — then a follow-up call.",
        "मदद चाहने वाले हर स्कूल को एक तरीका, पास का शिक्षक जो यह करता है, और ज़िम्मेदार — फिर फ़ॉलो-अप कॉल।",
      ),
    ],
  ];
  return (
    <Card title={t("How Jugnu works", "जुगनू कैसे काम करता है")} icon={Sparkles}>
      <ol className="space-y-2">
        {steps.map(([Icon, to, title, text], i) => (
          <li key={to}>
            <Link to={to} className="card-inset card-hover flex gap-3 p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-200/15 text-sm font-bold text-amber-100">{i + 1}</span>
              <span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Icon size={15} className="text-amber-200" /> {title}
                </span>
                <span className="block text-sm text-[var(--color-ink-2)]">{text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
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
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-300" />
            <span className="min-w-0">
              <span className="block">{text}</span>
              <span className="block text-xs text-[var(--color-ink-3)]">
                {s && !schoolId && (
                  <Link to={`/schools/${s.id}`} className="underline decoration-white/20 hover:text-white">
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
