// Building blocks of the working app: page headers, glass cards, status chips, an iOS-style
// segmented control, progress rings and a step tracker — the same on every page.
import { motion } from "framer-motion";
import { CircleHelp, X, type LucideIcon } from "lucide-react";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { STATUS_INFO, tint, type SchoolStatus } from "../lib/status";
import { usePrefs, useT } from "../lib/prefs";
import { CountText, EASE, WordReveal } from "../lib/motion";
import { cx } from "./ui";

export const SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;

export function PageHeader({ title, sub, actions, eyebrow, hint }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode; hint?: ReactNode }) {
  const { lang } = usePrefs();
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <motion.div className="label mb-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            {eyebrow}
          </motion.div>
        )}
        <h1 className={cx("flex flex-wrap items-center gap-x-2 text-[1.9rem] font-semibold leading-tight tracking-[-0.035em] md:text-[2.35rem]", lang === "hi" && "font-deva")}>
          {typeof title === "string" ? <WordReveal text={title} stagger={0.05} /> : title}
          {hint && <Hint>{hint}</Hint>}
        </h1>
        {sub && (
          <motion.p
            className={cx("mt-1.5 max-w-3xl text-[15px] leading-relaxed text-[var(--color-ink-2)]", lang === "hi" && "font-deva")}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
          >
            {sub}
          </motion.p>
        )}
      </div>
      {actions && (
        <motion.div className="flex flex-wrap items-center gap-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25, ease: EASE }}>
          {actions}
        </motion.div>
      )}
    </header>
  );
}

/** A "?" that opens one plain sentence about the page. */
function Hint({ children }: { children: ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex font-sans">
      <button className="btn btn-ghost btn-icon !p-1 text-[var(--color-ink-3)]" onClick={() => setOpen((v) => !v)} aria-label={t("What is this page?", "यह पेज क्या है?")} aria-expanded={open}>
        <CircleHelp size={18} />
      </button>
      {open && (
        <motion.span
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING}
          className="sheet absolute left-0 top-9 z-40 w-[min(320px,80vw)] rounded-2xl p-3.5 text-left text-sm font-normal leading-relaxed tracking-normal text-[var(--color-ink-2)]"
        >
          <button className="float-right ml-2 text-[var(--color-ink-3)]" onClick={() => setOpen(false)} aria-label={t("Close", "बंद करें")}>
            <X size={14} />
          </button>
          {children}
        </motion.span>
      )}
    </span>
  );
}

export function Card({
  title,
  icon: Icon,
  right,
  children,
  className,
  pad = true,
  tone,
  tour,
  accent,
  style,
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
  /** colour of the icon tile */
  tone?: string;
  /** anchor for the guided tour */
  tour?: string;
  /** gradient hairline on the top edge */
  accent?: boolean;
  style?: CSSProperties;
}) {
  return (
    <section className={cx("card", accent && "edge-top", pad && "p-5 md:p-6", className)} data-tour={tour} style={style}>
      {(title || right) && (
        <div className={cx("mb-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-2.5", !pad && "px-5 pt-5 md:px-6")}>
          {title && (
            <h2 className="flex min-w-0 flex-[1_1_12rem] items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em]">
              {Icon && (
                <span className="icon-tile h-8 w-8" style={{ "--tile": tone ?? "var(--st-bright)" } as CSSProperties}>
                  <Icon size={16} aria-hidden />
                </span>
              )}
              <span className="truncate">{title}</span>
            </h2>
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusChip({ status, size = "md" }: { status: SchoolStatus; size?: "sm" | "md" }) {
  const t = useT();
  const s = STATUS_INFO[status];
  return (
    <span className={cx("chip", size === "sm" && "!px-2 !py-0.5 !text-xs")} style={{ borderColor: tint(s.color, 45), background: tint(s.color, 12), color: s.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} aria-hidden />
      {t(s.en, s.hi)}
    </span>
  );
}

/** iOS-style segmented control: the selected thumb glides between options. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div className={cx("no-scrollbar inline-flex max-w-full shrink-0 overflow-x-auto rounded-full border border-[var(--chip-line)] bg-[var(--chip)] p-1 backdrop-blur-md", className)} role="tablist">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={String(o.value)}
            role="tab"
            aria-selected={on}
            className={cx(
              "seg-item relative isolate flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[13px]" : "px-3.5 py-1.5 text-sm",
              on ? "text-[var(--color-ink)]" : "text-[var(--color-ink-2)] hover:text-[var(--color-ink)]",
            )}
            onClick={() => onChange(o.value)}
          >
            {on && <motion.span layoutId={`seg-${id}`} className="seg-on absolute inset-0 -z-10 rounded-full" transition={SPRING} />}
            {o.label}
            {o.count !== undefined && <span className="rounded-full bg-[rgb(var(--fg)/0.08)] px-1.5 text-xs tabular-nums">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="card-inset grid place-items-center gap-2 border-dashed px-6 py-10 text-center">
      <span className="icon-tile h-12 w-12 rounded-2xl" style={{ "--tile": "var(--tone-teal)" } as CSSProperties}>
        <Icon size={22} aria-hidden />
      </span>
      <div className="font-semibold">{title}</div>
      {children && <div className="max-w-md text-sm text-[var(--color-ink-2)]">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <div className="card-inset px-4 py-3.5">
      <div className="text-[13px] text-[var(--color-ink-2)]">{label}</div>
      <div className="mt-1 font-display text-[1.7rem] font-bold leading-none tabular-nums" style={tone ? { color: tone } : undefined}>
        <CountText>{value}</CountText>
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--color-ink-3)]">{hint}</div>}
    </div>
  );
}

export const fieldBase =
  "rounded-2xl border border-[var(--chip-line)] bg-[var(--inset-bg)] px-3.5 py-2.5 text-[15px] outline-none transition backdrop-blur-md focus:border-[color-mix(in_srgb,var(--st-bright)_70%,transparent)] focus:bg-[var(--hover)]";
export const fieldClass = `w-full ${fieldBase}`;

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-[var(--color-ink-2)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--color-ink-3)]">{hint}</span>}
    </label>
  );
}

/** A page header over a quiet background video (poster image only in low-data mode). */
/** The slow aurora behind the glass (deck palette). */
export function AppBackground() {
  return (
    <div className="app-bg" aria-hidden>
      <i className="orb o1" />
      <i className="orb o2" />
      <i className="orb o3" />
    </div>
  );
}

/** "3 days ago" in the user's language. */
export function useAgo() {
  const t = useT();
  return (iso: string) => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return t("just now", "अभी");
    if (s < 3600) return t(`${Math.round(s / 60)} min ago`, `${Math.round(s / 60)} मिनट पहले`);
    if (s < 86400) return t(`${Math.round(s / 3600)} h ago`, `${Math.round(s / 3600)} घंटे पहले`);
    return t(`${Math.round(s / 86400)} days ago`, `${Math.round(s / 86400)} दिन पहले`);
  };
}

/* ------------------------------------------------------------------ progress */

export interface RingSpec {
  value: number; // 0..1
  color: string;
}

/** Concentric progress rings (outermost first), drawn like activity rings: rounded ends, soft track. */
export function Rings({ rings, size = 168, stroke = 16, gap = 4, children }: { rings: RingSpec[]; size?: number; stroke?: number; gap?: number; children?: ReactNode }) {
  const c = size / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        {rings.map((r, i) => {
          const radius = c - stroke / 2 - i * (stroke + gap);
          const len = 2 * Math.PI * radius;
          const v = Math.max(0, Math.min(1, r.value));
          return (
            <g key={i}>
              <circle cx={c} cy={c} r={radius} fill="none" stroke={r.color} strokeOpacity={0.16} strokeWidth={stroke} />
              <motion.circle
                cx={c}
                cy={c}
                r={radius}
                fill="none"
                stroke={r.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={len}
                initial={{ strokeDashoffset: len }}
                animate={{ strokeDashoffset: len * (1 - (v === 0 ? 0.0001 : v)) }}
                transition={{ type: "spring", stiffness: 60, damping: 18 }}
                style={{ filter: `drop-shadow(0 0 6px color-mix(in srgb, ${r.color} 45%, transparent))` }}
              />
            </g>
          );
        })}
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  );
}

/** A thin rounded bar that grows with a spring. */
export function Meter({ value, color = "var(--st-bright)", className, height = 6 }: { value: number; color?: string; className?: string; height?: number }) {
  return (
    <div className={cx("overflow-hidden rounded-full bg-[var(--ring-track)]", className)} style={{ height }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        transition={{ type: "spring", stiffness: 70, damping: 18 }}
      />
    </div>
  );
}
