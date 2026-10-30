// SVG charts: block map, expected-vs-reported scatter, practice dumbbells, effect bars.
// Thin marks, recessive grid, single axis, hover tooltips, labels never colour-only.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { School } from "../engine/types";
import { cx, zColor } from "./ui";

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

function Tooltip({ tip, W }: { tip: Tip | null; W: number }) {
  if (!tip) return null;
  return (
    <div
      className="glass-strong pointer-events-none absolute z-10 max-w-64 rounded-xl px-3 py-2 text-xs"
      style={{ left: `${(tip.x / W) * 100}%`, top: tip.y, transform: `translate(${tip.x > W * 0.6 ? "-105%" : "12px"}, -50%)` }}
    >
      {tip.content}
    </div>
  );
}

export function BlockMap({
  schools,
  z,
  bright,
  inflated,
  struggling,
  selected,
  onSelect,
  links = [],
  height = 420,
}: {
  schools: School[];
  z: Record<string, number>;
  bright: Set<string>;
  inflated: Set<string>;
  struggling: Set<string>;
  selected?: string | null;
  onSelect?: (id: string) => void;
  links?: { from: string; to: string }[];
  height?: number;
}) {
  const W = 760;
  const H = height;
  const xs = schools.map((s) => s.x), ys = schools.map((s) => s.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs) - 2, Math.max(...xs) + 2, Math.min(...ys) - 2, Math.max(...ys) + 2];
  const px = (x: number) => 20 + ((x - minX) / (maxX - minX)) * (W - 40);
  const py = (y: number) => H - 20 - ((y - minY) / (maxY - minY)) * (H - 40);
  const [tip, setTip] = useState<Tip | null>(null);
  const byId = new Map(schools.map((s) => [s.id, s]));
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Map of schools in the block, coloured by results versus expectation">
        <defs>
          <radialGradient id="glow">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={W} height={H} rx={18} fill="rgb(var(--fg) / 0.02)" />
        {links.map((l, i) => {
          const a = byId.get(l.from), b = byId.get(l.to);
          if (!a || !b) return null;
          return <line key={i} x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)} stroke="var(--st-bright-fill)" strokeOpacity={0.45} strokeWidth={1.2} strokeDasharray="3 4" />;
        })}
        <g>
          <circle cx={px(0)} cy={py(0)} r={5} fill="none" stroke="rgb(var(--fg) / 0.5)" />
          <text x={px(0) + 8} y={py(0) + 4} fontSize={12} fill="rgb(var(--fg) / 0.5)">
            Block HQ
          </text>
        </g>
        {schools.map((s) => {
          const isBright = bright.has(s.id);
          const r = isBright ? 7 : 5;
          return (
            <g
              key={s.id}
              className="cursor-pointer"
              onClick={() => onSelect?.(s.id)}
              onPointerEnter={() =>
                setTip({
                  x: px(s.x),
                  y: py(s.y),
                  content: (
                    <>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-[var(--color-ink-2)]">
                        {s.clusterName} cluster · {s.teacher}
                      </div>
                      <div className="mt-1 tabular-nums">vs expectation: {z[s.id] >= 0 ? "+" : ""}{z[s.id].toFixed(1)} SD</div>
                      {isBright && <div className="text-amber-200">✦ verified bright spot</div>}
                      {inflated.has(s.id) && <div className="text-rose-300">⚠ data may be inflated</div>}
                      {struggling.has(s.id) && <div className="text-[var(--color-ink-2)]">needs support</div>}
                    </>
                  ),
                })
              }
              onPointerLeave={() => setTip(null)}
            >
              {isBright && <circle cx={px(s.x)} cy={py(s.y)} r={20} fill="url(#glow)" className="animate-pulse" />}
              <circle cx={px(s.x)} cy={py(s.y)} r={r + 4} fill="transparent" />
              <circle
                cx={px(s.x)}
                cy={py(s.y)}
                r={r}
                fill={isBright ? "var(--st-bright-fill)" : zColor(z[s.id])}
                stroke={selected === s.id ? "var(--sel-ring)" : struggling.has(s.id) ? "rgb(var(--fg) / 0.55)" : "#13202a"}
                strokeWidth={selected === s.id ? 2.5 : struggling.has(s.id) ? 1.5 : 1.5}
                strokeDasharray={struggling.has(s.id) ? "2 2" : undefined}
              />
              {inflated.has(s.id) && (
                <text x={px(s.x) + 7} y={py(s.y) - 6} fontSize={12} fill="#f87171">
                  ⚠
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} W={W} />
    </div>
  );
}

export function ExpectedScatter({
  points,
  onSelect,
}: {
  points: { id: string; name: string; expected: number; reported: number; bright: boolean; inflated: boolean }[];
  onSelect?: (id: string) => void;
}) {
  const W = 520, H = 360, pad = { l: 44, r: 16, t: 14, b: 38 };
  const max = 100;
  const x = (v: number) => pad.l + (v / max) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const [tip, setTip] = useState<Tip | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Expected versus reported proficiency">
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(var(--fg) / 0.07)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill="rgb(var(--fg) / 0.45)">
              {t}%
            </text>
            <text x={x(t)} y={H - pad.b + 16} textAnchor="middle" fontSize={12} fill="rgb(var(--fg) / 0.45)">
              {t}%
            </text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(100)} y2={y(100)} stroke="rgb(var(--fg) / 0.3)" strokeDasharray="4 4" />
        <text x={x(78)} y={y(84)} fontSize={12} fill="rgb(var(--fg) / 0.5)" transform={`rotate(-34 ${x(78)} ${y(84)})`}>
          as expected
        </text>
        <text x={(W + pad.l) / 2} y={H - 4} textAnchor="middle" fontSize={12} fill="rgb(var(--fg) / 0.6)">
          Expected from context (%)
        </text>
        <text x={12} y={(H - pad.b) / 2} textAnchor="middle" fontSize={12} fill="rgb(var(--fg) / 0.6)" transform={`rotate(-90 12 ${(H - pad.b) / 2})`}>
          Reported (%)
        </text>
        {points.map((p) => (
          <circle
            key={p.id}
            cx={x(p.expected)}
            cy={y(p.reported)}
            r={p.bright ? 6 : 4}
            fill={p.bright ? "var(--st-bright-fill)" : p.inflated ? "#e66767" : zColor((p.reported - p.expected) / 12)}
            stroke="var(--dot-ring)"
            strokeWidth={1.5}
            className="cursor-pointer"
            onClick={() => onSelect?.(p.id)}
            onPointerEnter={() =>
              setTip({
                x: x(p.expected),
                y: y(p.reported),
                content: (
                  <>
                    <div className="font-semibold">{p.name}</div>
                    <div className="tabular-nums">
                      expected {p.expected.toFixed(0)}% · reported {p.reported.toFixed(0)}%
                    </div>
                    {p.bright && <div className="text-amber-200">✦ verified bright spot</div>}
                    {p.inflated && <div className="text-rose-300">⚠ data may be inflated</div>}
                  </>
                ),
              })
            }
            onPointerLeave={() => setTip(null)}
          />
        ))}
      </svg>
      <Tooltip tip={tip} W={W} />
    </div>
  );
}

/** Dumbbell: share of bright-spot vs comparison interviews describing a practice specifically. */
export function Dumbbell({ bright, comparison }: { bright: number; comparison: number }) {
  const W = 260, H = 26;
  const x = (v: number) => 8 + v * (W - 16);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[260px]" role="img" aria-label={`Bright spots ${Math.round(bright * 100)}%, comparison ${Math.round(comparison * 100)}%`}>
      <line x1={x(0)} x2={x(1)} y1={H / 2} y2={H / 2} stroke="rgb(var(--fg) / 0.1)" strokeWidth={2} strokeLinecap="round" />
      <line x1={x(Math.min(bright, comparison))} x2={x(Math.max(bright, comparison))} y1={H / 2} y2={H / 2} stroke="rgb(var(--fg) / 0.35)" strokeWidth={2} />
      <circle cx={x(comparison)} cy={H / 2} r={5} fill="#9ca3af" stroke="var(--dot-ring)" strokeWidth={2} />
      <circle cx={x(bright)} cy={H / 2} r={6} fill="var(--st-bright-fill)" stroke="var(--dot-ring)" strokeWidth={2} />
    </svg>
  );
}

/**
 * Effect per practice with 95% intervals. Drawn at the container's real pixel width (no SVG
 * scaling), so text stays at reading size on any screen; practice names are HTML and may wrap.
 */
export function EffectBars({ rows }: { rows: { label: string; effect: number; ci: [number, number]; truth?: number }[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Narrow screens: each practice name sits on its own line above its bar.
  const stacked = W < 480;
  const rowH = stacked ? 62 : 46;
  const labelW = stacked ? W : Math.round(Math.min(320, Math.max(120, W * 0.36)));
  const pad = stacked ? { l: 8, r: 48 } : { l: labelW + 12, r: 56 };
  const barY = (i: number) => (stacked ? 44 + i * rowH : 22 + i * rowH);
  const H = rows.length * rowH + 34;
  const lo = Math.min(-5, ...rows.map((r) => r.ci[0])), hi = Math.max(10, ...rows.map((r) => r.ci[1]), ...rows.map((r) => r.truth ?? 0));
  const x = (v: number) => pad.l + ((v - lo) / (hi - lo)) * (W - pad.l - pad.r);
  return (
    <div ref={box} className="relative w-full" style={{ height: H }}>
      {rows.map((r, i) => (
        <div
          key={r.label}
          className={cx("absolute left-0 flex text-[13px] leading-tight text-[var(--color-ink)]", stacked ? "items-end" : "items-center justify-end text-right")}
          style={stacked ? { top: barY(i) - 36, height: 24, width: labelW } : { top: barY(i) - rowH / 2, height: rowH, width: labelW }}
          title={r.label}
        >
          <span className={stacked ? "truncate" : "line-clamp-2"}>{r.label}</span>
        </div>
      ))}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0" role="img" aria-label="Estimated effect of each practice with 95% intervals">
        <line x1={x(0)} x2={x(0)} y1={stacked ? 24 : 8} y2={H - 26} stroke="rgb(var(--fg) / 0.35)" />
        {[lo, 0, hi].map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize={12} fill="rgb(var(--fg) / 0.45)">
            {t > 0 ? "+" : ""}
            {Math.round(t)} pts
          </text>
        ))}
        {rows.map((r, i) => {
          const cy = barY(i);
          const good = r.ci[0] > 0;
          return (
            <g key={r.label}>
              <line x1={x(r.ci[0])} x2={x(r.ci[1])} y1={cy} y2={cy} stroke={good ? "#3987e5" : "rgb(var(--fg) / 0.4)"} strokeWidth={2} strokeLinecap="round" />
              <rect x={Math.min(x(0), x(r.effect))} y={cy - 7} width={Math.abs(x(r.effect) - x(0))} height={14} rx={4} fill={good ? "#3987e5" : "rgb(var(--fg) / 0.25)"} opacity={0.55} />
              <circle cx={x(r.effect)} cy={cy} r={5} fill={good ? "#3987e5" : "#9ca3af"} stroke="var(--dot-ring)" strokeWidth={2} />
              {r.truth !== undefined && <line x1={x(r.truth)} x2={x(r.truth)} y1={cy - 11} y2={cy + 11} stroke="var(--st-bright-fill)" strokeWidth={2} />}
              <text x={W - pad.r + 8} y={cy + 4} fontSize={12} fill="rgb(var(--fg) / 0.85)" className="tabular-nums">
                {r.effect > 0 ? "+" : ""}
                {r.effect}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
