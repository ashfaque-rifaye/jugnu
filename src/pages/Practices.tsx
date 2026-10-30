// Methods that work: written for a teacher. What it is, what it does for children, how to start
// tomorrow, and a colleague's own words. The numbers are plain counts from this block.
import { ArrowRight, ChevronDown, Coins, FileCheck2, GraduationCap, Loader2, Quote, Sparkles, Stars, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, Empty, PageHeader, Meter } from "../components/kit";
import { cx } from "../components/ui";
import { PRACTICES } from "../engine/practices";
import { schoolOverall } from "../engine/subjects";
import type { PracticeEvidence } from "../engine/types";
import { postJSON, usePoll } from "../lib/api";
import { METHOD_WORDS } from "../lib/methods";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";

interface ReviewItem {
  id: string;
  kind: string;
  ref: string | null;
  status: "pending" | "approved" | "rejected";
}

export default function PracticesPage() {
  const t = useT();
  const { lang } = usePrefs();
  const { state, live } = usePipeline();
  const [showRest, setShowRest] = useState(false);
  const [reviews, , reload] = usePoll<ReviewItem[]>("/api/reviews?status=all", 15000);
  const distinctive = state.evidence.filter((e) => e.verdict === "distinctive");
  const rest = state.evidence.filter((e) => e.verdict !== "distinctive");
  const newOnes = live.flatMap((r) => r.codings.filter((c) => !c.practice && c.new_name).map((c) => ({ ...c, school: r.school_id })));
  const hi = lang === "hi" && "font-deva";

  return (
    <div>
      <PageHeader
        title={t("Methods that work", "जो तरीके काम करते हैं")}
        sub={t(
          `Simple things teachers in ${state.block.name} already do that help children learn more. We asked teachers what they do, and kept only what teachers at schools doing well do and others don't.`,
          `${state.block.name} के शिक्षक पहले से जो सरल काम करते हैं और जिनसे बच्चे ज़्यादा सीखते हैं। हमने शिक्षकों से पूछा कि वे क्या करते हैं, और वही रखा जो अच्छा कर रहे स्कूलों के शिक्षक करते हैं और बाकी नहीं।`,
        )}
      />

      {!state.interviews.length ? (
        <Empty icon={Stars} title={t("No conversations yet", "अभी कोई बातचीत नहीं")}>
          {t("Talk to teachers at schools doing well first. Open such a school from the Schools page and invite the teacher.", "पहले अच्छा कर रहे स्कूलों के शिक्षकों से बात करें। 'स्कूल' पेज से ऐसा स्कूल खोलकर शिक्षक को आमंत्रित करें।")}
        </Empty>
      ) : (
        <div className="space-y-5">
          {distinctive.map((e) => (
            <MethodCard key={e.practice} e={e} cardStatus={reviews?.find((r) => r.kind === "practice_card" && r.ref === e.practice && r.status === "approved")?.status ?? reviews?.find((r) => r.kind === "practice_card" && r.ref === e.practice)?.status} onDrafted={reload} />
          ))}
        </div>
      )}

      {newOnes.length > 0 && (
        <Card className="mt-5" title={t("New ideas teachers mentioned", "शिक्षकों के बताए नए विचार")} icon={Sparkles}>
          <p className={cx("mb-3 text-sm text-[var(--color-ink-2)]", hi)}>{t("Not yet checked against other schools. Worth a closer look on the next visit.", "अभी दूसरे स्कूलों से नहीं जाँचे। अगली बार ध्यान से देखने लायक।")}</p>
          <ul className="space-y-2">
            {newOnes.map((n, i) => (
              <li key={i} className="card-inset p-3 text-sm">
                <div className="font-semibold">{n.new_name}</div>
                <div className="font-deva text-[var(--color-ink-2)]">“{n.quote}”</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {rest.length > 0 && (
        <Card className="mt-5">
          <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setShowRest((v) => !v)} aria-expanded={showRest}>
            <span>
              <span className={cx("block font-semibold", hi)}>{t(`${rest.length} things that did not make a difference`, `${rest.length} बातें जिनसे फ़र्क नहीं पड़ा`)}</span>
              <span className={cx("block text-sm text-[var(--color-ink-2)]", hi)}>{t("Schools doing well and other schools do these about equally, or too few teachers mentioned them.", "अच्छा कर रहे और बाकी स्कूल इन्हें लगभग बराबर करते हैं, या बहुत कम शिक्षकों ने बताया।")}</span>
            </span>
            <ChevronDown size={18} className={cx("shrink-0 transition", showRest && "rotate-180")} />
          </button>
          {showRest && (
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {rest.map((e) => (
                <li key={e.practice} className="card-inset p-3 text-sm">
                  <div className={cx("font-medium", hi)}>{lang === "hi" ? PRACTICES[e.practice].labelHi : PRACTICES[e.practice].label}</div>
                  <div className={cx("text-xs text-[var(--color-ink-2)]", hi)}>{t(`${e.bright.k} of ${e.bright.n} at schools doing well, ${e.comparison.k} of ${e.comparison.n} at similar schools`, `अच्छे स्कूलों में ${e.bright.n} में ${e.bright.k}, वैसे ही दूसरे स्कूलों में ${e.comparison.n} में ${e.comparison.k}`)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

/** A row of people, filled for those who do it: easier to read at a glance than a percentage. */
function People({ k, n, color }: { k: number; n: number; color: string }) {
  return (
    <span className="flex flex-wrap gap-1" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="h-3.5 w-3.5 rounded-full" style={i < k ? { background: color } : { boxShadow: "inset 0 0 0 1.5px rgb(var(--fg) / 0.25)" }} />
      ))}
    </span>
  );
}

function MethodCard({ e, cardStatus, onDrafted }: { e: PracticeEvidence; cardStatus?: ReviewItem["status"]; onDrafted: () => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const { state } = usePipeline();
  const p = PRACTICES[e.practice];
  const words = METHOD_WORDS[e.practice];
  const school = (id: string) => state.block.schools.find((s) => s.id === id);
  const [busy, setBusy] = useState(false);
  const going = state.recs.filter((r) => r.practice === e.practice);
  const scores = useMemo(() => {
    const avg = (ids: string[]) => {
      const v = ids.map((id) => schoolOverall(school(id)!)).filter((x): x is number => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const users = state.interviews.filter((i) => i.group === "bright" && i.mentions.some((m) => m.practice === e.practice && m.specificity >= 2)).map((i) => i.schoolId);
    return { users: avg(users), similar: avg(state.interviews.filter((i) => i.group === "comparison").map((i) => i.schoolId)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, e.practice]);
  const draft = async () => {
    setBusy(true);
    await postJSON("/api/reviews/card", { practice: e.practice, quotes: e.quotes.map((q) => ({ school: `${school(q.schoolId)?.teacher ?? ""}, ${school(q.schoolId)?.village ?? ""}`, quote: q.quote })) }).catch(() => null);
    setBusy(false);
    onDrafted();
  };
  const q = e.quotes[0];
  const qs = q && school(q.schoolId);
  return (
    <section className="card overflow-hidden" data-reveal>
      <div className="grid lg:grid-cols-[1.1fr_1fr]">
        <div className="p-5 md:p-7">
          <h2 className={cx("text-[1.6rem] font-semibold leading-tight tracking-[-0.02em]", hi)}>{lang === "hi" ? p.labelHi : p.label}</h2>
          <p className={cx("mt-2 text-[16px] leading-relaxed", hi)}>{t(...words.plain)}</p>
          <div className={cx("mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-[var(--color-ink-2)]", hi)}>
            <span className="flex items-center gap-1.5"><Coins size={14} aria-hidden /> {t(...words.needs)}</span>
            <span className="flex items-center gap-1.5"><GraduationCap size={14} aria-hidden /> {words.classes.length === 5 ? t("Classes 1 to 5", "कक्षा 1 से 5") : t(`Classes ${words.classes.join(", ")}`, `कक्षा ${words.classes.join(", ")}`)}</span>
          </div>

          <h3 className={cx("mt-5 font-semibold", hi)}>{t("How to start tomorrow", "कल से कैसे शुरू करें")}</h3>
          <ol className="mt-2 space-y-2.5">
            {words.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--chip)] text-xs font-bold">{i + 1}</span>
                <span className={cx("text-[15px] leading-relaxed", hi)}>{t(...s)}</span>
              </li>
            ))}
          </ol>
          <p className={cx("mt-3 text-[15px] leading-relaxed text-[var(--color-ink-2)]", hi)}>
            <b className="font-semibold text-[var(--color-ink)]">{t("For children: ", "बच्चों के लिए: ")}</b>
            {t(...words.children)}
          </p>
        </div>

        <div className="border-t border-[var(--line)] bg-[var(--inset-bg)] p-5 md:p-7 lg:border-l lg:border-t-0">
          <h3 className={cx("font-semibold", hi)}>{t("What we found in this block", "इस ब्लॉक में क्या पाया")}</h3>
          <div className="mt-3 space-y-3">
            <div>
              <div className={cx("mb-1.5 flex items-baseline justify-between gap-3 text-sm", hi)}>
                <span>{t("Teachers at schools doing well who do this", "अच्छा कर रहे स्कूलों के शिक्षक जो यह करते हैं")}</span>
                <b className="shrink-0 tabular-nums">{e.bright.k} / {e.bright.n}</b>
              </div>
              <People k={e.bright.k} n={e.bright.n} color="var(--st-bright)" />
            </div>
            <div>
              <div className={cx("mb-1.5 flex items-baseline justify-between gap-3 text-sm", hi)}>
                <span>{t("Teachers at similar schools who do this", "वैसे ही दूसरे स्कूलों के शिक्षक जो यह करते हैं")}</span>
                <b className="shrink-0 tabular-nums">{e.comparison.k} / {e.comparison.n}</b>
              </div>
              <People k={e.comparison.k} n={e.comparison.n} color="var(--tone-muted)" />
            </div>
            {scores.users != null && scores.similar != null && (
              <div className="pt-1">
                <div className={cx("mb-1.5 text-sm", hi)}>{t("Children at their class level", "अपनी कक्षा के स्तर पर बच्चे")}</div>
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs text-[var(--color-ink-2)]">
                  <span className={cx(hi)}>{t("Schools that do this", "जो स्कूल यह करते हैं")}</span>
                  <b className="tabular-nums text-[var(--color-ink)]">{Math.round(scores.users)}%</b>
                  <Meter className="col-span-2" value={scores.users / 100} height={8} color="var(--st-bright)" />
                  <span className={cx("mt-1", hi)}>{t("Similar schools", "वैसे ही दूसरे स्कूल")}</span>
                  <b className="mt-1 tabular-nums text-[var(--color-ink)]">{Math.round(scores.similar)}%</b>
                  <Meter className="col-span-2" value={scores.similar / 100} height={8} color="var(--tone-muted)" />
                </div>
              </div>
            )}
          </div>

          {q && qs && (
            <figure className="mt-5 border-t border-[var(--line)] pt-4">
              <Quote size={15} className="text-[var(--st-bright)]" aria-hidden />
              <blockquote className="mt-1 font-deva text-[15px] leading-relaxed">{q.quote}</blockquote>
              <figcaption className="mt-1 text-xs text-[var(--color-ink-2)]">
                <Link to={`/schools/${qs.id}`} className="tap-link hover:underline">
                  {qs.teacher}, {lang === "hi" && qs.nameHi ? qs.nameHi : qs.name}
                </Link>
              </figcaption>
            </figure>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
            {cardStatus === "approved" ? (
              <Link to={`/plan?method=${e.practice}`} className={cx("btn btn-primary", hi)}>
                <Users size={15} /> {t(`Going to ${going.length} schools`, `${going.length} स्कूलों तक जा रहा है`)} <ArrowRight size={15} />
              </Link>
            ) : cardStatus === "pending" ? (
              <Link className={cx("btn btn-glass", hi)} to="/review">
                {t("Card is waiting for approval", "कार्ड मंज़ूरी का इंतज़ार कर रहा है")} <ArrowRight size={15} />
              </Link>
            ) : (
              e.quotes.length > 0 && (
                <button className={cx("btn btn-primary", hi)} onClick={draft} disabled={busy}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <FileCheck2 size={15} />} {t("Make a one-page card to share", "बाँटने के लिए एक पेज का कार्ड बनाएँ")}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
