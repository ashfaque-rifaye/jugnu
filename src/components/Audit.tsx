// The audit trail: every change anyone made, who made it, when, and what they said about it. Read
// from the same shared log the console is built on, so nothing can change without showing up here.
import { Download, History } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { STATUS_WORDS } from "../lib/actions";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline, type BlockEvent } from "../lib/store";
import type { Action } from "../engine/types";
import { Card, Segmented } from "./kit";
import { cx } from "./ui";

type Kind = "all" | "moves" | "signoff" | "visits" | "calls" | "reports";

export interface AuditRow {
  id: string;
  at: string;
  who: string;
  schoolId: string;
  school: string;
  what: string;
  from?: string;
  to?: string;
  note?: string;
  kind: Exclude<Kind, "all">;
}

const OUTCOME: Record<string, [string, string]> = {
  adopted: ["Doing it regularly", "नियमित कर रहे हैं"],
  trying: ["Trying it", "आज़मा रहे हैं"],
  barrier: ["Something is in the way", "रुकावट है"],
  no_answer: ["No answer", "जवाब नहीं"],
};
const GOING: Record<string, [string, string]> = { well: ["going well", "अच्छा चल रहा"], mixed: ["mixed", "मिला-जुला"], hard: ["hard going", "मुश्किल"] };

export function useAudit() {
  const t = useT();
  const { events, state, allActions } = usePipeline();
  return useMemo(() => {
    const school = (id: string) => state.block.schools.find((s) => s.id === id)?.name ?? id;
    const toRow = (e: BlockEvent): AuditRow | null => {
      const p = e.payload as Record<string, unknown>;
      const base = { id: String(e.id), at: e.created_at, who: e.actor ?? t("Someone", "कोई") };
      if (e.kind === "action") {
        const a = allActions.find((x) => x.id === e.ref);
        const schoolId = a?.schoolId ?? e.ref.split("-")[0];
        const to = p.status as Action["status"];
        const from = p.from as Action["status"] | undefined;
        const signoff = from === "submitted" && to === "done";
        const back = from === "submitted" && to !== "done";
        const noteOnly = from === to;
        return {
          ...base,
          schoolId,
          school: school(schoolId),
          what: a?.task ?? e.ref,
          from: !noteOnly && from ? t(...STATUS_WORDS[from]) : undefined,
          to: noteOnly ? t("Note added", "टिप्पणी जोड़ी") : signoff ? t("Signed off", "पुष्टि हुई") : back ? t("Sent back", "वापस भेजा") : t(...(STATUS_WORDS[to] ?? [String(to), String(to)])),
          note: p.note as string | undefined,
          kind: signoff || back || to === "submitted" ? "signoff" : "moves",
        };
      }
      if (e.kind === "spotcheck")
        return { ...base, schoolId: e.ref, school: school(e.ref), what: t("Confirmation visit recorded", "पुष्टि दौरा दर्ज"), to: t(`${p.proficient} of ${p.sampled} read · ${p.numeracyProficient} of ${p.sampled} did the sum`, `${p.sampled} में ${p.proficient} ने पढ़ा · ${p.numeracyProficient} ने सवाल किया`), kind: "visits" };
      if (e.kind === "followup") {
        const o = OUTCOME[String(p.outcome)] ?? [String(p.outcome), String(p.outcome)];
        return { ...base, schoolId: e.ref, school: school(e.ref), what: t("Follow-up call", "फ़ॉलो-अप कॉल"), to: t(...o), note: p.said as string | undefined, kind: "calls" };
      }
      if (e.kind === "weekly") {
        const g = GOING[String(p.going)] ?? ["", ""];
        return { ...base, schoolId: e.ref, school: school(e.ref), what: t("Weekly school report", "साप्ताहिक स्कूल रिपोर्ट"), to: t(`${p.teachersUsing} teachers using it, ${p.childrenReached} children · ${g[0]}`, `${p.teachersUsing} शिक्षक, ${p.childrenReached} बच्चे · ${g[1]}`), note: p.note as string | undefined, kind: "reports" };
      }
      if (e.kind === "note") return { ...base, schoolId: e.ref, school: school(e.ref), what: t("Note", "टिप्पणी"), note: p.text as string | undefined, kind: "moves" };
      return null;
    };
    return events
      .filter((e) => !e.pending)
      .map(toRow)
      .filter((r): r is AuditRow => !!r)
      .reverse();
  }, [events, state.block, allActions, t]);
}

export function AuditTrail({ schoolId, actionId, compact }: { schoolId?: string; actionId?: string; compact?: boolean }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const { state, events } = usePipeline();
  const all = useAudit();
  const [kind, setKind] = useState<Kind>("all");
  const refs = useMemo(() => (actionId ? new Set(events.filter((e) => e.ref === actionId).map((e) => String(e.id))) : null), [actionId, events]);
  const rows = all.filter((r) => (!schoolId || r.schoolId === schoolId) && (!refs || refs.has(r.id)) && (kind === "all" || r.kind === kind));
  const exportCsv = () => {
    const head = ["When", "Who", "School", "What", "From", "To", "Note"];
    const lines = rows.map((r) => [r.at, r.who, r.school, r.what, r.from ?? "", r.to ?? "", r.note ?? ""].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    a.download = `jugnu-audit-${state.block.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const body =
    rows.length === 0 ? (
      <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>{t("Nothing recorded yet. Every change made here will appear with who made it and when.", "अभी कुछ दर्ज नहीं। यहाँ किया हर बदलाव, किसने और कब किया, के साथ दिखेगा।")}</p>
    ) : (
      <ol className="space-y-1.5">
        {rows.slice(0, compact ? 12 : 200).map((r) => (
          <li key={r.id} className="card-inset grid gap-x-4 gap-y-0.5 px-3.5 py-2.5 text-sm md:grid-cols-[150px_1fr_auto]">
            <div className="text-xs tabular-nums text-[var(--color-ink-3)]">{new Date(r.at).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
            <div className="min-w-0">
              <div className={cx("font-medium", hi)}>{r.what}</div>
              <div className="text-xs text-[var(--color-ink-2)]">
                {!schoolId && (
                  <>
                    <Link to={`/schools/${r.schoolId}`} className="tap-link hover:underline">
                      {r.school}
                    </Link>{" "}
                    ·{" "}
                  </>
                )}
                {r.who}
              </div>
              {r.note && <div className="mt-1 font-deva text-[13px] italic text-[var(--color-ink-2)]">“{r.note}”</div>}
            </div>
            {r.to && (
              <div className={cx("text-xs font-medium md:text-right", hi)}>
                {r.from && <span className="text-[var(--color-ink-3)]">{r.from} → </span>}
                {r.to}
              </div>
            )}
          </li>
        ))}
      </ol>
    );
  if (compact) return body;
  return (
    <Card
      title={t("Everything that changed", "जो कुछ भी बदला")}
      icon={History}
      right={
        <button className="btn btn-glass !py-1.5" onClick={exportCsv} disabled={!rows.length}>
          <Download size={14} /> CSV
        </button>
      }
    >
      <div className="no-scrollbar mb-3 overflow-x-auto">
        <Segmented
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: t("All", "सभी"), count: all.filter((r) => !schoolId || r.schoolId === schoolId).length },
            { value: "moves", label: t("Task moves", "काम बदले") },
            { value: "signoff", label: t("Sign-offs", "पुष्टियाँ") },
            { value: "visits", label: t("Visits", "दौरे") },
            { value: "calls", label: t("Calls", "कॉल") },
            { value: "reports", label: t("Weekly reports", "साप्ताहिक रिपोर्ट") },
          ]}
        />
      </div>
      {body}
    </Card>
  );
}
