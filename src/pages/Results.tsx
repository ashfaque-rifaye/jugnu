// Check progress: did teachers try the method, did children learn more, and what schools are reporting.
import { ClipboardList, FlaskConical, LineChart, PhoneCall } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FollowUpForm } from "../components/field";
import { Card, Meter, PageHeader, Segmented, Stat } from "../components/kit";
import { cx } from "../components/ui";
import { PRACTICES } from "../engine/practices";
import { NEXT_CYCLE, type FollowUp } from "../engine/types";
import { usePrefs, useT } from "../lib/prefs";
import { isMySchool, useRole } from "../lib/role";
import { weeklyReports } from "../lib/rollout";
import { usePipeline } from "../lib/store";
import { tint } from "../lib/status";

const OUTCOME: Record<FollowUp["outcome"], { en: string; hi: string; color: string }> = {
  adopted: { en: "Doing it regularly", hi: "नियमित कर रहे हैं", color: "var(--tone-good)" },
  trying: { en: "Trying it", hi: "आज़मा रहे हैं", color: "var(--tone-warn)" },
  barrier: { en: "Something is in the way", hi: "रुकावट", color: "var(--tone-bad)" },
  no_answer: { en: "No answer yet", hi: "जवाब नहीं", color: "var(--tone-muted)" },
};

export default function ResultsPage() {
  const t = useT();
  const { lang } = usePrefs();
  const [role] = useRole();
  const { state, runTrack, followUps, events } = usePipeline();
  const [filter, setFilter] = useState<"all" | "todo" | FollowUp["outcome"]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const byId = useMemo(() => new Map(state.block.schools.map((s) => [s.id, s])), [state.block]);
  const wave1 = state.recs.filter((r) => r.wave === 1 && isMySchool(role, r.schoolId, byId.get(r.schoolId)!.cluster));
  const recorded = new Map(followUps.map((f) => [f.schoolId, f]));
  const simulated = new Map((state.track?.followUps ?? []).map((f) => [f.schoolId, f]));
  const rows = wave1.map((r) => ({ r, s: byId.get(r.schoolId)!, f: recorded.get(r.schoolId) ?? simulated.get(r.schoolId) ?? null, mine: recorded.has(r.schoolId) }));
  const shown = rows.filter((x) => filter === "all" || (filter === "todo" ? !x.f : x.f?.outcome === filter));
  const count = (o: FollowUp["outcome"]) => rows.filter((x) => x.f?.outcome === o).length;
  const tr = state.track;
  const hi = lang === "hi" && "font-deva";
  const reports = useMemo(() => weeklyReports(events).all.filter((r) => wave1.some((w) => w.schoolId === r.schoolId)).reverse(), [events, wave1]);

  return (
    <div>
      <PageHeader
        title={t("Check progress", "प्रगति देखें")}
        sub={t(
          `Did teachers try the method, and did children learn more? Calls come two weeks after each visit. The learning result comes with the next assessment (${NEXT_CYCLE}), compared with schools that start next term.`,
          `क्या शिक्षकों ने तरीका आज़माया, और क्या बच्चों ने ज़्यादा सीखा? हर दौरे के दो हफ़्ते बाद कॉल आती है। सीखने का नतीजा अगली जाँच (${NEXT_CYCLE}) के साथ आता है, अगले सत्र शुरू करने वाले स्कूलों से तुलना करके।`,
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("Follow-up calls made", "फ़ॉलो-अप कॉल हुईं")} value={`${rows.filter((x) => x.f).length}/${rows.length}`} hint={t("Schools this term", "इस सत्र के स्कूल")} />
        <Stat label={t("Doing it regularly", "नियमित कर रहे")} value={count("adopted")} tone="var(--tone-good)" />
        <Stat label={t("Trying it", "आज़मा रहे")} value={count("trying")} tone="var(--tone-warn)" />
        <Stat label={t("Stuck", "अटके")} value={count("barrier")} tone="var(--tone-bad)" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Card
          title={t("What teachers said on the call", "कॉल पर शिक्षकों ने क्या कहा")}
          icon={PhoneCall}
          right={
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: t("All", "सभी") },
                { value: "todo", label: t("Not called", "कॉल बाकी"), count: rows.filter((x) => !x.f).length },
                { value: "barrier", label: t("Stuck", "अटके"), count: count("barrier") },
              ]}
            />
          }
        >
          <ul className="space-y-2">
            {shown.map(({ r, s, f, mine }) => (
              <li key={s.id} className="card-inset p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/schools/${s.id}`} className="tap-link font-semibold hover:underline">
                      {s.teacher} · {lang === "hi" && s.nameHi ? s.nameHi : s.name}
                    </Link>
                    <div className={cx("text-xs text-[var(--color-ink-3)]", hi)}>{lang === "hi" ? PRACTICES[r.practice].labelHi : PRACTICES[r.practice].label}</div>
                  </div>
                  {f ? (
                    <span className={cx("chip text-xs", hi)} style={{ borderColor: tint(OUTCOME[f.outcome].color, 55), color: OUTCOME[f.outcome].color }}>
                      {t(OUTCOME[f.outcome].en, OUTCOME[f.outcome].hi)}
                    </span>
                  ) : (
                    <span className={cx("chip text-xs", hi)}>{t("Not called yet", "कॉल बाकी")}</span>
                  )}
                </div>
                {f?.said && <div className="mt-2 font-deva text-sm">“{f.said}”</div>}
                {f && !mine && f.saidEn && lang !== "hi" && <div className="text-xs text-[var(--color-ink-3)]">{f.saidEn}</div>}
                {f && !mine && <div className={cx("mt-1 text-xs text-[var(--color-ink-3)]", hi)}>{t("Sample term", "नमूना सत्र")}</div>}
                <button className={cx("tap-link mt-2 text-sm font-semibold text-[var(--st-bright)]", hi)} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  {open === s.id ? t("Close", "बंद करें") : f ? t("Record a new call", "नई कॉल दर्ज करें") : t("Record the call", "कॉल दर्ज करें")}
                </button>
                {open === s.id && (
                  <div className="mt-3">
                    <FollowUpForm school={s} practice={PRACTICES[r.practice].label} />
                  </div>
                )}
              </li>
            ))}
            {shown.length === 0 && <li className={cx("text-sm text-[var(--color-ink-2)]", hi)}>{t("Nothing here right now.", "अभी यहाँ कुछ नहीं।")}</li>}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card title={t("Did children learn more?", "क्या बच्चों ने ज़्यादा सीखा?")} icon={LineChart}>
            {!tr ? (
              <div className={cx("space-y-3 text-sm text-[var(--color-ink-2)]", hi)}>
                <p>{t(`We will know at the next assessment (${NEXT_CYCLE}). Schools using a method this term are compared with similar schools that start next term, so it is a fair test.`, `यह अगली जाँच (${NEXT_CYCLE}) पर पता चलेगा। इस सत्र तरीका अपनाने वाले स्कूलों की तुलना अगले सत्र शुरू करने वाले वैसे ही स्कूलों से होती है, इसलिए यह सही जाँच है।`)}</p>
                {state.block.truth && (
                  <button className="btn btn-primary" onClick={runTrack}>
                    <FlaskConical size={16} /> {t("See a sample term", "नमूना सत्र देखें")}
                  </button>
                )}
              </div>
            ) : (
              <div className={cx(hi)}>
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <Stat label={t("Change, compared with schools not yet started", "बदलाव, जिन्होंने शुरू नहीं किया उनके मुक़ाबले")} value={`${tr.overall.effect > 0 ? "+" : ""}${tr.overall.effect} ${t("points", "अंक")}`} hint={t(`Likely between ${tr.overall.ci[0]} and ${tr.overall.ci[1]}`, `संभवतः ${tr.overall.ci[0]} से ${tr.overall.ci[1]} के बीच`)} tone="var(--tone-good)" />
                  <Stat label={t("Schools taking it up", "अपनाने वाले स्कूल")} value={tr.byPractice.reduce((a, b) => a + b.adopters, 0)} hint={t(`Of ${tr.byPractice.reduce((a, b) => a + b.wave1, 0)} this term`, `इस सत्र के ${tr.byPractice.reduce((a, b) => a + b.wave1, 0)} में से`)} />
                </div>
                <ul className="space-y-3">
                  {tr.byPractice.map((b) => (
                    <li key={b.practice}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0">{lang === "hi" ? PRACTICES[b.practice].labelHi : PRACTICES[b.practice].label}</span>
                        <b className="shrink-0 tabular-nums">{b.effect > 0 ? "+" : ""}{b.effect}</b>
                      </div>
                      <Meter value={Math.max(0, b.effect) / 25} height={8} color={b.ci[0] > 0 ? "var(--tone-good)" : "var(--tone-muted)"} />
                      <div className="mt-0.5 text-xs text-[var(--color-ink-3)]">{t(`${b.adopters} of ${b.wave1} schools took it up${b.ci[0] <= 0 ? " · too early to be sure" : ""}`, `${b.wave1} में से ${b.adopters} स्कूलों ने अपनाया${b.ci[0] <= 0 ? " · अभी पक्का कहना जल्दी है" : ""}`)}</div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-[var(--color-ink-3)]">{t("Points are the change in class 3 children at their level, Hindi and maths together. This is a sample term in the demo block.", "अंक कक्षा 3 में स्तर पर बच्चों का बदलाव हैं, हिंदी और गणित मिलाकर। यह डेमो ब्लॉक का नमूना सत्र है।")}</p>
              </div>
            )}
          </Card>

          <Card title={t("What schools reported", "स्कूलों ने क्या बताया")} icon={ClipboardList}>
            {reports.length === 0 ? (
              <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>{t("Each school's contact sends a short report once a week. They appear here, from a school's People tab.", "हर स्कूल के संपर्क व्यक्ति हफ़्ते में एक बार छोटी रिपोर्ट भेजते हैं। वे स्कूल के 'लोग' टैब से भेजी जाती हैं और यहाँ दिखती हैं।")}</p>
            ) : (
              <ul className="space-y-2">
                {reports.slice(0, 6).map((r) => (
                  <li key={r.schoolId + r.at} className="card-inset p-3 text-sm">
                    <Link to={`/schools/${r.schoolId}?tab=people`} className="tap-link font-medium hover:underline">
                      {byId.get(r.schoolId)?.name}
                    </Link>
                    <div className={cx("text-xs text-[var(--color-ink-2)]", hi)}>{t(`${r.teachersUsing} teachers, ${r.childrenReached} children, classes ${r.classes.join(", ") || "none yet"}`, `${r.teachersUsing} शिक्षक, ${r.childrenReached} बच्चे, कक्षा ${r.classes.join(", ") || "अभी नहीं"}`)}</div>
                    {r.note && <div className="mt-1 font-deva text-xs italic text-[var(--color-ink-2)]">“{r.note}”</div>}
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
