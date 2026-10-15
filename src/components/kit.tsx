// Building blocks of the working app: page headers, cards, status chips, segmented controls and
// form fields — plain, readable, the same on every page.
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { STATUS_INFO, tint, type SchoolStatus } from "../lib/status";
import { usePrefs, useT } from "../lib/prefs";
import { cx } from "./ui";

export function PageHeader({ title, sub, actions, eyebrow }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  const { lang } = usePrefs();
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="label mb-1">{eyebrow}</div>}
        <h1 className={cx("text-2xl font-bold tracking-tight md:text-[1.75rem]", lang === "hi" && "font-deva")}>{title}</h1>
        {sub && <p className={cx("mt-1 max-w-3xl text-[15px] text-[var(--color-ink-2)]", lang === "hi" && "font-deva")}>{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  icon: Icon,
  right,
  children,
  className,
  pad = true,
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={cx("card", pad && "p-4 md:p-5", className)}>
      {(title || right) && (
        <div className={cx("mb-3 flex items-center justify-between gap-2", !pad && "px-4 pt-4 md:px-5")}>
          {title && (
            <h2 className="flex items-center gap-2 text-base font-semibold">
              {Icon && <Icon size={17} className="text-[var(--a2)]" aria-hidden />} {title}
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
    <span className={cx("chip", size === "sm" && "!px-2 !py-0.5 !text-[11px]")} style={{ borderColor: tint(s.color, 50), background: tint(s.color, 11), color: s.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} aria-hidden />
      {t(s.en, s.hi)}
    </span>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div className={cx("inline-flex flex-wrap rounded-full border border-[var(--chip-line)] bg-[var(--chip)] p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="tab"
          aria-selected={value === o.value}
          className={cx(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition",
            value === o.value ? "seg-on" : "text-[var(--color-ink-2)] hover:text-[var(--color-ink)]",
          )}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="rounded-full bg-white/10 px-1.5 text-[11px] tabular-nums">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
      <Icon size={26} className="text-[var(--color-ink-3)]" aria-hidden />
      <div className="font-semibold">{title}</div>
      {children && <div className="max-w-md text-sm text-[var(--color-ink-2)]">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <div className="card-inset px-4 py-3">
      <div className="text-[13px] text-[var(--color-ink-2)]">{label}</div>
      <div className="mt-0.5 font-display text-2xl font-bold tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-[var(--color-ink-3)]">{hint}</div>}
    </div>
  );
}

export const fieldBase = "rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-[15px] outline-none transition focus:border-amber-200/70 focus:bg-black/40";
export const fieldClass = `w-full ${fieldBase}`;

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-[var(--color-ink-2)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--color-ink-3)]">{hint}</span>}
    </label>
  );
}

/** A page header over a quiet background video (poster image only in low-data mode). */
export function MediaHeader({ video, poster, children }: { video: string; poster: string; children: ReactNode }) {
  const { lite } = usePrefs();
  return (
    <section className="card on-dark relative mb-5 overflow-hidden">
      {lite ? <img className="welcome-video" src={poster} alt="" aria-hidden /> : <video className="welcome-video" src={video} poster={poster} autoPlay muted loop playsInline aria-hidden />}
      <div className="welcome-shade" />
      <AIVideoLabel className="absolute bottom-2 right-2" />
      <div className="relative p-5 md:p-7">{children}</div>
    </section>
  );
}

/** Visible label for AI-generated video, wherever one plays. */
export function AIVideoLabel({ className }: { className?: string }) {
  return <span className={cx("on-dark pointer-events-none rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white/70 backdrop-blur", className)}>AI video · Veo</span>;
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
