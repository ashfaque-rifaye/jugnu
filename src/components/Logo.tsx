// The Jugnu mark: a firefly whose upper wings are the open pages of a book, lower wings two
// leaves, and whose body is a glowing drop of light — learning that carries its own light.
// Same drawing as public/logo.svg; ids are per-instance so several marks can share a page.
import { useId } from "react";
import { cx } from "./ui";

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const u = (n: string) => `${n}-${id}`;
  const url = (n: string) => `url(#${u(n)})`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={u("bg")} x1="0.2" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#1d2f74" />
          <stop offset="0.55" stopColor="#101d4a" />
          <stop offset="1" stopColor="#080f2b" />
        </linearGradient>
        <radialGradient id={u("glow")} cx="32" cy="45" r="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd068" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#f5a93a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f5a93a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={u("page")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fe0cf" />
          <stop offset="1" stopColor="#3fa89a" />
        </linearGradient>
        <linearGradient id={u("leaf")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#46c0ad" />
          <stop offset="1" stopColor="#1f7d78" />
        </linearGradient>
        <radialGradient id={u("body")} cx="0.4" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#fffbe8" />
          <stop offset="0.28" stopColor="#ffe08a" />
          <stop offset="0.7" stopColor="#f7b544" />
          <stop offset="1" stopColor="#d9862a" />
        </radialGradient>
        <linearGradient id={u("gold")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe3a0" />
          <stop offset="1" stopColor="#e8a845" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={url("bg")} />
      <circle cx="32" cy="45" r="21" fill={url("glow")} className="logo-halo" />
      <g fill={url("leaf")}>
        <path d="M30.6 37.4C24 35.2 16 37.6 12.8 44.8C20.6 47.6 27.6 44.6 30.6 37.4Z" />
        <path d="M33.4 37.4C40 35.2 48 37.6 51.2 44.8C43.4 47.6 36.4 44.6 33.4 37.4Z" />
      </g>
      <g fill={url("page")} stroke={url("gold")} strokeWidth="1.3" strokeLinejoin="round">
        <path d="M31 25.2C26.8 20.6 19.4 18.4 11.8 19.6L15 34.6C20.4 33 26.2 34 31 37.6Z" />
        <path d="M33 25.2C37.2 20.6 44.6 18.4 52.2 19.6L49 34.6C43.6 33 37.8 34 33 37.6Z" />
      </g>
      <g fill="none" stroke="#0f3f45" strokeWidth="1.1" strokeLinecap="round" opacity="0.55">
        <path d="M16.2 24.2C20.4 23.6 24.6 24.6 28 27.4" />
        <path d="M17.2 28.6C21 28.2 24.8 29.2 28.2 31.6" />
        <path d="M47.8 24.2C43.6 23.6 39.4 24.6 36 27.4" />
        <path d="M46.8 28.6C43 28.2 39.2 29.2 35.8 31.6" />
      </g>
      <g stroke={url("gold")} strokeWidth="1.5" strokeLinecap="round" fill="none">
        <path d="M30.6 18.6C29.6 15.6 27.8 13.6 25.4 12.8" />
        <path d="M33.4 18.6C34.4 15.6 36.2 13.6 38.6 12.8" />
      </g>
      <circle cx="32" cy="21" r="3.4" fill={url("gold")} />
      <path d="M32 34.4C37 38 39.2 42.2 38.6 46.4C38.1 50.4 35.1 53.2 32 55.8C28.9 53.2 25.9 50.4 25.4 46.4C24.8 42.2 27 38 32 34.4Z" fill={url("body")} />
      <ellipse cx="29.6" cy="42.4" rx="1.6" ry="3" transform="rotate(-18 29.6 42.4)" fill="#fff" opacity="0.6" />
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
