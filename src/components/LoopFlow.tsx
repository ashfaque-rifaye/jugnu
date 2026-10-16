// The block as one flow from data to action — schools → beat expectations → verified → heard →
// practices → schools learning one. Each step opens the page where that work happens.
import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";
import { loopCounts } from "../lib/story";
import { CountUp } from "../lib/motion";
import { cx } from "./ui";

export function LoopFlow({ compact = false, onEnter }: { compact?: boolean; onEnter?: () => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const { state, followUps } = usePipeline();
  const c = loopCounts(state, followUps);
  const steps: { n: number; label: string; sub?: string; to: string; tone: string }[] = [
    { n: c.schools, label: t("schools in the block", "ब्लॉक के स्कूल"), to: "/schools", tone: "var(--color-ink)" },
    { n: c.candidates, label: t("do better than expected, year after year", "साल-दर-साल अपेक्षा से बेहतर"), to: "/schools", tone: "var(--st-check-due)" },
    {
      n: c.bright,
      label: t("checked on the spot: bright spots", "मौके पर जाँचे: अच्छे स्कूल"),
      sub: c.checksDue ? t(`${c.checksDue} checks still due`, `${c.checksDue} जाँच बाकी`) : undefined,
      to: "/schools?status=bright",
      tone: "var(--st-bright)",
    },
    { n: c.heard, label: t("teachers interviewed", "शिक्षकों से बातचीत"), to: "/interviews", tone: "var(--tone-teal)" },
    { n: c.practices, label: t("practices worth spreading", "फैलाने लायक तरीके"), to: "/practices", tone: "var(--tone-lime)" },
    {
      n: c.support,
      label: t("schools learning one from a teacher nearby", "स्कूल पास के शिक्षक से एक तरीका सीख रहे"),
      sub: c.calls ? t(`${c.working} of ${c.calls} called back say it is working`, `फ़ॉलो-अप में ${c.calls} में से ${c.working} ने कहा, असर हो रहा है`) : t("follow-up call on day 14", "14वें दिन फ़ॉलो-अप कॉल"),
      to: "/plan",
      tone: "var(--st-support)",
    },
  ];
  return (
    <ol className={cx("grid gap-2", compact ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6 lg:gap-3")}>
      {steps.map((s, i) => (
        <li key={i} className="relative">
          <Link
            to={s.to}
            onClick={onEnter}
            className={cx("card-inset card-hover group block h-full", compact ? "px-3 py-2.5" : "px-4 py-4")}
          >
            <div className={cx("font-display font-bold tabular-nums leading-none", compact ? "text-2xl" : "text-3xl md:text-4xl")} style={{ color: s.tone }}>
              <CountUp value={s.n} />
            </div>
            <div className={cx("mt-1.5 text-[13px] leading-snug text-[var(--color-ink-2)]", lang === "hi" && "font-deva")}>{s.label}</div>
            {s.sub && <div className={cx("mt-1 text-xs text-[var(--color-ink-3)]", lang === "hi" && "font-deva")}>{s.sub}</div>}
          </Link>
          {i < steps.length - 1 && (
            <span className={cx("pointer-events-none absolute -right-[13px] top-1/2 z-10 hidden -translate-y-1/2", compact ? "xl:block" : "lg:block")} aria-hidden>
              <ChevronRight size={16} className="flow-chev text-[var(--color-ink-3)]" style={{ "--i": i } as CSSProperties} />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
