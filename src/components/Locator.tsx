// "Where am I?": Madhya Pradesh with Damoh lit, and Damoh with the current block lit — the same
// outlines as the real map (OpenStreetMap), drawn as a tiny SVG so it costs nothing to show
// everywhere. Click a block to open it.
import { DAMOH_BLOCKS, DAMOH_DISTRICT, MADHYA_PRADESH, type Ring } from "../lib/geo-shapes";
import { cx } from "./ui";

function project(rings: Ring[], w: number, h: number, pad = 3) {
  const pts = rings.flat();
  const lat0 = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p[0] * k);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
  const ox = (w - (maxX - minX) * s) / 2;
  const oy = (h - (maxY - minY) * s) / 2;
  const path = (r: Ring) => "M" + r.map(([lon, lat]) => `${(ox + (lon * k - minX) * s).toFixed(1)},${(oy + (maxY - lat) * s).toFixed(1)}`).join("L") + "Z";
  const point = (lon: number, lat: number) => [ox + (lon * k - minX) * s, oy + (maxY - lat) * s] as const;
  return { path, point };
}

const W = 64;
const H = 52;
const state = project([MADHYA_PRADESH], W, H);
const dist = project([DAMOH_DISTRICT], W, H);

export function Locator({ block, onBlock, className, size = 1 }: { block?: string; onBlock?: (name: string) => void; className?: string; size?: number }) {
  return (
    <span className={cx("inline-flex items-center gap-1", className)} aria-hidden={!onBlock}>
      <svg width={W * size} height={H * size} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
        <title>Madhya Pradesh — Damoh district</title>
        <path d={state.path(MADHYA_PRADESH)} className="fill-[var(--chip)] stroke-[var(--color-ink-3)]" strokeWidth="0.6" />
        <path d={state.path(DAMOH_DISTRICT)} fill="var(--st-bright)" stroke="var(--st-bright)" strokeWidth="0.8" />
      </svg>
      <svg width={W * size} height={H * size} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
        <title>Damoh district — {block ?? ""} block</title>
        {Object.entries(DAMOH_BLOCKS).map(([name, ring]) => (
          <path
            key={name}
            d={dist.path(ring)}
            className={cx("transition-colors", onBlock && "cursor-pointer hover:fill-[color-mix(in_srgb,var(--st-bright)_45%,transparent)]")}
            fill={name === block ? "var(--st-bright)" : "var(--chip)"}
            stroke={name === block ? "var(--st-bright)" : "var(--color-ink-3)"}
            strokeWidth="0.6"
            onClick={onBlock ? () => onBlock(name) : undefined}
          >
            <title>{name}</title>
          </path>
        ))}
      </svg>
    </span>
  );
}
