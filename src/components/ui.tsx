import { motion } from "framer-motion";
import type { ReactNode } from "react";

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
