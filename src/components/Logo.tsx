// The Jugnu mark: a lowercase "j" whose dot is a glowing firefly and whose stroke is its flight.
// Same drawing as public/logo.svg; ids are per-instance so several marks can share a page.
import { useId } from "react";
import { cx } from "./ui";

export function LogoMark({ size = 36, tile = true, className }: { size?: number; tile?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const u = (n: string) => `${n}-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <radialGradient id={u("bg")} cx="50%" cy="30%" r="80%">
          <stop offset="0" stopColor="#132a46" />
          <stop offset="0.55" stopColor="#0a1626" />
          <stop offset="1" stopColor="#04080f" />
        </radialGradient>
        <radialGradient id={u("halo")} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fde047" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="#facc15" stopOpacity="0.28" />
          <stop offset="1" stopColor="#facc15" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={u("orb")} cx="42%" cy="38%" r="62%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#fef3a2" />
          <stop offset="0.8" stopColor="#facc15" />
          <stop offset="1" stopColor="#eab308" />
        </radialGradient>
        <linearGradient id={u("wing")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0f9ff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#bae6fd" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id={u("trail")} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#fef08a" />
          <stop offset="0.45" stopColor="#facc15" />
          <stop offset="0.8" stopColor="#2dd4bf" stopOpacity="0.9" />
          <stop offset="1" stopColor="#2dd4bf" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {tile && <rect width="64" height="64" rx="15" fill={`url(#${u("bg")})`} />}
      <circle cx="36" cy="16.5" r="15" fill={`url(#${u("halo")})`} className="logo-halo" />
      <path d="M32.6 28.6a3.45 3.45 0 0 1 6.9 0V43c0 8.6-7.4 12.9-17.6 9.9 6.9.2 10.7-3.3 10.7-9.9z" fill={`url(#${u("trail")})`} />
      <ellipse cx="31.4" cy="11.6" rx="4.3" ry="2.1" transform="rotate(-28 31.4 11.6)" fill={`url(#${u("wing")})`} />
      <ellipse cx="40.6" cy="11.6" rx="4.3" ry="2.1" transform="rotate(28 40.6 11.6)" fill={`url(#${u("wing")})`} />
      <circle cx="36" cy="17" r="5.4" fill={`url(#${u("orb")})`} />
      <circle cx="17.5" cy="49.5" r="1.25" fill="#5eead4" fillOpacity="0.85" />
      <circle cx="13.2" cy="45.2" r="0.85" fill="#5eead4" fillOpacity="0.55" />
      <circle cx="45.5" cy="27" r="0.9" fill="#fde68a" fillOpacity="0.7" />
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
