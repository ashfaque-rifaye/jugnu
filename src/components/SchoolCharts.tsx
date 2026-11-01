// Reading a school's results: one colour scale for "share of children at their class level", darker
// meaning more, so a class or subject that is behind stands out without reading every number.
import { useState } from "react";
import { blockScore, schoolScore, SUBJECT_INFO, SUBJECTS, type Subject } from "../engine/subjects";
import { CYCLES, type School } from "../engine/types";
import { usePrefs, useT } from "../lib/prefs";
import { cx } from "./ui";

/** Five even steps of one hue, in both themes. */
function shade(v: number) {
  const pct = 10 + Math.min(1, Math.max(0, v / 80)) * 62;
  return `color-mix(in srgb, var(--tone-reading) ${pct.toFixed(0)}%, transparent)`;
}

export function LevelCell({ value, strong, title }: { value: number | null; strong?: boolean; title?: string }) {
  if (value == null) return <span className="block rounded-lg py-1.5 text-center text-xs text-[var(--color-ink-3)]">—</span>;
  return (
    <span className={cx("block rounded-lg py-1.5 text-center text-[13px] tabular-nums", strong && "font-bold")} style={{ background: shade(value) }} title={title}>
      {Math.round(value)}
    </span>
  );
}

/** Classes down the side, subjects across the top, against the block's average. */
export function ClassSubjectGrid({ school: s, schools }: { school: School; schools: School[] }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const [mode, setMode] = useState<"level" | "block">("level");
  const cell = (subject: Subject, grade?: number) => {
    const v = schoolScore(s, subject, grade);
    const b = blockScore(schools, subject, grade);
    if (mode === "level") return <LevelCell value={v} title={t(`${Math.round(v ?? 0)}% at their class level; block average ${Math.round(b ?? 0)}%`, `${Math.round(v ?? 0)}% अपनी कक्षा के स्तर पर; ब्लॉक औसत ${Math.round(b ?? 0)}%`)} />;
    const d = Math.round((v ?? 0) - (b ?? 0));
    return (
      <span className="block rounded-lg py-1.5 text-center text-[13px] font-medium tabular-nums" style={{ background: d >= 5 ? "color-mix(in srgb, var(--tone-good) 22%, transparent)" : d <= -5 ? "color-mix(in srgb, var(--tone-bad) 22%, transparent)" : "var(--inset-bg)" }}>
        {d > 0 ? "+" : ""}
        {d}
      </span>
    );
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>
          {mode === "level" ? t("Share of children at the level expected for their class. Darker is better.", "कितने प्रतिशत बच्चे अपनी कक्षा के स्तर पर हैं। गहरा रंग बेहतर है।") : t("Points above or below the block's average for the same class.", "उसी कक्षा के ब्लॉक औसत से कितने अंक ऊपर या नीचे।")}
        </p>
        <div className="inline-flex rounded-full bg-[var(--inset-bg)] p-0.5 text-xs">
          {(["level", "block"] as const).map((m) => (
            <button key={m} className={cx("seg-item rounded-full px-2.5 py-1", mode === m ? "seg-on font-semibold" : "text-[var(--color-ink-2)]", hi)} onClick={() => setMode(m)}>
              {m === "level" ? t("At level", "स्तर पर") : t("Against block", "ब्लॉक से तुलना")}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
          <thead>
            <tr className={cx("text-xs text-[var(--color-ink-3)]", hi)}>
              <th className="pb-1 text-left font-medium">{t("Class", "कक्षा")}</th>
              {SUBJECTS.map((x) => (
                <th key={x} className="pb-1 text-center font-medium">{t(...SUBJECT_INFO[x].short)}</th>
              ))}
              <th className="pb-1 text-right font-medium">{t("Children", "बच्चे")}</th>
              <th className="pb-1 text-right font-medium">{t("Attend", "उपस्थित")}</th>
            </tr>
          </thead>
          <tbody>
            {s.grades.map((g) => (
              <tr key={g.grade}>
                <td className="w-14 font-semibold">{g.grade}</td>
                {SUBJECTS.map((x) => (
                  <td key={x}>{cell(x, g.grade)}</td>
                ))}
                <td className="text-right tabular-nums text-[var(--color-ink-2)]">{g.enrolled}</td>
                <td className="text-right tabular-nums text-[var(--color-ink-2)]">{Math.round(g.attendance * 100)}%</td>
              </tr>
            ))}
            <tr>
              <td className={cx("pt-1 text-xs font-semibold", hi)}>{t("All", "सभी")}</td>
              {SUBJECTS.map((x) => (
                <td key={x} className="pt-1">{cell(x)}</td>
              ))}
              <td className="pt-1 text-right font-semibold tabular-nums">{s.enrolment}</td>
              <td className="pt-1 text-right font-semibold tabular-nums">{Math.round(s.attendance * 100)}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Three years for one subject: where it started, where it is, and the line between. */
function Spark({ subject, values }: { subject: Subject; values: number[] }) {
  const t = useT();
  const { lang } = usePrefs();
  const [hover, setHover] = useState<number | null>(null);
  const W = 150;
  const H = 54;
  const max = Math.max(40, ...values) * 1.15;
  const x = (i: number) => 8 + (i / Math.max(1, values.length - 1)) * (W - 16);
  const y = (v: number) => H - 6 - (v / max) * (H - 14);
  const change = (values.at(-1) ?? 0) - (values[0] ?? 0);
  const shown = hover ?? values.length - 1;
  return (
    <div className="card-inset p-3">
      <div className={cx("text-[13px] font-medium", lang === "hi" && "font-deva")}>{t(SUBJECT_INFO[subject].en, SUBJECT_INFO[subject].hi)}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-display text-xl font-bold tabular-nums">{values[shown]}%</span>
        <span className="text-xs tabular-nums text-[var(--color-ink-3)]">{hover != null ? CYCLES[hover] : `${change >= 0 ? "+" : ""}${change} ${t("in 3 years", "3 साल में")}`}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label={t(`${SUBJECT_INFO[subject].en}: ${values.join(", ")} percent over three years`, `${SUBJECT_INFO[subject].hi}: तीन साल में ${values.join(", ")} प्रतिशत`)} onMouseLeave={() => setHover(null)}>
        <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="var(--tone-reading)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {values.map((v, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - 18} y={0} width={36} height={H} fill="transparent" />
            <circle cx={x(i)} cy={y(v)} r={hover === i || (hover == null && i === values.length - 1) ? 4 : 2.5} fill="var(--tone-reading)" stroke="var(--chrome-solid)" strokeWidth={1.5} />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function SubjectTrends({ school: s }: { school: School }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
      {SUBJECTS.map((x) => (
        <Spark key={x} subject={x} values={s.subjectTrend[x]} />
      ))}
    </div>
  );
}

/** Class 3 against schools in a similar situation: the comparison that decides who is doing well. */
export function AgainstSimilar({ school, expected }: { school: School; expected: { reading: number[]; numeracy: number[] } }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const groups = [
    { key: "reading" as const, label: t("Hindi reading", "हिंदी पढ़ना") },
    { key: "numeracy" as const, label: t("Maths", "गणित") },
  ];
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g.key}>
          <div className={cx("mb-2 text-sm font-medium", hi)}>{g.label}</div>
          <ul className="space-y-2.5">
            {CYCLES.map((c, i) => {
              const v = Math.round(school[g.key][i]);
              const e = Math.round(expected[g.key][i]);
              return (
                <li key={c} className="grid grid-cols-[58px_1fr_56px] items-center gap-2 text-xs">
                  <span className="tabular-nums text-[var(--color-ink-3)]">{c}</span>
                  <span className="relative block h-3.5 rounded-full bg-[var(--ring-track)]">
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, v)}%`, background: v >= e ? "var(--tone-reading)" : "var(--tone-muted)" }} />
                    <span className="absolute -inset-y-0.5 w-[3px] rounded-full bg-[var(--color-ink)]" style={{ left: `calc(${Math.min(100, e)}% - 1px)` }} title={t(`Similar schools: ${e}%`, `वैसे ही स्कूल: ${e}%`)} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{v}% <span className="font-normal text-[var(--color-ink-3)]">/ {e}</span></span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
