// One school, in tabs so nothing is buried: how it is doing, what to do, who is who, and what happened.
import { ArrowLeft, ArrowRight, BookOpen, ClipboardList, Footprints, History, Info, LineChart, MapPin, Mic, PhoneCall, Quote, Stethoscope, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AuditTrail } from "../components/Audit";
import { ActionRow, FollowUpForm, SpotCheckForm, VoiceNote } from "../components/field";
import { PhotoCheck, VisitInviteButton, WhatsAppSend } from "../components/insights";
import { InviteForSchool } from "../components/Invite";
import { Card, Empty, PageHeader, Segmented, StatusChip, useAgo } from "../components/kit";
import { AgainstSimilar, ClassSubjectGrid, SubjectTrends } from "../components/SchoolCharts";
import { SchoolPeople } from "../components/SchoolPeople";
import { SatThumb } from "../components/SchoolMapCard";
import { cx } from "../components/ui";
import { distanceKm } from "../engine/block";
import { nearest } from "../engine/geo";
import { PRACTICES } from "../engine/practices";
import { blockScore, schoolOverall, SUBJECTS } from "../engine/subjects";
import type { School } from "../engine/types";
import { usePoll } from "../lib/api";
import { METHOD_WORDS } from "../lib/methods";
import { usePrefs, useT } from "../lib/prefs";
import { useRole } from "../lib/role";
import { schoolStatuses, STATUS_INFO } from "../lib/status";
import { usePipeline } from "../lib/store";

interface PilotRow {
  id: string;
  school_id: string | null;
  status: "invited" | "in_progress" | "completed" | "declined";
  created_at: string;
}

type Tab = "how" | "act" | "people" | "history";

export default function SchoolPage() {
  const { id = "" } = useParams();
  const t = useT();
  const nav = useNavigate();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const [role] = useRole();
  const [params, setParams] = useSearchParams();
  const { state, followUps, refreshLive, blockKey, tracked } = usePipeline();
  const status = useMemo(() => schoolStatuses(state), [state]);
  const [pilot, , reloadPilot] = usePoll<PilotRow[]>("/api/interviews", 10000);
  const [recheck, setRecheck] = useState(false);
  const tab = ((params.get("tab") as Tab | null) ?? (role?.kind === "head" ? "act" : "how")) as Tab;
  const setTab = (x: Tab) => {
    params.set("tab", x);
    setParams(params, { replace: true });
  };
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
  const rec = state.recs.find((r) => r.schoolId === s.id);
  const demo = rec ? state.block.schools.find((x) => x.id === rec.demonstratorId) : undefined;
  const learners = state.recs.filter((r) => r.demonstratorId === s.id);
  const interview = state.interviews.find((i) => i.schoolId === s.id);
  const live = pilot?.filter((p) => p.school_id === s.id) ?? [];
  const follow = followUps.find((f) => f.schoolId === s.id) ?? state.track?.followUps.find((f) => f.schoolId === s.id);
  const group = st === "bright" ? "bright" : state.comparison.includes(s.id) ? "comparison" : "live";
  const kind = !s.classTo || s.classTo <= 5 ? t("Government primary school", "शासकीय प्राथमिक शाला") : s.classTo <= 8 ? t("Government middle school", "शासकीय माध्यमिक शाला") : t("Government school", "शासकीय शाला");

  return (
    <div>
      <button className={cx("mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-ink-2)] hover:text-[var(--color-ink)]", hi)} onClick={() => (history.length > 1 ? nav(-1) : nav("/schools"))}>
        <ArrowLeft size={15} /> {t("Back", "वापस")}
      </button>
      <PageHeader
        eyebrow={`${state.block.name} · ${s.clusterName} ${t("cluster", "क्लस्टर")}`}
        title={lang === "hi" && s.nameHi ? s.nameHi : s.name}
        sub={`${kind} · ${t("classes 1 to 5 shown", "कक्षा 1 से 5")}${s.udise ? ` · UDISE ${s.udise}` : ""}`}
        actions={<StatusChip status={st} />}
      />

      <div className="no-scrollbar -mx-1 mb-4 overflow-x-auto px-1">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "how", label: (<><LineChart size={15} /> {t("How it's doing", "कैसा चल रहा है")}</>) },
            { value: "act", label: (<><ClipboardList size={15} /> {t("What to do", "क्या करें")}</>) },
            { value: "people", label: (<><Users size={15} /> {t("People", "लोग")}</>) },
            { value: "history", label: (<><History size={15} /> {t("History", "इतिहास")}</>) },
          ]}
        />
      </div>

      {tab === "how" && (
        <div className="space-y-5">
          <NextStrip school={s} onGo={() => setTab("act")} />
          <Numbers school={s} />
          <Card title={t("Classes and subjects", "कक्षाएँ और विषय")} icon={BookOpen}>
            <ClassSubjectGrid school={s} schools={state.block.schools} />
          </Card>
          <Card title={t("Three years, across classes 1 to 5", "तीन साल, कक्षा 1 से 5")} icon={LineChart}>
            <SubjectTrends school={s} />
          </Card>
          <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
            <Card title={t("Class 3 against similar schools", "कक्षा 3, वैसे ही दूसरे स्कूलों के मुक़ाबले")} icon={Users}>
              <AgainstSimilar school={s} expected={state.find.expected[s.id]} />
              <p className={cx("mt-3 text-xs text-[var(--color-ink-3)]", hi)}>
                {t("The bar is this school's reported result. The mark is what schools in a similar situation usually reach: same size, attendance, shared classrooms and home language.", "पट्टी इस स्कूल का दर्ज नतीजा है। निशान बताता है ऐसे ही हालात वाले स्कूल आमतौर पर कहाँ पहुँचते हैं: वही आकार, उपस्थिति, साझा कक्षाएँ और घर की भाषा।")}
              </p>
            </Card>
            {s.lat != null && s.lon != null && <WhereCard school={s} />}
          </div>
        </div>
      )}

      {tab === "act" && (
        <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
          <div className="space-y-5">
            <section className="card relative overflow-hidden p-4 md:p-6" data-tour="school-next">
              <span className="absolute inset-y-4 left-0 w-1 rounded-r-full" style={{ background: STATUS_INFO[st].color }} aria-hidden />
              <div className={cx("label mb-1", hi)}>{t("Next step", "अगला कदम")}</div>
              <div className={cx("text-lg font-semibold", hi)}>{t(...STATUS_INFO[st].next)}</div>
              <div className="mt-3">
                {st === "check_due" && <SpotCheckForm school={s} />}
                {st === "bright" && !interview && <InviteForSchool school={s} group="bright" onCreated={() => (reloadPilot(), refreshLive())} />}
                {st === "bright" && interview && (
                  <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>
                    {t(`Conversation done. ${new Set(interview.mentions.map((m) => m.practice)).size} methods described, now helping ${learners.length} school${learners.length === 1 ? "" : "s"}.`, `बातचीत हो चुकी। ${new Set(interview.mentions.map((m) => m.practice)).size} तरीके बताए, अब ${learners.length} स्कूलों की मदद कर रहे हैं।`)}
                  </p>
                )}
                {st === "check_data" && <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>{t("The visit found far fewer children reading or doing the sum than the school reported. This is a reason to go back and talk respectfully, not a judgement. Record a new visit afterwards.", "दौरे में स्कूल के दर्ज नतीजों से बहुत कम बच्चे पढ़ या सवाल कर पाए। यह सम्मान से लौटकर बात करने का कारण है, कोई फ़ैसला नहीं। बाद में नया दौरा दर्ज करें।")}</p>}
                {st === "support" && rec && demo && <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>{t(`Share “${PRACTICES[rec.practice].label}” from ${demo.teacher}, ${rec.distanceKm} km away.`, `${demo.teacher} (${rec.distanceKm} किमी दूर) का “${PRACTICES[rec.practice].labelHi}” पहुँचाएँ।`)}</p>}
                {st === "ok" && <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>{t("Results are close to what similar schools reach. Nothing needs doing right now.", "नतीजे वैसे ही दूसरे स्कूलों के करीब हैं। अभी कुछ करने की ज़रूरत नहीं।")}</p>}
                {st === "revisit" && <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>{t("The visit matched, but yearly results move a lot. Ask the teacher what changed: a new teacher, a new routine, or a data slip.", "दौरा मेल खाया, पर सालाना नतीजे बहुत बदलते हैं। शिक्षक से पूछें क्या बदला: नया शिक्षक, नया तरीका या डेटा की चूक।")}</p>}
              </div>
            </section>

            {rec && demo && (
              <Card title={t("The method for this school", "इस स्कूल के लिए तरीका")} icon={Footprints} right={<span className={cx("chip", hi)}>{rec.wave === 1 ? t("This term", "इस सत्र") : t("Next term", "अगले सत्र")}</span>}>
                <div className={cx("text-lg font-semibold", hi)}>{lang === "hi" ? PRACTICES[rec.practice].labelHi : PRACTICES[rec.practice].label}</div>
                <p className={cx("mt-1 text-[15px] text-[var(--color-ink-2)]", hi)}>{t(...METHOD_WORDS[rec.practice].plain)}</p>
                <div className={cx("mt-3 flex items-center justify-between gap-2 text-sm", hi)}>
                  <span>
                    {t("Learn from", "किससे सीखें")}:{" "}
                    <Link to={`/schools/${demo.id}`} className="font-semibold text-[var(--st-bright)] hover:underline">
                      {demo.teacher}, {lang === "hi" && demo.nameHi ? demo.nameHi : demo.name}
                    </Link>
                  </span>
                  <span className="chip shrink-0">{rec.distanceKm} km</span>
                </div>
                <div className="mt-3">
                  <VoiceNote rec={rec} school={s} demo={demo} />
                </div>
                <div className="mt-3">
                  <VisitInviteButton blockKey={blockKey} schoolId={s.id} tracked={tracked} />
                </div>
                <div className="mt-4 space-y-2">
                  <div className={cx("label", hi)}>{t("Tasks", "काम")}</div>
                  {rec.actions.map((a) => (
                    <ActionRow key={a.id} action={a} compact />
                  ))}
                </div>
              </Card>
            )}

            {rec && rec.wave === 1 && (
              <Card title={t("Follow-up call, two weeks after the visit", "दौरे के दो हफ़्ते बाद फ़ॉलो-अप कॉल")} icon={PhoneCall}>
                {follow ? (
                  <div className="mb-3 text-sm">
                    <span className={cx("chip mr-2", hi)}>{{ adopted: t("Doing it regularly", "नियमित कर रहे हैं"), trying: t("Trying it", "आज़मा रहे हैं"), barrier: t("Something is in the way", "रुकावट"), no_answer: t("No answer", "जवाब नहीं") }[follow.outcome]}</span>
                    {follow.said && <span className="font-deva">“{follow.said}”</span>}
                  </div>
                ) : (
                  <p className={cx("mb-3 text-sm text-[var(--color-ink-2)]", hi)}>{t("Jugnu calls the teacher: “Did you try it? What happened?” If you called yourself, record it here.", "जुगनू शिक्षक को फ़ोन करता है: “क्या आपने आज़माया? क्या हुआ?” अगर आपने खुद बात की, यहाँ दर्ज करें।")}</p>
                )}
                <FollowUpForm school={s} practice={PRACTICES[rec.practice].label} />
                <div className="mt-3 border-t border-[var(--line)] pt-3">
                  <WhatsAppSend blockKey={blockKey} schoolId={s.id} teacher={s.teacher} practice={rec.practice} />
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-5">
            <VisitCard school={s} recheck={recheck} setRecheck={setRecheck} />
            {state.verify.some((v) => v.schoolId === s.id) && <PhotoCheck schoolId={s.id} blockKey={blockKey} practices={state.evidence.filter((e) => e.verdict === "distinctive").map((e) => e.practice)} />}
            {(interview || live.length > 0) && (
              <Card title={t("What the teacher told us", "शिक्षक ने क्या बताया")} icon={Mic}>
                {interview && (
                  <ul className="space-y-2">
                    {interview.mentions.slice(0, 5).map((m, i) => (
                      <li key={i} className="card-inset flex gap-2 p-3 text-sm">
                        <Quote size={14} className="mt-0.5 shrink-0 text-[var(--st-bright)]" />
                        <div>
                          <div className="font-deva">{m.quote}</div>
                          <div className={cx("mt-1 text-xs text-[var(--color-ink-3)]", hi)}>{lang === "hi" ? PRACTICES[m.practice].labelHi : PRACTICES[m.practice].label}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
            {learners.length > 0 && (
              <Card title={t(`${learners.length} schools learn from ${s.teacher.split(" ")[0]}`, `${learners.length} स्कूल ${s.teacher.split(" ")[0]} से सीखते हैं`)} icon={Users}>
                <ul className="space-y-1.5">
                  {learners.slice(0, 8).map((r) => {
                    const ls = state.block.schools.find((x) => x.id === r.schoolId)!;
                    return (
                      <li key={r.schoolId}>
                        <Link to={`/schools/${ls.id}`} className="card-inset flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-[var(--hover)]">
                          <span className="min-w-0 truncate font-medium">{lang === "hi" && ls.nameHi ? ls.nameHi : ls.name}</span>
                          <span className="chip shrink-0">{distanceKm(s, ls)} km</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "people" && <SchoolPeople school={s} group={group} />}

      {tab === "history" && <AuditTrail schoolId={s.id} />}
    </div>
  );
}

function NextStrip({ school: s, onGo }: { school: School; onGo: () => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const { state } = usePipeline();
  const st = schoolStatuses(state).get(s.id)!;
  return (
    <button className="card card-hover flex w-full items-center gap-3 p-4 text-left" onClick={onGo}>
      <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: STATUS_INFO[st].color }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cx("block text-xs text-[var(--color-ink-3)]", hi)}>{t("Next step", "अगला कदम")}</span>
        <span className={cx("block font-semibold", hi)}>{t(...STATUS_INFO[st].next)}</span>
      </span>
      <ArrowRight size={17} className="shrink-0 text-[var(--color-ink-3)]" />
    </button>
  );
}

function Numbers({ school: s }: { school: School }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const { state } = usePipeline();
  const overall = schoolOverall(s);
  const blockVals = SUBJECTS.map((x) => blockScore(state.block.schools, x)).filter((x): x is number => x != null);
  const block = blockVals.length ? blockVals.reduce((a, b) => a + b, 0) / blockVals.length : null;
  const att = s.attendanceByCycle.at(-1) ?? s.attendance;
  const items: [string, string | number, string][] = [
    [t("Children in classes 1 to 5", "कक्षा 1 से 5 के बच्चे"), s.enrolment, t(`About ${Math.round(s.enrolment * att)} come on a normal day`, `सामान्य दिन करीब ${Math.round(s.enrolment * att)} आते हैं`)],
    [t("Coming to school", "स्कूल आ रहे"), `${Math.round(att * 100)}%`, t("Of children enrolled", "दर्ज बच्चों में से")],
    [t("At their class level", "अपनी कक्षा के स्तर पर"), overall == null ? "—" : `${Math.round(overall)}%`, block == null ? "" : t(`Block average ${Math.round(block)}%`, `ब्लॉक औसत ${Math.round(block)}%`)],
    [t("Teachers for these classes", "इन कक्षाओं के शिक्षक"), s.teacherCount, s.multigrade ? t("Some classes share a room", "कुछ कक्षाएँ एक कमरे में") : t("Each class has its own", "हर कक्षा अलग")],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(([k, v, sub]) => (
        <div key={k} className="card p-4">
          <dt className={cx("text-[13px] text-[var(--color-ink-2)]", hi)}>{k}</dt>
          <dd className="mt-1 font-display text-[1.7rem] font-bold leading-none tabular-nums">{v}</dd>
          <dd className={cx("mt-1.5 text-xs text-[var(--color-ink-3)]", hi)}>{sub}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The visit that confirms a school's results: what it is, and what it found. */
function VisitCard({ school: s, recheck, setRecheck }: { school: School; recheck: boolean; setRecheck: (v: boolean) => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const ago = useAgo();
  const { state, spotChecks } = usePipeline();
  const v = state.verify.find((x) => x.schoolId === s.id);
  const st = schoolStatuses(state).get(s.id)!;
  if (!v) return null;
  const sc = v.spotCheck;
  const recorded = spotChecks[s.id];
  return (
    <Card title={t("Confirmation visit", "पुष्टि दौरा")} icon={Stethoscope}>
      <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>{t("Someone from outside the school visits and tests 15 children, to confirm its reported results are real.", "स्कूल के बाहर से कोई जाकर 15 बच्चों को परखता है, ताकि पता चले कि दर्ज नतीजे सच्चे हैं।")}</p>
      {sc.sampled > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="card-inset p-3">
            <dt className={cx("text-xs text-[var(--color-ink-3)]", hi)}>{t("Read the paragraph", "अनुच्छेद पढ़ा")}</dt>
            <dd className="font-semibold tabular-nums">{sc.proficient} / {sc.sampled}</dd>
            <dd className={cx("text-xs text-[var(--color-ink-3)]", hi)}>{t(`School reported ${Math.round(sc.reported)}%`, `स्कूल ने ${Math.round(sc.reported)}% बताया`)}</dd>
          </div>
          <div className="card-inset p-3">
            <dt className={cx("text-xs text-[var(--color-ink-3)]", hi)}>{t("Did the sum", "सवाल किया")}</dt>
            <dd className="font-semibold tabular-nums">{sc.numeracyProficient} / {sc.sampled}</dd>
            <dd className={cx("text-xs text-[var(--color-ink-3)]", hi)}>{t(`School reported ${Math.round(sc.numeracyReported)}%`, `स्कूल ने ${Math.round(sc.numeracyReported)}% बताया`)}</dd>
          </div>
        </dl>
      ) : (
        <p className={cx("mt-2 text-sm font-medium", hi)}>{t("Not visited yet.", "अभी दौरा नहीं हुआ।")}</p>
      )}
      {recorded && <p className={cx("mt-2 text-xs text-[var(--color-ink-3)]", hi)}>{t(`Recorded by ${recorded.by ?? "a coordinator"}, ${ago(recorded.at)}.`, `${recorded.by ?? "समन्वयक"} ने दर्ज किया, ${ago(recorded.at)}।`)}</p>}
      {st !== "check_due" && (
        <div className="mt-3 border-t border-[var(--line)] pt-3">
          {recheck ? (
            <SpotCheckForm school={s} onSaved={() => setRecheck(false)} />
          ) : (
            <button className={cx("btn btn-glass !py-1.5 text-sm", hi)} onClick={() => setRecheck(true)}>
              <Stethoscope size={14} /> {t("Record a new visit", "नया दौरा दर्ज करें")}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

/** Where the school is: from above, and how far the nearest school doing well is. */
function WhereCard({ school: s }: { school: School }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const { state } = usePipeline();
  const status = useMemo(() => schoolStatuses(state), [state]);
  const near = useMemo(() => nearest(s, state.block.schools.filter((x) => status.get(x.id) === "bright")), [s, state.block, status]);
  return (
    <Card title={t("Where it is", "कहाँ है")} icon={MapPin} pad={false}>
      <SatThumb lat={s.lat!} lon={s.lon!} className="h-40 w-full" />
      <div className="space-y-2 p-4 text-sm">
        {near && status.get(s.id) !== "bright" && (
          <div className={cx(hi)}>
            {t("Nearest school doing well", "सबसे पास का अच्छा स्कूल")}:{" "}
            <Link to={`/schools/${near.school.id}`} className="font-semibold underline decoration-[rgb(var(--fg)/0.25)]">
              {lang === "hi" && near.school.nameHi ? near.school.nameHi : near.school.name}
            </Link>{" "}
            <span className="text-[var(--color-ink-3)]">· ~{near.trip.roadKm} km {t("by road", "सड़क से")} · ~{near.trip.minutes} min</span>
          </div>
        )}
        <Link to={`/schools?focus=${s.id}`} className={cx("btn btn-glass w-full justify-center", hi)}>
          <MapPin size={15} /> {t("Show on the map", "नक्शे पर दिखाएँ")}
        </Link>
      </div>
    </Card>
  );
}
