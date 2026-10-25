// The Jugnu mark: a village school whose doorway is lit, and a firefly carrying that light out to
// the next school — what Jugnu does. Same drawing as public/logo.svg; ids are per-instance so
// several marks can share a page.
import { useId } from "react";
import { cx } from "./ui";

const TRAIL = "M23 39.3c7.4-.4 11.5-6.3 16-13.4 3.6-5.6 6.8-9.6 11.2-11.5l2.2 4.6c-3.9 1.7-6.6 5.2-9.9 10.6-5.3 8.6-10.4 11.7-19.5 11.4z";

export function LogoMark({ size = 36, tile = true, className }: { size?: number; tile?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const u = (n: string) => `${n}-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={u("bg")} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#17305a" />
          <stop offset="1" stopColor="#070d18" />
        </linearGradient>
        <radialGradient id={u("lit")} cx="50%" cy="35%" r="75%">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="0.45" stopColor="#fde047" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id={u("halo")} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fde047" stopOpacity="0.9" />
          <stop offset="0.4" stopColor="#facc15" stopOpacity="0.32" />
          <stop offset="1" stopColor="#facc15" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={u("trail")} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f59e0b" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#fde047" />
          <stop offset="1" stopColor="#fffbe0" />
        </linearGradient>
      </defs>
      {tile && <rect width="64" height="64" rx="16" fill={`url(#${u("bg")})`} />}
      <path d="M9.5 31 23 19.5 36.5 31M13.5 28.5v20h19v-20" fill="none" stroke={tile ? "#eef3ff" : "currentColor"} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.4 48.5v-6.3a3.6 3.6 0 0 1 7.2 0v6.3z" fill={`url(#${u("lit")})`} />
      {tile && <path d={TRAIL} fill="#0a1426" transform="translate(0.6 0.9)" />}
      <path d={TRAIL} fill={`url(#${u("trail")})`} />
      <circle cx="51.4" cy="16" r="12" fill={`url(#${u("halo")})`} className="logo-halo" />
      <ellipse cx="48.2" cy="11.7" rx="3.8" ry="1.8" transform="rotate(-38 48.2 11.7)" fill="#e0f2fe" fillOpacity="0.8" />
      <ellipse cx="55.2" cy="12.4" rx="3.8" ry="1.8" transform="rotate(28 55.2 12.4)" fill="#e0f2fe" fillOpacity="0.62" />
      <circle cx="51.4" cy="16.2" r="4.4" fill={`url(#${u("lit")})`} />
    </svg>
  );
}

export function Wordmark({ size = 34, sub, className }: { size?: number; sub?: string; className?: string }) {
  return (
    <span className={cx("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="leading-none">
        <span className="font-display text-[1.15rem] font-bold tracking-tight">
          Jugnu <span className="font-deva text-sm font-semibold text-[var(--color-ink-3)]">जुगनू</span>
        </span>
        {sub && <span className="mt-1 block text-[11px] font-medium text-[var(--color-ink-3)]">{sub}</span>}
      </span>
    </span>
  );
}
