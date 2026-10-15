import { Eye, EyeOff, FlaskConical, LineChart, PhoneCall } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EffectBars } from "../components/charts";
import { FollowUpForm } from "../components/field";
import { Card, PageHeader, Segmented, Stat } from "../components/kit";
import { cx } from "../components/ui";
import { PRACTICES } from "../engine/practices";
import { NEXT_CYCLE, type FollowUp } from "../engine/types";
import { usePrefs, useT } from "../lib/prefs";
import { inMyPatch, useRole } from "../lib/role";
import { usePipeline } from "../lib/store";

const OUTCOME: Record<FollowUp["outcome"], { en: string; hi: string; color: string }> = {
  adopted: { en: "Doing it regularly", hi: "नियमित कर रहे हैं", color: "#4ade80" },
  trying: { en: "Trying it", hi: "आज़मा रहे हैं", color: "#facc15" },
  barrier: { en: "Something is in the way", hi: "रुकावट", color: "#f87171" },
  no_answer: { en: "No answer yet", hi: "जवाब नहीं", color: "#9ca3af" },
};

export default function ResultsPage() {
  const t = useT();
  const { lang } = usePrefs();
  const [role] = useRole();
  const { state, runTrack, followUps } = usePipeline();
  const [reveal, setReveal] = useState(false);
  const [filter, setFilter] = useState<"all" | "todo" | FollowUp["outcome"]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const byId = useMemo(() => new Map(state.block.schools.map((s) => [s.id, s])), [state.block]);
  const wave1 = state.recs.filter((r) => r.wave === 1 && inMyPatch(role, byId.get(r.schoolId)!.cluster));
  const recorded = new Map(followUps.map((f) => [f.schoolId, f]));
  const simulated = new Map((state.track?.followUps ?? []).map((f) => [f.schoolId, f]));
  const rows = wave1.map((r) => ({ r, s: byId.get(r.schoolId)!, f: recorded.get(r.schoolId) ?? simulated.get(r.schoolId) ?? null, mine: recorded.has(r.schoolId) }));
  const shown = rows.filter((x) => filter === "all" || (filter === "todo" ? !x.f : x.f?.outcome === filter));
  const count = (o: FollowUp["outcome"]) => rows.filter((x) => x.f?.outcome === o).length;
  const tr = state.track;
  const hi = lang === "hi" && "font-deva";

  return (
    <div>
      <PageHeader
        title={t("Results", "नतीजे")}
        sub={t(
          `Did teachers try the practice — and did children learn more? Follow-up calls come two weeks after each visit; the learning effect comes from the next assessment (${NEXT_CYCLE}), comparing wave 1 with wave 2.`,
          `क्या शिक्षकों ने तरीका आज़माया — और क्या बच्चों ने ज़्यादा सीखा? हर दौरे के दो हफ़्ते बाद फ़ॉलो-अप कॉल; सीखने का असर अगली परीक्षा (${NEXT_CYCLE}) से, लहर 1 और लहर 2 की तुलना करके।`,
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("Follow-up calls", "फ़ॉलो-अप कॉल")} value={`${rows.filter((x) => x.f).length}/${rows.length}`} hint={t("wave 1 schools", "लहर 1 के स्कूल")} />
        <Stat label={t("Doing it regularly", "नियमित कर रहे")} value={count("adopted")} tone="#4ade80" />
        <Stat label={t("Trying it", "आज़मा रहे")} value={count("trying")} tone="#facc15" />
        <Stat label={t("Stuck — escalated", "अटके — ऊपर भेजे")} value={count("barrier")} tone="#f87171" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Card
          title={t("What teachers said on the follow-up call", "फ़ॉलो-अप कॉल पर शिक्षकों ने क्या कहा")}
          icon={PhoneCall}
          right={
            <Segmented
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
                    <Link to={`/schools/${s.id}`} className="font-semibold hover:underline">
                      {s.teacher} · {s.name}
                    </Link>
                    <div className="text-xs text-[var(--color-ink-3)]">{lang === "hi" ? PRACTICES[r.practice].labelHi : PRACTICES[r.practice].label}</div>
                  </div>
                  {f ? (
                    <span className="chip text-[11px]" style={{ borderColor: `${OUTCOME[f.outcome].color}88`, color: OUTCOME[f.outcome].color }}>
                      {t(OUTCOME[f.outcome].en, OUTCOME[f.outcome].hi)}
                    </span>
                  ) : (
                    <span className="chip text-[11px]">{t("Not called yet", "कॉल बाकी")}</span>
                  )}
                </div>
                {f?.said && <div className="mt-2 font-deva text-sm">“{f.said}”</div>}
                {f && !mine && f.saidEn && <div className="text-xs text-[var(--color-ink-3)]">{f.saidEn}</div>}
                {f && !mine && <div className="mt-1 text-[11px] text-[var(--color-ink-3)]">{t("Simulated call (demo term)", "सिम्युलेटेड कॉल (डेमो सत्र)")}</div>}
                <button className="mt-2 text-sm text-amber-200" onClick={() => setOpen(open === s.id ? null : s.id)}>
                  {open === s.id ? t("Close", "बंद करें") : f ? t("Record a new call", "नई कॉल दर्ज करें") : t("Record the call", "कॉल दर्ज करें")}
                </button>
                {open === s.id && (
                  <div className="mt-3">
                    <FollowUpForm school={s} practice={PRACTICES[r.practice].label} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card
            title={t("Did it work?", "क्या असर हुआ?")}
            icon={LineChart}
            right={
              tr && state.block.truth ? (
                <button className="btn btn-glass !py-1 text-xs" onClick={() => setReveal((v) => !v)}>
                  {reveal ? <Eye size={14} /> : <EyeOff size={14} />} {t("Hidden truth", "छिपा सच")}
                </button>
              ) : undefined
            }
          >
            {!tr ? (
              <div className={cx("space-y-3 text-sm text-[var(--color-ink-2)]", hi)}>
                <p>
                  {t(
                    `This answer comes with the next assessment (${NEXT_CYCLE}). Jugnu compares each wave-1 school's change with wave-2 schools that got the same recommendation but had not started yet — a fair test, not a guess.`,
                    `यह जवाब अगली परीक्षा (${NEXT_CYCLE}) के साथ आता है। जुगनू लहर 1 के हर स्कूल के बदलाव की तुलना लहर 2 के उन स्कूलों से करता है जिन्हें वही सलाह मिली पर उन्होंने अभी शुरू नहीं किया — अनुमान नहीं, सही जाँच।`,
                  )}
                </p>
                {state.block.truth && (
                  <button className="btn btn-primary" onClick={runTrack}>
                    <FlaskConical size={16} /> {t("Simulate one term (demo block)", "एक सत्र चलाकर देखें (डेमो ब्लॉक)")}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <Stat
                    label={t("Overall effect, wave 1 vs 2", "कुल असर, लहर 1 बनाम 2")}
                    value={`${tr.overall.effect > 0 ? "+" : ""}${tr.overall.effect} ${t("pts", "अंक")}`}
                    hint={t(`95% interval ${tr.overall.ci[0]} to ${tr.overall.ci[1]}`, `95% अंतराल ${tr.overall.ci[0]} से ${tr.overall.ci[1]}`)}
                    tone="#7dd3fc"
                  />
                  <Stat
                    label={t("Schools adopting", "अपनाने वाले स्कूल")}
                    value={tr.byPractice.reduce((a, b) => a + b.adopters, 0)}
                    hint={t(`of ${tr.byPractice.reduce((a, b) => a + b.wave1, 0)} in wave 1`, `लहर 1 के ${tr.byPractice.reduce((a, b) => a + b.wave1, 0)} में से`)}
                  />
                </div>
                <EffectBars
                  rows={tr.byPractice.map((b) => ({ label: `${PRACTICES[b.practice].label} (${b.adopters}/${b.wave1})`, effect: b.effect, ci: b.ci, truth: reveal ? b.trueEffect : undefined }))}
                />
                <p className="mt-2 text-xs text-[var(--color-ink-3)]">
                  {t(
                    "Bar = estimated change in Grade 3 proficiency (percentage points, reading and maths averaged); line = 95% interval. One term is an early signal; the next cycle adds certainty.",
                    "पट्टी = कक्षा 3 में अनुमानित बदलाव (प्रतिशत अंक, पढ़ना व गणित का औसत); रेखा = 95% अंतराल। एक सत्र शुरुआती संकेत है; अगला चक्र भरोसा बढ़ाता है।",
                  )}
                </p>
                {reveal && (
                  <p className="mt-1 text-xs text-[var(--color-ink-3)]">{t("Gold tick = the true effect, known only to the simulator.", "सुनहरा निशान = असली असर, जो सिर्फ़ सिम्युलेटर जानता है।")}</p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
