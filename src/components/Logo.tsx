// The Jugnu mark: a firefly whose wings are the two pages of an open book, its light glowing
// beneath them — learning that carries its own light. Same drawing as public/logo.svg; ids are
// per-instance so several marks can share a page.
import { useId } from "react";
import { cx } from "./ui";

// Left wing / page; the right one is its mirror image around x = 32.
const WING = "M30.6 22.6C23.4 22.2 13.6 26.6 13.6 36.4V42.2H20.2C26.4 42.2 31 39.4 31.9 33Z";
const FOLD = "M30.2 23.4 17.6 37.2";

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const u = (n: string) => `${n}-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={u("bg")} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#163063" />
          <stop offset="1" stopColor="#081428" />
        </linearGradient>
        <radialGradient id={u("glow")} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffd56b" stopOpacity="0.85" />
          <stop offset="0.45" stopColor="#f5b942" stopOpacity="0.3" />
          <stop offset="1" stopColor="#f5b942" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={u("body")} cx="50%" cy="62%" r="60%">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.5" stopColor="#ffd56b" />
          <stop offset="1" stopColor="#e4a43c" />
        </radialGradient>
        <linearGradient id={u("wing")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a3dccf" />
          <stop offset="1" stopColor="#7cc2b2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${u("bg")})`} />
      <circle cx="32" cy="43" r="17" fill={`url(#${u("glow")})`} className="logo-halo" />
      <path d="M26.3 22.4a5.7 5.7 0 0 1 11.4 0Z" fill="#e4a43c" />
      <ellipse cx="32" cy="41.6" rx="8.4" ry="7.6" fill={`url(#${u("body")})`} />
      <g fill={`url(#${u("wing")})`} stroke="#0b1a35" strokeWidth="1.5" strokeLinejoin="round">
        <path d={WING} />
        <path d={WING} transform="matrix(-1 0 0 1 64 0)" />
      </g>
      <g stroke="#0b1a35" strokeWidth="1.3" strokeLinecap="round">
        <path d={FOLD} />
        <path d={FOLD} transform="matrix(-1 0 0 1 64 0)" />
        <path d="M32 22.6V31" />
      </g>
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
