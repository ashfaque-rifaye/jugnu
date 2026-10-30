import { ArrowLeft, BadgeCheck, MapPin, BookOpen, Check, ClipboardList, Footprints, History, Info, LineChart, Mic, PhoneCall, Quote, Search, Sparkles, Stethoscope, Users, Volume2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ActionRow, FollowUpForm, SpotCheckForm, VoiceNote } from "../components/field";
import { PhotoCheck, VisitInviteButton, WhatsAppSend } from "../components/insights";
import { InviteForSchool } from "../components/Invite";
import { SatThumb } from "../components/SchoolMapCard";
import { Card, Empty, PageHeader, StatusChip, Tracker, useAgo, type TrackStep } from "../components/kit";
import { cx } from "../components/ui";
import { distanceKm } from "../engine/block";
import { nearest } from "../engine/geo";
import { PRACTICES } from "../engine/practices";
import { CYCLES, type School } from "../engine/types";
import { usePoll } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";
import { schoolStatuses, STATUS_INFO, type SchoolStatus } from "../lib/status";
import type { PipelineState } from "../engine/pipeline";
import type { FollowUp } from "../engine/types";
import { ActivityFeed } from "../components/ActivityFeed";

interface PilotRow {
  id: string;
  school_id: string | null;
  status: "invited" | "in_progress" | "completed" | "declined";
  created_at: string;
  practices: (string | null)[];
  channel: string;
}

export default function SchoolPage() {
  const { id = "" } = useParams();
  const t = useT();
  const nav = useNavigate();
  const { lang } = usePrefs();
  const ago = useAgo();
  const { state, events, spotChecks, followUps, refreshLive, blockKey, tracked } = usePipeline();
  const status = useMemo(() => schoolStatuses(state), [state]);
  const [pilot, , reloadPilot] = usePoll<PilotRow[]>("/api/interviews", 10000);
  const [recheck, setRecheck] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const s = state.block.schools.find((x) => x.id === id);
  if (!s)
    return (
      <Empty icon={Info} title={t("School not found", "स्कूल नहीं मिला")}>
        <Link to="/schools" className="underline">
          {t("Back to all schools", "सभी स्कूलों पर लौटें")}
        </Link>
      </Empty>
    );

  const st = status.get(s.id)!;
  const v = state.verify.find((x) => x.schoolId === s.id);
  const rec = state.recs.find((r) => r.schoolId === s.id);
  const demo = rec ? state.block.schools.find((x) => x.id === rec.demonstratorId) : undefined;
  const learners = state.recs.filter((r) => r.demonstratorId === s.id);
  const interview = state.interviews.find((i) => i.schoolId === s.id);
  const live = pilot?.filter((p) => p.school_id === s.id) ?? [];
  const follow = followUps.find((f) => f.schoolId === s.id) ?? state.track?.followUps.find((f) => f.schoolId === s.id);
  const recorded = spotChecks[s.id];
  const group = st === "bright" ? "bright" : state.comparison.includes(s.id) ? "comparison" : "live";
  const hi = lang === "hi" && "font-deva";
  const last = CYCLES.length - 1;
  const steps = trackerSteps({ t, st, state, schoolId: s.id, interviewed: !!interview, learners: learners.length, follow, spot: v?.spotCheck });

  return (
    <div>
      <button className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-ink-2)] hover:text-white" onClick={() => (history.length > 1 ? nav(-1) : nav("/schools"))}>
        <ArrowLeft size={15} /> {t("Back", "वापस")}
      </button>
      <PageHeader
        eyebrow={`${s.clusterName} ${t("cluster", "क्लस्टर")} · CRP ${s.crp}`}
        title={lang === "hi" && s.nameHi ? s.nameHi : s.name}
        sub={`${t("Govt. Primary School", "शासकीय प्राथमिक शाला")} · ${s.teacher} · ${s.enrolment} ${t("children", "बच्चे")}`}
        actions={<StatusChip status={st} />}
      />

      {/* where this school is in the loop */}
      {steps.length > 0 && (
        <section className="card mb-5 p-4 md:p-6" data-tour="school-tracker">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="label">{t("Where this school is in the loop", "यह स्कूल चक्र में कहाँ है")}</div>
            <span className="chip !text-xs">{t(`${steps.filter((x) => x.state === "done").length} of ${steps.length} done`, `${steps.length} में से ${steps.filter((x) => x.state === "done").length} पूरे`)}</span>
          </div>
          <Tracker steps={steps} />
        </section>
      )}

      {/* what to do next */}
      <section className="card mb-5 overflow-hidden p-4 md:p-6" data-tour="school-next">
        <span className="absolute inset-y-4 left-0 w-1 rounded-r-full" style={{ background: STATUS_INFO[st].color }} aria-hidden />
        <div className="label mb-1">{t("What to do next", "अगला कदम")}</div>
        <div className={cx("text-lg font-semibold", hi)}>{t(...STATUS_INFO[st].next)}</div>
        <div className="mt-3">
          {st === "check_due" && <SpotCheckForm school={s} />}
          {st === "bright" && !interview && <InviteForSchool school={s} group="bright" onCreated={() => (reloadPilot(), refreshLive())} />}
          {st === "bright" && interview && (
            <p className="text-sm text-[var(--color-ink-2)]">
              {t(
                `Already interviewed — ${new Set(interview.mentions.map((m) => m.practice)).size} practices described (below). Their routines now help ${learners.length} school${learners.length === 1 ? "" : "s"}.`,
                `बातचीत हो चुकी — ${new Set(interview.mentions.map((m) => m.practice)).size} तरीके बताए (नीचे)। उनके तरीके अब ${learners.length} स्कूलों की मदद कर रहे हैं।`,
              )}
            </p>
          )}
          {st === "check_data" && (
            <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>
              {t(
                "The spot check found far fewer children reading or doing subtraction than the school reported. This is a reason to visit and talk respectfully — not a judgement. Record a new spot check after the visit.",
                "मौके की जाँच में स्कूल के दर्ज परिणामों से बहुत कम बच्चे पढ़ या घटा पाए। यह सम्मान से मिलने और बात करने का कारण है — कोई फ़ैसला नहीं। मिलने के बाद नई जाँच दर्ज करें।",
              )}
            </p>
          )}
          {st === "support" && rec && demo && (
            <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>
              {t(
                `Share “${PRACTICES[rec.practice].label}” from ${demo.teacher} (${rec.distanceKm} km away). The plan, voice note and actions are below.`,
                `${demo.teacher} (${rec.distanceKm} किमी दूर) का “${PRACTICES[rec.practice].labelHi}” पहुँचाएँ। योजना, वॉइस नोट और काम नीचे हैं।`,
              )}
            </p>
          )}
          {st === "ok" && (
            <p className="text-sm text-[var(--color-ink-2)]">{t("Results are close to what this school's context predicts.", "परिणाम इस स्कूल के हालात के अनुसार अपेक्षा के करीब हैं।")}</p>
          )}
          {st === "revisit" && (
            <p className="text-sm text-[var(--color-ink-2)]">
              {t(
                "The spot check is fine, but the yearly results move more than chance allows, or beat expectation in only some years. Ask the teacher what changed — a new teacher, a new routine, or a data entry slip — before treating it as a bright spot.",
                "मौके की जाँच ठीक है, पर सालाना परिणाम संयोग से ज़्यादा बदलते हैं, या कुछ ही साल अपेक्षा से ऊपर रहे। अच्छा स्कूल मानने से पहले शिक्षक से पूछें कि क्या बदला — नया शिक्षक, नया तरीका, या डेटा भरने में चूक।",
              )}
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Card title={t("Grade 3 results — reported vs expected", "कक्षा 3 के परिणाम — दर्ज बनाम अपेक्षित")} icon={BookOpen}>
            <ResultsChart school={s} expected={state.find.expected[s.id]} />
            <p className="mt-2 text-xs text-[var(--color-ink-3)]">
              {t(
                "Bars: share of Grade 3 children at grade level, as reported. White line: what schools with this context usually reach. Above the line in 2 of 3 years = a candidate bright spot.",
                "पट्टियाँ: दर्ज परिणाम — कक्षा 3 के कितने बच्चे स्तर पर हैं। सफ़ेद रेखा: ऐसे हालात वाले स्कूल आमतौर पर कहाँ पहुँचते हैं। 3 में से 2 साल रेखा से ऊपर = संभावित अच्छा स्कूल।",
              )}
            </p>
          </Card>

          {s.grades.length > 0 && <GradesCard school={s} />}

          {rec && demo && (
            <Card title={t("Support plan", "मदद की योजना")} icon={Footprints} right={<span className="chip">{t(`Wave ${rec.wave}`, `लहर ${rec.wave}`)}</span>}>
              <div className="card-inset mb-3 p-3">
                <div className="text-xs text-[var(--color-ink-3)]">{t("Practice to try", "आज़माने का तरीका")}</div>
                <div className="text-lg font-semibold">{lang === "hi" ? PRACTICES[rec.practice].labelHi : PRACTICES[rec.practice].label}</div>
                <div className="text-sm text-[var(--color-ink-2)]">{PRACTICES[rec.practice].what}</div>
                <div className="mt-2 text-xs text-[var(--color-ink-3)]">{rec.why}</div>
              </div>
              <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                <span>
                  {t("Learns from", "किससे सीखेंगे")}:{" "}
                  <Link to={`/schools/${demo.id}`} className="font-semibold text-amber-200 underline decoration-amber-200/30">
                    {demo.teacher}, {demo.name}
                  </Link>
                </span>
                <span className="chip">{rec.distanceKm} km</span>
              </div>
              <VoiceNote rec={rec} school={s} demo={demo} />
              <div className="mt-3">
                <VisitInviteButton blockKey={blockKey} schoolId={s.id} tracked={tracked} />
              </div>
              <div className="mt-4 space-y-2">
                <div className="label">{t("Owned actions", "ज़िम्मेदारी वाले काम")}</div>
                {rec.actions.map((a) => (
                  <ActionRow key={a.id} action={a} compact />
                ))}
              </div>
            </Card>
          )}

          {rec && rec.wave === 1 && (
            <Card title={t("Follow-up call (day 14)", "फ़ॉलो-अप कॉल (14वाँ दिन)")} icon={PhoneCall}>
              {follow ? (
                <div className="mb-3 text-sm">
                  <span className="chip mr-2">
                    {
                      {
                        adopted: t("Doing it regularly", "नियमित कर रहे हैं"),
                        trying: t("Trying it", "आज़मा रहे हैं"),
                        barrier: t("Something is in the way", "रुकावट"),
                        no_answer: t("No answer", "जवाब नहीं"),
                      }[follow.outcome]
                    }
                  </span>
                  {follow.said && <span className="font-deva">“{follow.said}”</span>}
                  {"by" in follow && typeof follow.by === "string" && <div className="mt-1 text-xs text-[var(--color-ink-3)]">{t(`Recorded by ${follow.by}`, `${follow.by} ने दर्ज किया`)}</div>}
                </div>
              ) : (
                <p className="mb-3 text-sm text-[var(--color-ink-2)]">
                  {t(
                    "Jugnu calls the teacher two weeks after the visit: “Did you try it? What happened?”. If you called yourself, record it here.",
                    "दौरे के दो हफ़्ते बाद जुगनू शिक्षक को फ़ोन करता है: “क्या आपने आज़माया? क्या हुआ?”। अगर आपने खुद बात की, यहाँ दर्ज करें।",
                  )}
                </p>
              )}
              <FollowUpForm school={s} practice={PRACTICES[rec.practice].label} />
              <div className="mt-3 border-t border-white/8 pt-3">
                <WhatsAppSend blockKey={blockKey} schoolId={s.id} teacher={s.teacher} practice={rec.practice} />
              </div>
            </Card>
          )}

          {(interview || live.length > 0 || st === "bright" || group === "comparison") && (
            <Card title={t("What the teacher described", "शिक्षक ने क्या बताया")} icon={Mic}>
              {interview ? (
                <ul className="space-y-2">
                  {interview.mentions.map((m, i) => (
                    <li key={i} className="card-inset flex gap-2 p-3 text-sm">
                      <Quote size={14} className="mt-0.5 shrink-0 text-amber-200" />
                      <div>
                        <div className="font-deva">{m.quote}</div>
                        <div className="mt-1 text-xs text-[var(--color-ink-3)]">
                          {PRACTICES[m.practice].label} · {t(`${m.specificity} concrete details`, `${m.specificity} ठोस बातें`)}
                        </div>
                      </div>
                    </li>
                  ))}
                  <li className="text-xs text-[var(--color-ink-3)]">
                    {interview.turns.length
                      ? t("From the demo block's interview history.", "डेमो ब्लॉक की बातचीत के इतिहास से।")
                      : t("From a real interview in the live pilot.", "लाइव पायलट की असली बातचीत से।")}
                  </li>
                </ul>
              ) : (
                <p className="text-sm text-[var(--color-ink-2)]">{t("No interview yet.", "अभी कोई बातचीत नहीं।")}</p>
              )}
              {live.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="label">{t("Live interviews", "लाइव बातचीत")}</div>
                  {live.map((p) => (
                    <Link key={p.id} to="/interviews" className="card-inset flex items-center justify-between px-3 py-2 text-sm hover:bg-white/5">
                      <span>{ago(p.created_at)}</span>
                      <span className="chip text-xs">
                        {p.status === "completed"
                          ? t("completed", "पूरी")
                          : p.status === "in_progress"
                            ? t("talking", "जारी")
                            : p.status === "declined"
                              ? t("declined", "मना किया")
                              : t("invited", "आमंत्रित")}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {(interview || group === "comparison") && st !== "check_due" && (
                <div className="mt-4 border-t border-white/8 pt-4">
                  <InviteForSchool school={s} group={group} onCreated={() => (reloadPilot(), refreshLive())} />
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {s.lat != null && s.lon != null && <WhereCard school={s} />}
          {v && (
            <Card title={t("Is the bright spot real?", "क्या अच्छा स्कूल सच में अच्छा है?")} icon={BadgeCheck}>
              <ul className="space-y-2">
                {v.checks.map((c) => (
                  <li key={c.name} className="flex gap-2 text-sm">
                    {c.passed ? <Check size={16} className="mt-0.5 shrink-0 text-emerald-300" /> : <X size={16} className="mt-0.5 shrink-0 text-rose-300" />}
                    <span>
                      <span className="font-medium">{c.name}</span>
                      <span className="block text-xs text-[var(--color-ink-3)]">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {recorded && (
                <p className="mt-3 text-xs text-[var(--color-ink-3)]">
                  {t(`Spot check recorded by ${recorded.by ?? "a CRP"}, ${ago(recorded.at)}.`, `जाँच ${recorded.by ?? "CRP"} ने दर्ज की, ${ago(recorded.at)}।`)}
                </p>
              )}
              {st !== "check_due" && (
                <div className="mt-3 border-t border-white/8 pt-3">
                  {recheck ? (
                    <SpotCheckForm school={s} onSaved={() => setRecheck(false)} />
                  ) : (
                    <button className="btn btn-glass !py-1.5 text-sm" onClick={() => setRecheck(true)}>
                      <Stethoscope size={14} /> {t("Record a new spot check", "नई जाँच दर्ज करें")}
                    </button>
                  )}
                </div>
              )}
            </Card>
          )}
          {v && <PhotoCheck schoolId={s.id} blockKey={blockKey} practices={state.evidence.filter((e) => e.verdict === "distinctive").map((e) => e.practice)} />}

          <Card title={t("About the school", "स्कूल के बारे में")} icon={ClipboardList}>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {(
                [
                  [t("Children enrolled", "दर्ज बच्चे"), s.enrolment],
                  [t("In Grade 3", "कक्षा 3 में"), s.grade3],
                  [t("Pupils per teacher", "प्रति शिक्षक बच्चे"), s.ptr],
                  [t("Classes", "कक्षाएँ"), s.multigrade ? t("multigrade", "बहु-कक्षा") : t("one grade per class", "हर कक्षा अलग")],
                  [t("Library", "पुस्तकालय"), s.library ? t("in use", "उपयोग में") : t("not in use", "उपयोग में नहीं")],
                  [t("Attendance", "उपस्थिति"), `${Math.round(s.attendance * 100)}%`],
                  [t("Speak another language at home", "घर पर दूसरी भाषा"), `${Math.round(s.langMismatch * 100)}%`],
                  [t("Latest reading / maths", "ताज़ा पढ़ना / गणित"), `${s.reading[last]}% / ${s.numeracy[last]}%`],
                ] as const
              ).map(([k, val]) => (
                <div key={k}>
                  <dt className="text-xs text-[var(--color-ink-3)]">{k}</dt>
                  <dd className="font-medium">{val}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {learners.length > 0 && (
            <Card title={t(`${learners.length} schools learn from ${s.teacher.split(" ")[0]}`, `${learners.length} स्कूल ${s.teacher.split(" ")[0]} से सीखते हैं`)} icon={Users}>
              <ul className="space-y-1.5">
                {learners.slice(0, showAll ? undefined : 6).map((r) => {
                  const ls = state.block.schools.find((x) => x.id === r.schoolId)!;
                  return (
                    <li key={r.schoolId}>
                      <Link to={`/schools/${ls.id}`} className="card-inset flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-white/5">
                        <span className="min-w-0 truncate">
                          <b>{ls.name}</b> <span className="text-[var(--color-ink-3)]">· {PRACTICES[r.practice].label}</span>
                        </span>
                        <span className="chip shrink-0">{distanceKm(s, ls)} km</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {learners.length > 6 && !showAll && (
                <button className="mt-2 text-sm text-amber-200" onClick={() => setShowAll(true)}>
                  {t(`Show all ${learners.length}`, `सभी ${learners.length} दिखाएँ`)}
                </button>
              )}
            </Card>
          )}

          <Card title={t("History", "इतिहास")} icon={History}>
            <ActivityFeed events={events} schoolId={s.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Attendance over three years and grades 1–5 this year: who comes, and who is at grade level. */
function GradesCard({ school: s }: { school: School }) {
  const t = useT();
  const pct = (x: number) => Math.round(x * 100);
  const bar = (v: number, color: string) => (
    <span className="relative block h-2 w-full overflow-hidden rounded-full bg-[var(--ring-track)]">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, v)}%`, background: color }} />
    </span>
  );
  const last = s.attendanceByCycle.length - 1;
  return (
    <Card title={t("Attendance and grades 1–5", "उपस्थिति और कक्षा 1–5")} icon={Users}>
      <div className="mb-4 flex flex-wrap items-end gap-5">
        <div>
          <div className="text-xs text-[var(--color-ink-3)]">{t("Children present on an average day", "औसत दिन मौजूद बच्चे")}</div>
          <div className="text-2xl font-semibold tabular-nums">
            {pct(s.attendanceByCycle[last])}%{" "}
            <span className="text-sm font-normal text-[var(--color-ink-3)]">
              ~{Math.round(s.enrolment * s.attendanceByCycle[last])} {t(`of ${s.enrolment}`, `/ ${s.enrolment}`)}
            </span>
          </div>
        </div>
        <div className="flex items-end gap-2" aria-label={t("Attendance by year", "साल के अनुसार उपस्थिति")}>
          {s.attendanceByCycle.map((a, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-xs tabular-nums text-[var(--color-ink-3)]">{pct(a)}</span>
              <span className="w-7 rounded-t-md bg-[var(--tone-info)]" style={{ height: Math.max(4, (a - 0.4) * 90), opacity: i === last ? 1 : 0.45 }} />
              <span className="text-xs text-[var(--color-ink-3)]">{CYCLES[i].slice(2)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-sm">
          <thead className="text-left text-xs text-[var(--color-ink-3)]">
            <tr>
              <th className="pb-2 font-medium">{t("Grade", "कक्षा")}</th>
              <th className="pb-2 text-right font-medium">{t("Enrolled", "नामांकन")}</th>
              <th className="w-[22%] pb-2 pl-3 font-medium">{t("Attending", "उपस्थिति")}</th>
              <th className="w-[22%] pb-2 pl-3 font-medium">{t("Reading at level", "स्तर पर पढ़ना")}</th>
              <th className="w-[22%] pb-2 pl-3 font-medium">{t("Maths at level", "स्तर पर गणित")}</th>
            </tr>
          </thead>
          <tbody>
            {s.grades.map((g) => (
              <tr key={g.grade} className="border-t border-[var(--line)]">
                <td className="py-2 font-semibold">
                  {g.grade}
                  {g.grade === 3 && <span className="chip ml-1.5 !px-1.5 !py-0 !text-xs">{t("assessed", "आकलित")}</span>}
                </td>
                <td className="py-2 text-right tabular-nums">{g.enrolled}</td>
                <td className="py-2 pl-3">
                  <div className="flex items-center gap-2">
                    {bar(pct(g.attendance), "var(--tone-info)")}
                    <span className="w-9 text-right text-xs tabular-nums">{pct(g.attendance)}%</span>
                  </div>
                </td>
                <td className="py-2 pl-3">
                  <div className="flex items-center gap-2">
                    {bar(g.reading, "var(--tone-reading)")}
                    <span className="w-9 text-right text-xs tabular-nums">{Math.round(g.reading)}%</span>
                  </div>
                </td>
                <td className="py-2 pl-3">
                  <div className="flex items-center gap-2">
                    {bar(g.numeracy, "var(--st-bright)")}
                    <span className="w-9 text-right text-xs tabular-nums">{Math.round(g.numeracy)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--color-ink-3)]">
        {t(
          "Each grade against its own bar (letters and numbers in Grade 1 … a story and division in Grade 5). Grade 3 is the cohort the state assesses; the others come from the school's own records.",
          "हर कक्षा अपने स्तर के हिसाब से (कक्षा 1 में अक्षर व अंक … कक्षा 5 में कहानी व भाग)। कक्षा 3 का आकलन राज्य करता है; बाकी स्कूल के अपने रिकॉर्ड से।",
        )}
      </p>
    </Card>
  );
}

/** Where the school is: from above, and how far the nearest bright spot is. */
function WhereCard({ school: s }: { school: School }) {
  const t = useT();
  const { lang } = usePrefs();
  const { state } = usePipeline();
  const status = useMemo(() => schoolStatuses(state), [state]);
  const near = useMemo(() => nearest(s, state.block.schools.filter((x) => status.get(x.id) === "bright")), [s, state.block, status]);
  return (
    <Card title={t("Where it is", "कहाँ है")} icon={MapPin} pad={false}>
      <SatThumb lat={s.lat!} lon={s.lon!} className="h-40 w-full" />
      <div className="space-y-2 p-4 text-sm">
        <div className="text-[var(--color-ink-2)]">
          {lang === "hi" && s.nameHi ? s.nameHi : s.village} · {s.clusterName} {t("cluster", "क्लस्टर")} · {s.lat!.toFixed(4)}, {s.lon!.toFixed(4)}
        </div>
        {near && status.get(s.id) !== "bright" && (
          <div>
            {t("Nearest bright spot", "सबसे पास का अच्छा स्कूल")}:{" "}
            <Link to={`/schools/${near.school.id}`} className="font-semibold underline decoration-[rgb(var(--fg)/0.25)]">
              {lang === "hi" && near.school.nameHi ? near.school.nameHi : near.school.name}
            </Link>{" "}
            <span className="text-[var(--color-ink-3)]">
              · {near.trip.km} km · ~{near.trip.roadKm} km {t("by road", "सड़क से")} · ~{near.trip.minutes} min {t("by motorbike", "बाइक से")}
            </span>
          </div>
        )}
        <Link to={`/schools?focus=${s.id}`} className="btn btn-glass w-full justify-center">
          <MapPin size={15} /> {t("Show on the map", "नक्शे पर दिखाएँ")}
        </Link>
      </div>
    </Card>
  );
}

function ResultsChart({ school, expected }: { school: School; expected: { reading: number[]; numeracy: number[] } }) {
  const t = useT();
  const W = 520;
  const H = 190;
  const groups = [
    { key: "reading" as const, label: t("Reading", "पढ़ना"), color: "#38bdf8" },
    { key: "numeracy" as const, label: t("Maths", "गणित"), color: "#a3e635" },
  ];
  const y = (v: number) => H - 26 - (v / 100) * (H - 46);
  const slot = (W - 40) / CYCLES.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("Reported versus expected results per year", "हर साल दर्ज बनाम अपेक्षित परिणाम")}>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={34} x2={W - 6} y1={y(g)} y2={y(g)} stroke="white" strokeOpacity={0.07} />
          <text x={28} y={y(g) + 4} textAnchor="end" className="fill-white/40 text-xs">
            {g}%
          </text>
        </g>
      ))}
      {CYCLES.map((c, i) => {
        const x0 = 40 + i * slot + slot * 0.18;
        const bw = slot * 0.3;
        return (
          <g key={c}>
            {groups.map((g, j) => {
              const v = school[g.key][i];
              const e = expected[g.key][i];
              const x = x0 + j * (bw + 6);
              return (
                <g key={g.key}>
                  <rect x={x} y={y(v)} width={bw} height={y(0) - y(v)} rx={4} fill={g.color} fillOpacity={0.85} />
                  <line x1={x - 3} x2={x + bw + 3} y1={y(e)} y2={y(e)} stroke="white" strokeWidth={2.2} />
                  <text x={x + bw / 2} y={y(v) - 5} textAnchor="middle" className="fill-white/80 text-xs font-semibold">
                    {Math.round(v)}
                  </text>
                </g>
              );
            })}
            <text x={x0 + bw + 3} y={H - 8} textAnchor="middle" className="fill-white/55 text-xs">
              {c}
            </text>
          </g>
        );
      })}
      {groups.map((g, j) => (
        <g key={g.key} transform={`translate(${W - 170 + j * 80}, 8)`}>
          <rect width={10} height={10} rx={2} fill={g.color} />
          <text x={15} y={9} className="fill-white/70 text-xs">
            {g.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

type T = (en: string, hi: string) => string;

/** The school's journey through the loop, step by step — depends on what kind of school it is. */
function trackerSteps({
  t,
  st,
  state,
  schoolId,
  interviewed,
  learners,
  follow,
  spot,
}: {
  t: T;
  st: SchoolStatus;
  state: PipelineState;
  schoolId: string;
  interviewed: boolean;
  learners: number;
  follow?: FollowUp;
  spot?: { sampled: number; proficient: number; numeracyProficient: number };
}): TrackStep[] {
  const above = state.find.z[schoolId]?.filter((z) => z >= 0.9).length ?? 0;
  const found: TrackStep = { key: "found", icon: Search, state: "done", label: t("Beat its context", "हालात से आगे"), sub: t(`${above} of 3 years above expected`, `3 में से ${above} साल अपेक्षा से ऊपर`) };
  const checked = spot && spot.sampled > 0;
  if (st === "bright" || st === "check_due")
    return [
      found,
      { key: "check", icon: Stethoscope, state: checked ? "done" : "current", label: t("Spot check", "मौके की जाँच"), sub: checked ? t(`${spot!.proficient}/${spot!.sampled} read · ${spot!.numeracyProficient}/${spot!.sampled} maths`, `पढ़ना ${spot!.proficient}/${spot!.sampled} · गणित ${spot!.numeracyProficient}/${spot!.sampled}`) : t("15 children, 15 minutes", "15 बच्चे, 15 मिनट") },
      { key: "listen", icon: Mic, state: interviewed ? "done" : checked ? "current" : "todo", label: t("Interview", "बातचीत"), sub: interviewed ? t("Routines described", "तरीके बताए") : t("12-minute voice call", "12 मिनट की कॉल") },
      { key: "learn", icon: Sparkles, state: interviewed && learners > 0 ? "done" : "todo", label: t("Practice proven", "तरीका साबित"), sub: t("Only bright spots do it", "सिर्फ़ अच्छे स्कूल करते हैं") },
      { key: "share", icon: Users, state: learners > 0 ? "done" : "todo", label: learners > 0 ? t(`Helping ${learners} schools`, `${learners} स्कूलों की मदद`) : t("Shared nearby", "पास में पहुँचा"), sub: t("Teacher to teacher", "शिक्षक से शिक्षक") },
    ];
  if (st === "check_data")
    return [
      found,
      { key: "check", icon: Stethoscope, state: "bad", label: t("Spot check disagreed", "जाँच में अंतर"), sub: checked ? t(`${spot!.proficient}/${spot!.sampled} read — far below reported`, `${spot!.sampled} में से ${spot!.proficient} — दर्ज से बहुत कम`) : undefined },
      { key: "revisit", icon: Footprints, state: "current", label: t("Respectful revisit", "सम्मान से दोबारा"), sub: t("A conversation, not a penalty", "बातचीत, सज़ा नहीं") },
    ];
  if (st === "revisit")
    return [
      found,
      { key: "check", icon: Stethoscope, state: "done", label: t("Spot check", "मौके की जाँच"), sub: t("Matches the reported results", "दर्ज परिणाम से मेल") },
      { key: "talk", icon: Mic, state: "current", label: t("Ask what changed", "पूछें क्या बदला"), sub: t("Results move a lot between years", "सालों में बहुत बदलाव") },
      { key: "next", icon: LineChart, state: "todo", label: t("Look again next cycle", "अगले चक्र में फिर देखें") },
    ];
  const rec = state.recs.find((r) => r.schoolId === schoolId);
  if (!rec) return [];
  const demo = state.block.schools.find((x) => x.id === rec.demonstratorId);
  const action = (suffix: string) => rec.actions.find((a) => a.id.endsWith(suffix));
  const note = action("-note");
  const visit = action("-visit");
  const matched: TrackStep = { key: "match", icon: Users, state: "done", label: t("Matched with a teacher", "शिक्षक से जोड़ा"), sub: demo ? `${demo.teacher.split(" ")[0]} · ${rec.distanceKm} km` : undefined };
  if (rec.wave === 2)
    return [
      matched,
      { key: "wait", icon: History, state: "current", label: t("Wave 2: starts next term", "लहर 2: अगले सत्र"), sub: t("The fair comparison for wave 1", "लहर 1 की सही तुलना") },
      { key: "note", icon: Volume2, state: "todo", label: t("Voice note", "वॉइस नोट") },
      { key: "visit", icon: Footprints, state: "todo", label: t("Peer visit", "साथी-दौरा") },
      { key: "call", icon: PhoneCall, state: "todo", label: t("Day-14 call", "14वें दिन कॉल") },
    ];
  const noteDone = note?.status === "done";
  const visitDone = visit?.status === "done";
  const tracked = !!state.track;
  return [
    matched,
    { key: "note", icon: Volume2, state: noteDone ? "done" : "current", label: t("Voice note sent", "वॉइस नोट भेजा"), sub: t("60 seconds, a peer's own words", "60 सेकंड, साथी के शब्द") },
    { key: "visit", icon: Footprints, state: visit?.status === "stuck" ? "bad" : visitDone ? "done" : noteDone ? "current" : "todo", label: t("Peer visit", "साथी-दौरा"), sub: visit?.status === "stuck" ? t("Stuck — escalated", "अटका — ऊपर भेजा") : demo ? t(`Watch ${demo.teacher.split(" ")[0]} teach`, `${demo.teacher.split(" ")[0]} को पढ़ाते देखें`) : undefined },
    {
      key: "call",
      icon: PhoneCall,
      state: follow ? (follow.outcome === "barrier" ? "bad" : "done") : visitDone ? "current" : "todo",
      label: t("Day-14 call", "14वें दिन कॉल"),
      sub: follow ? { adopted: t("Doing it regularly", "नियमित कर रहे हैं"), trying: t("Trying it", "आज़मा रहे हैं"), barrier: t("Something is in the way", "रुकावट"), no_answer: t("No answer yet", "अभी जवाब नहीं") }[follow.outcome] : t("“Did you try it?”", "“क्या आज़माया?”"),
    },
    { key: "assess", icon: LineChart, state: tracked ? "done" : follow ? "current" : "todo", label: t("Next assessment", "अगली परीक्षा"), sub: tracked ? t("Wave 1 vs wave 2 — see Results", "लहर 1 बनाम 2 — नतीजे देखें") : t("Did it work?", "क्या असर हुआ?") },
  ];
}
