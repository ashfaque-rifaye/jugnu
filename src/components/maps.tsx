// Maps of the block, coloured by each school's status (bright spot, needs support, ...).
// LivingMap = the 3D scene when the device can afford it, the flat map in low-data mode.
import { lazy, Suspense, useMemo, useState } from "react";
import type { School } from "../engine/types";
import { usePrefs, useT } from "../lib/prefs";
import { STATUS_INFO, tint, type SchoolStatus } from "../lib/status";
import { cx } from "./ui";

const BlockScene = lazy(() => import("./BlockScene"));

export interface MapProps {
  schools: School[];
  status: Map<string, SchoolStatus>;
  selected?: string | null;
  onSelect?: (id: string) => void;
  links?: { from: string; to: string }[];
  highlight?: Set<string>;
  /** results vs expectation per school (window brightness in 3D) */
  z?: Record<string, number>;
  height?: number;
  className?: string;
}

export function LivingMap(props: MapProps & { mode?: "auto" | "2d" | "3d"; autoRotate?: boolean }) {
  const { lite } = usePrefs();
  const use3d = props.mode === "3d" || (props.mode !== "2d" && !lite);
  const h = props.height ?? 420;
  if (!use3d) return <StatusMap {...props} />;
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center text-sm text-[var(--color-ink-3)]" style={{ height: h }}>
          …
        </div>
      }
    >
      {/* the 3D night map keeps its dark look in light mode too */}
      <div className="on-dark">
        <BlockScene {...props} height={h} autoRotate={props.autoRotate} />
      </div>
    </Suspense>
  );
}

export function StatusMap({ schools, status, selected, onSelect, links = [], highlight, height = 420, className }: MapProps) {
  const t = useT();
  const W = 760;
  const H = height;
  const [hover, setHover] = useState<string | null>(null);
  const box = useMemo(() => {
    const xs = schools.map((s) => s.x);
    const ys = schools.map((s) => s.y);
    return { minX: Math.min(...xs) - 2, maxX: Math.max(...xs) + 2, minY: Math.min(...ys) - 2, maxY: Math.max(...ys) + 2 };
  }, [schools]);
  const px = (x: number) => 24 + ((x - box.minX) / (box.maxX - box.minX)) * (W - 48);
  const py = (y: number) => H - 24 - ((y - box.minY) / (box.maxY - box.minY)) * (H - 48);
  const byId = useMemo(() => new Map(schools.map((s) => [s.id, s])), [schools]);
  const clusters = useMemo(() => {
    const m = new Map<string, { x: number; y: number; n: number }>();
    for (const s of schools) {
      const c = m.get(s.clusterName) ?? { x: 0, y: 0, n: 0 };
      m.set(s.clusterName, { x: c.x + s.x, y: c.y + s.y, n: c.n + 1 });
    }
    return [...m.entries()].map(([name, c]) => ({ name, x: c.x / c.n, y: c.y / c.n }));
  }, [schools]);
  const hs = hover ? byId.get(hover) : null;
  const order: SchoolStatus[] = ["ok", "support", "revisit", "check_due", "check_data", "bright"];
  return (
    <div className={cx("relative", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("Map of the block's schools by status", "ब्लॉक के स्कूलों का नक्शा, स्थिति के अनुसार")}>
        <defs>
          <radialGradient id="map-glow">
            <stop offset="0%" stopColor="var(--st-bright-fill)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--st-bright-fill)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {clusters.map((c) => (
          <text key={c.name} x={px(c.x)} y={py(c.y) - 26} textAnchor="middle" className="fill-white/25 text-[12px] font-semibold uppercase tracking-widest">
            {c.name}
          </text>
        ))}
        {links.map((l) => {
          const a = byId.get(l.from);
          const b = byId.get(l.to);
          if (!a || !b) return null;
          const [x1, y1, x2, y2] = [px(a.x), py(a.y), px(b.x), py(b.y)];
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.25;
          return <path key={`${l.from}-${l.to}`} d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none" stroke="var(--st-bright-fill)" strokeOpacity="0.7" strokeWidth="1.4" strokeDasharray="4 4" />;
        })}
        {[...schools]
          .sort((a, b) => order.indexOf(status.get(a.id) ?? "ok") - order.indexOf(status.get(b.id) ?? "ok"))
          .map((s) => {
            const st = status.get(s.id) ?? "ok";
            const c = STATUS_INFO[st].color;
            const dim = highlight && !highlight.has(s.id);
            const r = st === "bright" ? 6.5 : st === "ok" ? 3.6 : 5;
            return (
              <g
                key={s.id}
                transform={`translate(${px(s.x)},${py(s.y)})`}
                className="cursor-pointer"
                opacity={dim ? 0.25 : 1}
                onMouseEnter={() => setHover(s.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(s.id)}
              >
                <circle r={14} fill="transparent" />
                {st === "bright" && <circle r={18} fill="url(#map-glow)" />}
                <circle r={r} fill={st === "ok" ? "var(--st-ok-dot)" : c} stroke={selected === s.id ? "var(--sel-ring)" : "var(--dot-ring)"} strokeWidth={selected === s.id ? 2.4 : 1.2} />
              </g>
            );
          })}
      </svg>
      {hs && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-xl border border-white/15 bg-black/80 px-3 py-1.5 text-xs backdrop-blur">
          <span className="font-semibold">{hs.name}</span> · {hs.teacher} ·{" "}
          <span style={{ color: STATUS_INFO[status.get(hs.id) ?? "ok"].color }}>{t(STATUS_INFO[status.get(hs.id) ?? "ok"].en, STATUS_INFO[status.get(hs.id) ?? "ok"].hi)}</span>
        </div>
      )}
    </div>
  );
}

export function MapLegend({ status, onPick, active }: { status: Map<string, SchoolStatus>; onPick?: (s: SchoolStatus | null) => void; active?: SchoolStatus | null }) {
  const t = useT();
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of status.values()) c[v] = (c[v] ?? 0) + 1;
    return c;
  }, [status]);
  const keys: SchoolStatus[] = ["bright", "check_due", "check_data", "revisit", "support", "ok"];
  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 md:flex-wrap md:overflow-visible">
      {keys
        .filter((k) => counts[k])
        .map((k) => (
          <button
            key={k}
            className={cx("chip shrink-0 transition", active && active !== k && "opacity-45")}
            style={{ borderColor: tint(STATUS_INFO[k].color, 40) }}
            onClick={() => onPick?.(active === k ? null : k)}
            aria-pressed={active === k}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: k === "ok" ? "var(--st-ok-dot)" : STATUS_INFO[k].color }} />
            {t(STATUS_INFO[k].en, STATUS_INFO[k].hi)} <span className="tabular-nums text-[var(--color-ink-3)]">{counts[k]}</span>
          </button>
        ))}
    </div>
  );
}
