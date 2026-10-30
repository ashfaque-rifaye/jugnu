// Who learns from whom, on the real positions of the block's schools. It walks through the teachers
// who are showing others a method, one at a time, with the actual schools and distances.
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PRACTICES } from "../engine/practices";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";
import { cx } from "./ui";

const W = 760;
const H = 440;

export function SpreadMap({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const { state } = usePipeline();
  const hi = lang === "hi" && "font-deva";
  const schools = state.block.schools;
  const byId = useMemo(() => new Map(schools.map((s) => [s.id, s])), [schools]);
  const teachers = useMemo(() => {
    const m = new Map<string, typeof state.recs>();
    for (const r of state.recs) m.set(r.demonstratorId, [...(m.get(r.demonstratorId) ?? []), r]);
    return [...m.entries()].map(([id, recs]) => ({ id, recs: [...recs].sort((a, b) => a.distanceKm - b.distanceKm) })).sort((a, b) => b.recs.length - a.recs.length);
  }, [state]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || matchMedia("(prefers-reduced-motion: reduce)").matches || teachers.length < 2) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % teachers.length), 5200);
    return () => window.clearInterval(id);
  }, [paused, teachers.length]);
  const box = useMemo(() => {
    const xs = schools.map((s) => s.x);
    const ys = schools.map((s) => s.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }, [schools]);
  const px = (x: number) => 20 + ((x - box.x0) / Math.max(1, box.x1 - box.x0)) * (W - 40);
  const py = (y: number) => H - 20 - ((y - box.y0) / Math.max(1, box.y1 - box.y0)) * (H - 40);
  const now = teachers[Math.min(i, teachers.length - 1)];
  if (!now) return null;
  const d = byId.get(now.id)!;
  const method = PRACTICES[now.recs[0].practice];
  const avg = now.recs.reduce((a, r) => a + r.distanceKm, 0) / now.recs.length;

  return (
    <div className="card grid overflow-hidden lg:grid-cols-[1.45fr_1fr]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={t(`${state.block.name}: ${schools.length} real schools. ${d.teacher} at ${d.name} is showing ${now.recs.length} of them a method.`, `${state.block.name}: ${schools.length} असली स्कूल। ${d.name} के ${d.teacher}, ${now.recs.length} स्कूलों को एक तरीका दिखा रहे हैं।`)}>
          {schools.map((s) => (
            <circle key={s.id} cx={px(s.x)} cy={py(s.y)} r={2.6} fill="rgb(var(--fg) / 0.24)" />
          ))}
          <AnimatePresence>
            <motion.g key={now.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              {now.recs.map((r, k) => {
                const s = byId.get(r.schoolId)!;
                return (
                  <g key={r.schoolId}>
                    <motion.line x1={px(d.x)} y1={py(d.y)} x2={px(s.x)} y2={py(s.y)} stroke="var(--st-bright)" strokeWidth={1.6} strokeOpacity={0.75} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 0.05 * k, ease: "easeOut" }} />
                    <circle cx={px(s.x)} cy={py(s.y)} r={4.6} fill="var(--st-support)" stroke="var(--chrome-solid)" strokeWidth={1.4} />
                  </g>
                );
              })}
              <circle cx={px(d.x)} cy={py(d.y)} r={15} fill="var(--st-bright)" fillOpacity={0.18} />
              <circle cx={px(d.x)} cy={py(d.y)} r={7} fill="var(--st-bright)" stroke="var(--chrome-solid)" strokeWidth={1.6} />
            </motion.g>
          </AnimatePresence>
        </svg>
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-4 text-xs text-[var(--color-ink-2)]">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--st-bright)]" /> {t("School doing well", "अच्छा कर रहा स्कूल")}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--st-support)]" /> {t("School learning from it", "उससे सीख रहा स्कूल")}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--fg)/0.24)]" /> {t("Every other real school", "बाकी असली स्कूल")}</span>
        </div>
      </div>
      <div className="flex flex-col border-t border-[var(--line)] p-5 md:p-6 lg:border-l lg:border-t-0">
        <div className={cx("label", hi)}>{t(`${state.block.name}, real school locations`, `${state.block.name}, स्कूलों की असली जगह`)}</div>
        <AnimatePresence mode="wait">
          <motion.div key={now.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }} className="mt-3 flex-1">
            <h3 className={cx("text-xl font-semibold leading-snug", hi)}>
              {t(`${d.teacher} is showing ${now.recs.length} ${now.recs.length === 1 ? "school" : "schools"} how to run “${method.label}”`, `${d.teacher}, ${now.recs.length} स्कूलों को “${method.labelHi}” सिखा रहे हैं`)}
            </h3>
            <p className={cx("mt-1 text-sm text-[var(--color-ink-2)]", hi)}>
              {d.name} · {t(`on average ${avg.toFixed(1)} km away`, `औसतन ${avg.toFixed(1)} किमी दूर`)}
            </p>
            <ul className="mt-3 space-y-1.5">
              {now.recs.slice(0, 4).map((r) => {
                const s = byId.get(r.schoolId)!;
                return (
                  <li key={r.schoolId} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{lang === "hi" && s.nameHi ? s.nameHi : s.name}</span>
                    <span className="shrink-0 tabular-nums text-[var(--color-ink-3)]">{r.distanceKm.toFixed(1)} km</span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </AnimatePresence>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button className="tap-link inline-flex items-center gap-1 text-sm font-semibold text-[var(--st-bright)]" onClick={() => onOpen(now.id)}>
            {t("Open this school", "यह स्कूल खोलें")} <ArrowRight size={14} />
          </button>
          <span className="flex items-center gap-1">
            <button className="btn btn-glass btn-icon !p-1.5" onClick={() => setI((i - 1 + teachers.length) % teachers.length)} aria-label={t("Previous teacher", "पिछले शिक्षक")}>
              <ChevronLeft size={15} />
            </button>
            <span className="w-14 text-center text-xs tabular-nums text-[var(--color-ink-3)]">{i + 1} / {teachers.length}</span>
            <button className="btn btn-glass btn-icon !p-1.5" onClick={() => setI((i + 1) % teachers.length)} aria-label={t("Next teacher", "अगले शिक्षक")}>
              <ChevronRight size={15} />
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
