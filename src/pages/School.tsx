import { ArrowLeft, BadgeCheck, BookOpen, Check, ClipboardList, Footprints, History, Info, Mic, PhoneCall, Quote, Stethoscope, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ActionRow, FollowUpForm, SpotCheckForm, VoiceNote } from "../components/field";
import { InviteForSchool } from "../components/Invite";
import { Card, Empty, PageHeader, StatusChip, useAgo } from "../components/kit";
import { cx } from "../components/ui";
import { distanceKm } from "../engine/block";
import { PRACTICES } from "../engine/practices";
import { CYCLES, type School } from "../engine/types";
import { usePoll } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";
import { schoolStatuses, STATUS_INFO } from "../lib/status";
import { ActivityFeed } from "./Today";

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
  const { state, events, spotChecks, followUps, refreshLive } = usePipeline();
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

  return (
    <div>
      <button className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-ink-2)] hover:text-white" onClick={() => (history.length > 1 ? nav(-1) : nav("/schools"))}>
        <ArrowLeft size={15} /> {t("Back", "वापस")}
      </button>
      <PageHeader
        eyebrow={`${s.clusterName} ${t("cluster", "क्लस्टर")} · CRP ${s.crp}`}
        title={s.name}
        sub={`${s.teacher} · ${s.village} · ${s.enrolment} ${t("children", "बच्चे")}`}
        actions={<StatusChip status={st} />}
      />

      {/* what to do next */}
      <section className="card mb-5 border-l-4 p-4 md:p-5" style={{ borderLeftColor: STATUS_INFO[st].color }}>
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
                      <span className="chip text-[11px]">
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
          <text x={28} y={y(g) + 4} textAnchor="end" className="fill-white/40 text-[10px]">
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
                  <text x={x + bw / 2} y={y(v) - 5} textAnchor="middle" className="fill-white/80 text-[10px] font-semibold">
                    {Math.round(v)}
                  </text>
                </g>
              );
            })}
            <text x={x0 + bw + 3} y={H - 8} textAnchor="middle" className="fill-white/55 text-[11px]">
              {c}
            </text>
          </g>
        );
      })}
      {groups.map((g, j) => (
        <g key={g.key} transform={`translate(${W - 170 + j * 80}, 8)`}>
          <rect width={10} height={10} rx={2} fill={g.color} />
          <text x={15} y={9} className="fill-white/70 text-[11px]">
            {g.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
