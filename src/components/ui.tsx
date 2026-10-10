import { motion } from "framer-motion";
import { CircleAlert, CircleCheck, CircleHelp, Cpu, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { VerifyVerdict } from "../engine/types";
import { useStatus } from "../lib/api";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function Glass({ className, children, strong, delay = 0 }: { className?: string; children: ReactNode; strong?: boolean; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cx(strong ? "glass-strong" : "glass", className)}
    >
      {children}
    </motion.div>
  );
}

export function SectionTitle({ eyebrow, title, sub, right }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="label mb-1">{eyebrow}</div>}
        <h2 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h2>
        {sub && <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-2)]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function StatTile({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="glass-inset px-4 py-3">
      <div className="label">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-[var(--color-ink-3)]">{sub}</div>}
    </div>
  );
}

export function AIStatus() {
  const s = useStatus();
  if (!s.checked) return null;
  return s.claude ? (
    <span className="chip" style={{ borderColor: "#0ca30c88", background: "#0ca30c1f" }} title={`Claude connected (${s.model})`}>
      <Sparkles size={12} className="text-emerald-300" aria-hidden /> <span className="hidden 2xl:inline">Claude connected</span>
    </span>
  ) : (
    <span className="chip" title="Add ANTHROPIC_API_KEY to .env to connect Claude. Everything still runs on the offline engine.">
      <Cpu size={12} className="text-teal-300" aria-hidden /> <span className="hidden 2xl:inline">Offline engine</span>
    </span>
  );
}

const VERDICT: Record<VerifyVerdict, { label: string; color: string; Icon: typeof CircleCheck }> = {
  verified: { label: "Verified bright spot", color: "#0ca30c", Icon: CircleCheck },
  inflation_suspected: { label: "Data may be inflated", color: "#d03b3b", Icon: CircleAlert },
  revisit: { label: "Revisit", color: "#fab219", Icon: CircleHelp },
};

export function VerdictChip({ verdict }: { verdict: VerifyVerdict }) {
  const v = VERDICT[verdict];
  return (
    <span className="chip" style={{ borderColor: `${v.color}99`, background: `${v.color}22` }}>
      <v.Icon size={12} style={{ color: v.color }} aria-hidden /> {v.label}
    </span>
  );
}

/** Diverging colour for "results vs expectation": red below, neutral grey at expected, blue above. */
export function zColor(z: number): string {
  const t = Math.max(-1, Math.min(1, z / 2));
  const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const neutral = [92, 94, 98];
  const above = [57, 135, 229];
  const below = [230, 103, 103];
  const c = t >= 0 ? mix(neutral, above, t) : mix(neutral, below, -t);
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

export function Fireflies({ count = 14 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="firefly"
          style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${(i % 7) * 0.9}s, ${(i % 5) * 0.6}s`, animationDuration: `${8 + (i % 5)}s, ${2.2 + (i % 4) * 0.5}s` }}
        />
      ))}
    </div>
  );
}
