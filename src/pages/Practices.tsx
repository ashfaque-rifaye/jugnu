import { ChevronDown, Eye, EyeOff, FileCheck2, Loader2, Quote, Sparkles, Stars } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Dumbbell } from "../components/charts";
import { Card, Empty, PageHeader } from "../components/kit";
import { cx } from "../components/ui";
import { EFFECTIVE, PRACTICES } from "../engine/practices";
import type { PracticeEvidence } from "../engine/types";
import { postJSON, usePoll } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";
import { tint } from "../lib/status";

interface ReviewItem {
  id: string;
  kind: string;
  ref: string | null;
  status: "pending" | "approved" | "rejected";
}

export default function PracticesPage() {
  const t = useT();
  const { lang } = usePrefs();
  const { state, evaluation, live } = usePipeline();
  const [reveal, setReveal] = useState(false);
  const [showRest, setShowRest] = useState(false);
  const [reviews, , reload] = usePoll<ReviewItem[]>("/api/reviews?status=all", 15000);
  const distinctive = state.evidence.filter((e) => e.verdict === "distinctive");
  const rest = state.evidence.filter((e) => e.verdict !== "distinctive");
  const newOnes = live.flatMap((r) => r.codings.filter((c) => !c.practice && c.new_name).map((c) => ({ ...c, school: r.school_id })));
  const hi = lang === "hi" && "font-deva";

  return (
    <div>
      <PageHeader
        title={t("What works here", "यहाँ क्या काम करता है")}
        sub={t(
          "Not “best practices” from elsewhere — the routines that bright-spot teachers in this block describe in concrete detail, and that similar ordinary schools don't. Each comes with the teachers' own words.",
          "कहीं और के “सबसे अच्छे तरीके” नहीं — वे रोज़ के तरीके जो इस ब्लॉक के अच्छे स्कूलों के शिक्षक ठोस रूप से बताते हैं, और उन जैसे सामान्य स्कूल नहीं करते। हर तरीके के साथ शिक्षकों के अपने शब्द।",
        )}
        actions={
          state.block.truth ? (
            <button
              className="btn btn-glass"
              onClick={() => setReveal((v) => !v)}
              title={t("Only in the simulated block: compare with the practices that truly work", "सिर्फ़ सिम्युलेटेड ब्लॉक में: असल में काम करने वाले तरीकों से तुलना")}
            >
              {reveal ? <Eye size={16} /> : <EyeOff size={16} />} {t("Check against hidden truth", "छिपे सच से जाँचें")}
            </button>
          ) : undefined
        }
      />

      {reveal && evaluation && (
        <div className="card mb-4 border-dashed p-4 text-sm text-[var(--color-ink-2)]">
          {t("In this simulation the practices that truly help are", "इस सिम्युलेशन में असल में मदद करने वाले तरीके")}: {EFFECTIVE.map((p) => PRACTICES[p].label).join(", ")}.{" "}
          {t("Jugnu found", "जुगनू ने खोजे")}: <b className="text-white">{evaluation.practices.found.map((p) => PRACTICES[p].label).join(", ") || "—"}</b>
          {evaluation.practices.missed.length ? ` · ${t("not yet found", "अभी नहीं मिले")}: ${evaluation.practices.missed.map((p) => PRACTICES[p].label).join(", ")}` : ""} ·{" "}
          {t("decoys wrongly promoted", "गलती से चुने गए नकली तरीके")}: <b className="text-white">{evaluation.practices.falseDistinctive.length || t("none", "कोई नहीं")}</b>
        </div>
      )}

      {!state.interviews.length ? (
        <Empty icon={Stars} title={t("No interviews yet", "अभी कोई बातचीत नहीं")}>
          {t(
            "Interview bright-spot teachers (and similar ordinary schools) first — open a bright spot on the Schools page and press “Invite for interview”.",
            "पहले अच्छे स्कूलों (और उन जैसे सामान्य स्कूलों) के शिक्षकों से बात करें — 'स्कूल' पेज पर अच्छा स्कूल खोलें और “बातचीत के लिए बुलाएँ” दबाएँ।",
          )}
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {distinctive.map((e) => (
            <PracticeCard key={e.practice} e={e} reveal={reveal} cardStatus={reviews?.find((r) => r.kind === "practice_card" && r.ref === e.practice)?.status} onDrafted={reload} />
          ))}
        </div>
      )}

      {newOnes.length > 0 && (
        <Card className="mt-5" title={t("New practices teachers described", "शिक्षकों के बताए नए तरीके")} icon={Sparkles}>
          <p className={cx("mb-3 text-sm text-[var(--color-ink-2)]", hi)}>
            {t("Not in Jugnu's list yet — from real interviews. Worth a closer look on the next visit.", "अभी जुगनू की सूची में नहीं — असली बातचीत से। अगली बार ध्यान से देखने लायक।")}
          </p>
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
          <button className="flex w-full items-center justify-between text-left" onClick={() => setShowRest((v) => !v)} aria-expanded={showRest}>
            <span>
              <span className="block font-semibold">
                {t(`Set aside: ${rest.length} practices that don't separate bright spots`, `अलग रखे: ${rest.length} तरीके जो अच्छे स्कूलों को अलग नहीं करते`)}
              </span>
              <span className="block text-sm text-[var(--color-ink-2)]">
                {t(
                  "Many schools say they do these (“we follow the lesson plan”) — so they can't explain the difference.",
                  "बहुत से स्कूल ये करने की बात कहते हैं (“हम पाठ योजना से पढ़ाते हैं”) — इसलिए ये फ़र्क नहीं समझाते।",
                )}
              </span>
            </span>
            <ChevronDown size={18} className={cx("shrink-0 transition", showRest && "rotate-180")} />
          </button>
          {showRest && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {rest.map((e) => (
                <div key={e.practice} className="card-inset p-3 text-sm">
                  <div className="font-semibold">{lang === "hi" ? PRACTICES[e.practice].labelHi : PRACTICES[e.practice].label}</div>
                  <div className="text-xs text-[var(--color-ink-3)]">
                    {t(
                      `bright spots ${e.bright.k}/${e.bright.n} · similar schools ${e.comparison.k}/${e.comparison.n}`,
                      `अच्छे स्कूल ${e.bright.k}/${e.bright.n} · समान स्कूल ${e.comparison.k}/${e.comparison.n}`,
                    )}
                    {reveal && ` · ${EFFECTIVE.includes(e.practice) ? t("truly effective", "असल में असरदार") : t("decoy", "नकली")}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function PracticeCard({ e, reveal, cardStatus, onDrafted }: { e: PracticeEvidence; reveal: boolean; cardStatus?: ReviewItem["status"]; onDrafted: () => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const { state } = usePipeline();
  const p = PRACTICES[e.practice];
  const school = (id: string) => state.block.schools.find((s) => s.id === id);
  const [busy, setBusy] = useState(false);
  const draft = async () => {
    setBusy(true);
    await postJSON("/api/reviews/card", {
      practice: e.practice,
      quotes: e.quotes.map((q) => ({ school: `${school(q.schoolId)?.teacher ?? ""}, ${school(q.schoolId)?.village ?? ""}`, quote: q.quote })),
    }).catch(() => null);
    setBusy(false);
    onDrafted();
  };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{lang === "hi" ? p.labelHi : p.label}</h3>
          <div className="text-xs text-[var(--color-ink-3)]">{lang === "hi" ? p.label : p.labelHi}</div>
        </div>
        <span className="chip" style={{ borderColor: tint("var(--tone-lime)", 55), color: "var(--tone-lime)" }}>
          {t("Travels", "दूसरों तक पहुँचाने लायक")} · {t(p.cost === "zero" ? "no cost" : `${p.cost} cost`, p.cost === "zero" ? "बिना खर्च" : "कम खर्च")}
        </span>
      </div>
      <p className="mt-2 text-[15px] text-[var(--color-ink-2)]">{p.what}</p>
      <div className="mt-3">
        <Dumbbell bright={e.bright.k / Math.max(1, e.bright.n)} comparison={e.comparison.k / Math.max(1, e.comparison.n)} />
        <p className="mt-1 text-xs text-[var(--color-ink-2)]">
          {t(
            `Described in detail by ${e.bright.k} of ${e.bright.n} bright-spot teachers, but only ${e.comparison.k} of ${e.comparison.n} teachers in similar ordinary schools (${Math.round(e.pDistinctive * 100)}% sure it is more common in bright spots).`,
            `${e.bright.n} में से ${e.bright.k} अच्छे-स्कूल शिक्षकों ने विस्तार से बताया, पर उन जैसे सामान्य स्कूलों के ${e.comparison.n} में से सिर्फ़ ${e.comparison.k} ने (${Math.round(e.pDistinctive * 100)}% भरोसा कि यह अच्छे स्कूलों में ज़्यादा है)।`,
          )}
        </p>
      </div>
      {e.quotes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {e.quotes.slice(0, 3).map((q) => {
            const s = school(q.schoolId);
            return (
              <li key={q.schoolId} className="card-inset flex gap-2 p-3 text-sm">
                <Quote size={14} className="mt-0.5 shrink-0 text-amber-200" aria-hidden />
                <div>
                  <div className="font-deva">{q.quote}</div>
                  {s && (
                    <Link to={`/schools/${s.id}`} className="mt-1 block text-xs text-[var(--color-ink-3)] hover:text-white">
                      — {s.teacher}, {s.name}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {cardStatus === "approved" ? (
          <span className="chip" style={{ borderColor: tint("var(--tone-good)", 55), color: "var(--tone-good)" }}>
            <FileCheck2 size={13} /> {t("Practice card approved", "तरीके का कार्ड मंज़ूर")}
          </span>
        ) : cardStatus === "pending" ? (
          <Link className="chip" to="/review">
            {t("Practice card waiting for approval →", "कार्ड मंज़ूरी का इंतज़ार कर रहा है →")}
          </Link>
        ) : (
          e.quotes.length > 0 && (
            <button className="btn btn-glass !py-1.5 text-sm" onClick={draft} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <FileCheck2 size={14} />} {t("Draft a one-page practice card", "एक पेज का कार्ड बनाएँ")}
            </button>
          )
        )}
        <span className="text-xs text-[var(--color-ink-3)]">
          {t(`${state.recs.filter((r) => r.practice === e.practice).length} schools will learn it`, `${state.recs.filter((r) => r.practice === e.practice).length} स्कूल इसे सीखेंगे`)}
        </span>
      </div>
      {reveal && (
        <div className="mt-2 text-xs text-[var(--color-ink-3)]">
          {EFFECTIVE.includes(e.practice)
            ? t(`Hidden truth: effective (reading +${p.effect.reading}, maths +${p.effect.numeracy} logit)`, "छिपा सच: असरदार")
            : t("Hidden truth: no effect (decoy)", "छिपा सच: कोई असर नहीं (नकली)")}
        </div>
      )}
    </Card>
  );
}
